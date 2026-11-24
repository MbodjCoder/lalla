// Mode secours : Lalla répond même sans IA (clé absente, panne ou saturation
// de l'API).
//
// Compréhension par mots-clés dans les 8 langues des clients, réponse dans la
// langue où le client écrit, mémoire du tour précédent (« oui », « le deuxième »,
// « 2 »), réponses tirées des données de l'hôtel (Wi-Fi, horaires, carte,
// livret, recommandations, état des demandes), cartes de commande et de service
// comme en temps normal. Une question sans réponse n'est transmise à la
// réception que si le client le souhaite.
import "server-only";
import { heureLisible, horairesLisibles } from "@/composants/concierge/horaires";
import { bdd } from "@/lib/bdd";
import { peutCommander, type ContexteChambre } from "@/lib/contexte-chambre";
import {
  deciderDemande,
  propositionsEnAttente,
  proposerCommande,
  proposerService,
  routageService,
  memeIntitule,
  signatureLignes,
  type CategorieService,
  type Rattachement,
} from "@/lib/demandes";
import { formaterPrix } from "@/lib/format";
import { etatOuverture } from "@/lib/horaires-service";
import { traducteurClient } from "@/lib/i18n/client";
import type { CategorieAvecArticles, DocumentPrompt } from "@/lib/ia/prompt-systeme";
import { estLangueClient, FICHES_LANGUES, LANGUES_CLIENT, type LangueClient } from "@/lib/langues";
import type { TraductionsFiche } from "@/lib/ia/traduction";
import type { DemandeVue, EvenementFlux, TexteDemande } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";
import {
  articleParNom,
  articlesCites,
  descriptionArticle,
  nomArticle,
  nomRubrique,
  rubriqueAPresenter,
  type Article,
  type ArticleTrouve,
  type Categorie,
} from "./catalogue";
import {
  detecterLangue,
  estQuestion,
  mentionne,
  MOTS,
  nombreAnnonce,
  normaliser,
  ORDINAUX,
  SERVICES,
} from "./comprehension";
import { lieuxRecommandes, lignesHoraires, rechercherLivret } from "./livret";
import { ETATS_DEMANDE, REPONSES, RESUMES_SERVICE, type CleReponse, type CleService } from "./textes";

// Le temps d'apercevoir les points de saisie (une réponse instantanée paraît mécanique), sans faire attendre
const DELAI_REPONSE_MS = 250;
const ARTICLES_MAX_PAR_CARTE = 8;
const LIEUX_MAX = 6;
const DEMANDES_MAX_STATUT = 6;
// Au-delà, un « merci » ou un « bonjour » fait partie d'une vraie demande
const MOTS_MAX_MESSAGE_SOCIAL = 7;
// Message court sans question : « un bissap » vaut commande
const MOTS_MAX_COMMANDE_IMPLICITE = 6;
// « Tu ne comprends pas » dans une longue phrase est encore une plainte sur la conversation
const MOTS_MAX_INCOMPRIS = 18;
// Une carte proposée il y a plus longtemps n'est plus « celle dont on parle »
const FRAICHEUR_PROPOSITION_MS = 30 * 60 * 1000;

type Parametres = {
  contexte: ContexteChambre;
  conversationId: string;
  message: string;
  langue: string;
  categories: CategorieAvecArticles[];
  documents: DocumentPrompt[];
  rattachement: Rattachement;
  emettre: (evenement: EvenementFlux) => void;
};

type DemandeService = {
  cle: CleService;
  categorie: CategorieService;
  urgent: boolean;
  details?: string;
};

// ── Relecture des réponses précédentes ───────────────────────────────────────

const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Si le texte a été produit par ce modèle de réponse (dans une langue quelconque), ses variables ; sinon null. */
function lireModele(texte: string, cle: CleReponse): Record<string, string> | null {
  for (const langue of LANGUES_CLIENT) {
    const vues = new Set<string>();
    const motif = echapper(REPONSES[cle][langue]).replace(/\\\{(\w+)\\\}/g, (_, nom: string) => {
      if (vues.has(nom)) return "[\\s\\S]*?";
      vues.add(nom);
      return `(?<${nom}>[\\s\\S]*?)`;
    });
    const resultat = new RegExp(`^${motif}$`).exec(texte.trim());
    if (resultat) return { ...resultat.groups };
  }
  return null;
}

/** Articles d'une liste « - Nom — prix » écrite précédemment, dans l'ordre. */
function articlesDeListe(liste: string, categories: Categorie[]): Article[] {
  return liste
    .split("\n")
    .map((ligne) => /^- (.+?) — /.exec(ligne.trim())?.[1])
    .map((nom) => (nom ? articleParNom(nom, categories) : null))
    .filter((article): article is Article => article !== null);
}

/**
 * Articles cités dans une réponse rédigée librement (par le modèle, avant que le mode secours
 * ne prenne le relais), dans leur ordre d'apparition : « le deuxième » désigne alors le second.
 */
function articlesCitesDans(reponse: string, categories: Categorie[]): Article[] {
  const texte = ` ${normaliser(reponse)} `;
  return categories
    .flatMap((categorie) => categorie.articles)
    .filter((article) => article.disponible)
    .map((article) => {
      const noms = [article.nom, ...Object.values(article.traductions as TraductionsFiche).map((t) => t?.nom ?? "")];
      const positions = noms
        .map((nom) => normaliser(nom))
        .filter((nom) => nom.length >= 3)
        .map((nom) => texte.indexOf(` ${nom} `))
        .filter((position) => position >= 0);
      return { article, position: positions.length ? Math.min(...positions) : -1 };
    })
    .filter(({ position }) => position >= 0)
    .sort((a, b) => a.position - b.position)
    .map(({ article }) => article);
}

// ── Réponse ──────────────────────────────────────────────────────────────────

export async function repondreEnSecours({
  contexte,
  conversationId,
  message,
  langue: langueInterface,
  categories,
  documents,
  rattachement,
  emettre,
}: Parametres) {
  const { hotel, sejour } = contexte;
  // Le client est servi dans la langue où il écrit ; à défaut, celle de l'interface
  const langue: LangueClient = detecterLangue(message) ?? (estLangueClient(langueInterface) ? langueInterface : "fr");
  const t = traducteurClient(langue);
  const texte = normaliser(message);
  const mots = texte.split(" ").filter(Boolean);
  const court = mots.length <= MOTS_MAX_MESSAGE_SOCIAL;
  const question = estQuestion(message);

  const repondre = (cle: CleReponse, variables: Record<string, string> = {}) =>
    REPONSES[cle][langue].replace(/\{(\w+)\}/g, (_, nom: string) => variables[nom] ?? "");
  const telephone = hotel.telephoneReception
    ? repondre("telephoneReception", { telephone: hotel.telephoneReception })
    : "";
  const prix = (montant: number) => formaterPrix(montant, hotel.devise, langue);
  const ligneArticle = (article: Article) => `- ${nomArticle(article, langue)} — ${prix(article.prix)}`;
  const resumeDemande = (demande: { resume: string; traductions: Prisma.JsonValue }) =>
    (demande.traductions as Partial<Record<string, TexteDemande>>)[langue]?.resume ?? demande.resume;

  // Mémoire : la dernière réponse de Lalla et le message du client qui l'a précédée
  const precedents = await bdd.message.findMany({
    where: {
      conversationId,
      role: { in: ["CLIENT", "ASSISTANT"] },
      texte: { not: null },
    },
    orderBy: { rang: "desc" },
    take: 2,
    select: { role: true, texte: true },
  });
  const reponsePrecedente = precedents.find((m) => m.role === "ASSISTANT")?.texte ?? null;
  const messagePrecedent = precedents.find((m) => m.role === "CLIENT")?.texte ?? null;

  await persister(conversationId, "CLIENT", message);

  const parties: string[] = [];
  const services: DemandeService[] = [];
  let commandes: ArticleTrouve[] = [];
  const misesAJour: DemandeVue[] = [];
  let avis = false;
  const oui = court && mentionne(texte, MOTS.accord) && !mentionne(texte, MOTS.refus);
  const non = court && mentionne(texte, MOTS.refus);

  const traiter = async () => {
    // 1. La sécurité d'abord : numéros d'urgence et alerte de l'équipe, rien d'autre
    if (mentionne(texte, MOTS.urgence)) {
      parties.push(repondre("urgence", { reception: telephone }));
      services.push({ cle: "urgence", categorie: "autre", urgent: true });
      return;
    }

    // 2. Suite de la conversation : réponse à ce que Lalla vient de proposer
    if (reponsePrecedente) {
      if (lireModele(reponsePrecedente, "offreTransmission") && messagePrecedent) {
        // La carte de question se suffit : pas de texte autour
        if (oui) {
          services.push({
            cle: "question",
            categorie: "question",
            urgent: false,
            details: messagePrecedent,
          });
          return;
        }
        if (non) return void parties.push(repondre("refusOffre"));
      }
      const fiche = lireModele(reponsePrecedente, "article");
      const articlePropose = fiche?.article ? articleParNom(fiche.article, categories) : null;
      const quantite = nombreAnnonce(mots);
      if (articlePropose && (oui || (quantite && mots.length <= 3))) {
        commandes = [{ article: articlePropose, quantite: Math.min(quantite ?? 1, 20) }];
        return;
      }
      if (articlePropose && non) return void parties.push(repondre("refusOffre"));
      const choix = lireModele(reponsePrecedente, "choixMultiples") ?? lireModele(reponsePrecedente, "carte");
      // Réponse précédente rédigée par le modèle : les articles qu'elle cite, dans l'ordre
      const citesAvant = choix?.liste ? [] : articlesCitesDans(reponsePrecedente, categories);
      const options = choix?.liste ? articlesDeListe(choix.liste, categories) : citesAvant;
      // « Oui » à une proposition du modèle portant sur un seul article (« Je vous réserve le massage ? »)
      if (!articlePropose && oui && citesAvant.length === 1 && estQuestion(reponsePrecedente)) {
        commandes = [{ article: citesAvant[0], quantite: 1 }];
        return;
      }
      const rang = mots
        .map((mot) => ORDINAUX[mot] ?? (/^\d$/.test(mot) && mots.length <= 2 ? Number(mot) : 0))
        .find(Boolean);
      if (options.length > 0 && rang && rang <= options.length) {
        commandes = [{ article: options[rang - 1], quantite: 1 }];
        return;
      }
    }

    // 3. Annuler ce qui vient d'être proposé (ou demander l'annulation à l'équipe)
    if (mentionne(texte, MOTS.annulation)) {
      const recentes = await demandesDuSejour();
      const proposee = recentes.find(
        (d) => d.statut === "PROPOSEE" && Date.now() - d.creeLe.getTime() < FRAICHEUR_PROPOSITION_MS,
      );
      const enCours = recentes.find((d) => d.statut === "CONFIRMEE" || d.statut === "PRISE_EN_CHARGE");
      if (proposee) {
        const annulee = await deciderDemande(rattachement.chambreId, proposee.id, "annuler");
        if (annulee) misesAJour.push(annulee);
        parties.push(repondre("annulee", { resume: resumeDemande(proposee) }));
      } else if (enCours) {
        parties.push(repondre("annulationTransmise", { resume: resumeDemande(enCours) }));
        services.push({
          cle: "annulation",
          categorie: "autre",
          urgent: false,
          details: enCours.resume,
        });
      } else {
        parties.push(repondre("rienAAnnuler"));
      }
      return;
    }

    // 4. Où en sont mes demandes ?
    if (mentionne(texte, MOTS.statut) && !mentionne(texte, MOTS.commander)) {
      const recentes = (await demandesDuSejour()).filter((d) => d.statut !== "ANNULEE").slice(0, DEMANDES_MAX_STATUT);
      parties.push(
        recentes.length === 0
          ? repondre("aucuneDemande")
          : repondre("statut", {
              liste: recentes
                .reverse()
                .map(
                  (d) => `- ${resumeDemande(d)}${langue === "fr" ? " : " : ": "}**${ETATS_DEMANDE[d.statut][langue]}**`,
                )
                .join("\n"),
            }),
      );
      return;
    }

    // 5. Échanges sur la conversation elle-même
    if (mentionne(texte, MOTS.incompris) && mots.length <= MOTS_MAX_INCOMPRIS)
      return void parties.push(repondre("incompris"));
    if (mentionne(texte, MOTS.identite) && mots.length <= 10) {
      return void parties.push(
        repondre("identite", {
          assistant: hotel.nomAssistant,
          hotel: hotel.nom,
        }),
      );
    }
    if (mentionne(texte, MOTS.navigation)) return void parties.push(repondre("navigation"));

    // 6. Prolonger le séjour : c'est la réception qui décide
    if (mentionne(texte, MOTS.prolongation)) {
      if (!peutCommander(contexte)) return void parties.push(repondre("commandesBloquees", { reception: telephone }));
      services.push({ cle: "prolongation", categorie: "autre", urgent: false });
      return;
    }

    // 7. Que visiter ? Les incontournables du livret, puis les excursions de l'hôtel
    const commande = mentionne(texte, MOTS.commander);
    if (mentionne(texte, MOTS.recommandations) && !commande) {
      const lieux = lieuxRecommandes(documents).slice(0, LIEUX_MAX);
      if (lieux.length > 0) {
        const separateur = langue === "fr" ? " : " : "";
        parties.push(
          repondre("recommandations", {
            liste: lieux
              .map(({ nom, resume }) => `- **${nom}**${langue === "fr" ? `${separateur}${resume}` : ""}`)
              .join("\n"),
          }),
        );
      }
      const excursions = categories.find((c) => c.type === "EXPERIENCE")?.articles.filter((a) => a.disponible) ?? [];
      if (excursions.length > 0) {
        parties.push(
          repondre("excursionsHotel", {
            liste: excursions.map(ligneArticle).join("\n"),
          }),
        );
      }
      if (parties.length > 0) return;
    }

    traiterDemandesEtInformations(commande);

    // 8. Politesses, seulement quand le message ne demande rien d'autre
    if (rienDAutre() && court) {
      if (mentionne(texte, MOTS.commentCaVa)) parties.push(repondre("commentCaVa"));
      else if (mentionne(texte, MOTS.compliment)) parties.push(repondre("compliment"));
      else if (mentionne(texte, MOTS.merci) || oui) parties.push(repondre("remerciement"));
      else if (mentionne(texte, MOTS.salutation))
        parties.push(repondre("salutation", { assistant: hotel.nomAssistant }));
    }

    // 9. Le livret de l'hôtel répond (en français : c'est sa langue de rédaction)
    if (rienDAutre()) {
      const passage = rechercherLivret(message, documents);
      if (passage) parties.push(repondre("livretFrancais", { texte: passage }));
    }

    // 10. Rien trouvé : une question est proposée à la réception, le reste est clarifié
    if (rienDAutre()) parties.push(repondre(question ? "offreTransmission" : "incompris"));
  };

  // Ni texte ni carte : le message n'a encore reçu aucune réponse
  const rienDAutre = () => parties.length === 0 && services.length === 0 && commandes.length === 0;

  /** Commandes, services et informations pratiques : plusieurs peuvent se cumuler dans un message. */
  const traiterDemandesEtInformations = (commande: boolean) => {
    const questionHoraire = mentionne(texte, MOTS.horaire);
    if (mentionne(texte, MOTS.incident))
      services.push({
        cle: "incident",
        categorie: "maintenance",
        urgent: false,
      });
    if (mentionne(texte, MOTS.departTardif)) services.push({ cle: "departTardif", categorie: "autre", urgent: false });
    for (const service of SERVICES) {
      // « À quelle heure passe le ménage ? » est une question, pas une demande
      if (service.cle === "menage" && questionHoraire) continue;
      if (mentionne(texte, service.mots))
        services.push({
          cle: service.cle,
          categorie: service.categorie,
          urgent: false,
        });
    }
    const incident = services.some((s) => s.cle === "incident");

    // Articles de la carte : commandés, ou seulement décrits si le client se renseigne
    let ambigus: Article[] = [];
    if (!questionHoraire && !incident) {
      const taxi = services.some((s) => s.cle === "taxi");
      const cites = articlesCites(mots, categories, langue, taxi);
      const seRenseigne = mentionne(texte, MOTS.questionArticle) || (question && !commande);
      const commandeImplicite = !question && mots.length <= MOTS_MAX_COMMANDE_IMPLICITE;
      if (seRenseigne && cites.trouves.length > 0) {
        parties.push(...cites.trouves.map(({ article }) => ficheArticle(article)));
      } else if (commande || commandeImplicite || cites.trouves.some(({ quantite }) => quantite > 1)) {
        commandes = cites.trouves;
        ambigus = cites.ambigus;
      } else {
        ambigus = cites.trouves.length === 0 && question ? cites.ambigus : [];
      }
      for (const { article } of commandes.filter(({ article }) => !article.disponible)) {
        parties.push(repondre("indisponible", { article: nomArticle(article, langue) }));
      }
      commandes = commandes.filter(({ article }) => article.disponible);
    }

    // Une carte se suffit à elle-même : aucun texte autour
    if ((services.length > 0 || commandes.length > 0) && !peutCommander(contexte)) {
      parties.push(repondre("commandesBloquees", { reception: telephone }));
      services.length = 0;
      commandes = [];
    }
    if (ambigus.length > 0)
      parties.push(
        repondre("choixMultiples", {
          liste: ambigus.map(ligneArticle).join("\n"),
        }),
      );
    const actionPreparee = services.length > 0 || commandes.length > 0 || ambigus.length > 0;

    if (mentionne(texte, MOTS.wifi)) {
      parties.push(
        hotel.wifiReseau
          ? repondre("wifi", {
              reseau: hotel.wifiReseau,
              motDePasse: hotel.wifiMotDePasse ?? "—",
            })
          : repondre("wifiInconnu"),
      );
    }

    const departCite = mentionne(texte, MOTS.depart) && !services.some((s) => s.cle === "departTardif");
    if (departCite) {
      const heure = heureLisible(hotel.heureCheckout, langue);
      parties.push(
        sejour
          ? repondre("departDate", {
              date: new Intl.DateTimeFormat(FICHES_LANGUES[langue].locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: hotel.fuseauHoraire,
              }).format(sejour.depart),
              heure,
            })
          : repondre("departHeure", { heure }),
      );
    }

    if (questionHoraire && !departCite) {
      const lignes = lignesHoraires(texte, categories, documents, langue, t);
      // Un seul horaire se dit directement, plusieurs se présentent en liste
      if (lignes.length === 1) parties.push(lignes[0].replace(/^- /, ""));
      else if (lignes.length > 1) parties.push(repondre("horaires", { liste: lignes.join("\n") }));
    } else if (!actionPreparee && parties.length === 0) {
      // « J'ai faim », « la carte du spa » : la rubrique concernée, en entier
      const rubrique = rubriqueAPresenter(texte, categories);
      if (rubrique) {
        const plage = horairesLisibles(rubrique.horaires, langue, t);
        parties.push(
          repondre("carte", {
            rubrique: nomRubrique(rubrique, langue),
            plage: plage ? ` (${plage})` : "",
            liste: rubrique.articles
              .filter((article) => article.disponible)
              .slice(0, ARTICLES_MAX_PAR_CARTE)
              .map(ligneArticle)
              .join("\n"),
          }),
        );
      }
    }

    if (mentionne(texte, MOTS.revenir) && hotel.lienReservation) {
      parties.push(
        repondre("reservation", {
          lien: hotel.lienReservation,
          code: hotel.codeFidelite ? repondre("codeAvantage", { code: hotel.codeFidelite }) : "",
        }),
      );
    }
    if (parties.length === 0 && mentionne(texte, MOTS.reception) && hotel.telephoneReception) {
      parties.push(repondre("joindreReception", { telephone: hotel.telephoneReception }));
    }
    if (parties.length === 0 && mentionne(texte, MOTS.avis)) {
      parties.push(repondre("avis"));
      avis = true;
    }
  };

  /** « **Thiakry** — 2 500 FCFA · Dessert… », suivi de l'offre de le commander. */
  const ficheArticle = (article: Article) => {
    const categorie = categories.find((c) => c.id === article.categorieId);
    const plage = categorie ? horairesLisibles(categorie.horaires, langue, t) : null;
    const description = descriptionArticle(article, langue);
    return repondre("article", {
      article: nomArticle(article, langue),
      prix: prix(article.prix),
      description: description ? `\n${description}` : "",
      horaires: plage ? ` · ${plage}` : "",
    });
  };

  const demandesDuSejour = () =>
    bdd.demande.findMany({
      where: rattachement.sejourId ? { sejourId: rattachement.sejourId } : { conversationId },
      orderBy: { creeLe: "desc" },
      take: 20,
    });

  await traiter();

  // Ce qui attend déjà la confirmation du client n'est pas reproposé : on le lui rappelle
  if (services.length > 0 || commandes.length > 0) {
    const enAttente = await propositionsEnAttente(rattachement);
    // La même carte, pas seulement le même service : une autre question n'est jamais « déjà proposée »
    const dejaPropose = (service: DemandeService) => {
      const { type, departement } = routageService(service.categorie);
      const resume = service.cle === "question" ? (service.details ?? message) : RESUMES_SERVICE[service.cle].fr;
      return enAttente.some(
        (d) =>
          d.type === type &&
          d.departement === departement &&
          d.urgent === service.urgent &&
          memeIntitule(d.resume, resume),
      );
    };
    const signature = signatureLignes(
      commandes.map(({ article, quantite }) => ({
        articleId: article.id,
        quantite,
      })),
    );
    const commandeDejaProposee =
      commandes.length > 0 && enAttente.some((d) => d.type === "COMMANDE" && signatureLignes(d.lignes) === signature);
    if (services.every(dejaPropose) && (commandes.length === 0 || commandeDejaProposee)) {
      parties.unshift(repondre("dejaEnAttente"));
      services.length = 0;
      commandes = [];
    }
  }

  await new Promise((resoudre) => setTimeout(resoudre, DELAI_REPONSE_MS));

  // Hors des horaires du service : expliqué au client plutôt qu'une carte que le serveur refuserait
  const horairesRubrique = new Map(categories.map((categorie) => [categorie.id, categorie.horaires]));
  const fermes = commandes.filter(
    ({ article }) => etatOuverture(horairesRubrique.get(article.categorieId), hotel.fuseauHoraire) === "ferme",
  );
  for (const { article } of fermes) {
    parties.push(
      repondre("serviceFerme", {
        article: nomArticle(article, langue),
        horaires:
          horairesLisibles(horairesRubrique.get(article.categorieId) ?? null, langue, traducteurClient(langue)) ?? "",
      }),
    );
  }
  commandes = commandes.filter((commande) => !fermes.includes(commande));

  // Une commande issue de la mémoire (« oui », « le deuxième ») : la carte suffit, sauf commandes fermées
  if (commandes.length > 0 && !peutCommander(contexte)) {
    parties.push(repondre("commandesBloquees", { reception: telephone }));
    commandes = [];
  }

  const reponse = parties.join("\n\n");
  if (reponse) {
    emettre({ type: "texte", delta: reponse });
    emettre({
      type: "messageEnregistre",
      id: await persister(conversationId, "ASSISTANT", reponse),
    });
  }

  // Les cartes suivent le texte, comme avec l'IA
  for (const demande of misesAJour) emettre({ type: "demande", demande });
  if (commandes.length > 0) {
    const resultat = await proposerCommande(
      rattachement,
      langue,
      commandes.map(({ article, quantite }) => ({
        articleId: article.id,
        quantite,
      })),
    );
    if (resultat.ok) resultat.demandes.forEach((demande) => emettre({ type: "demande", demande }));
    // Déjà affichée et en attente : rien de nouveau à montrer
  }
  for (const service of services) {
    const brut = service.details ?? message;
    // Le message du client, tel quel : l'équipe voit exactement ce qu'il a écrit.
    // Une question est la phrase elle-même ; une demande garde son intitulé et la cite.
    const cite = { fr: `« ${brut} »`, en: `“${brut}”`, client: `« ${brut} »` };
    const question = service.cle === "question";
    const { demande, doublon } = await proposerService(
      rattachement,
      langue,
      service.categorie,
      question ? { fr: brut, en: brut, client: brut } : textesService(service.cle, langue),
      question ? undefined : cite,
      service.urgent,
    );
    if (!doublon) emettre({ type: "demande", demande });
  }
  if (avis) emettre({ type: "avis" });
}

function textesService(cle: CleService, langue: LangueClient) {
  const resume = RESUMES_SERVICE[cle];
  return { fr: resume.fr, en: resume.en, client: resume[langue] };
}

async function persister(conversationId: string, role: "CLIENT" | "ASSISTANT", texte: string): Promise<string> {
  const { id } = await bdd.message.create({
    data: {
      conversationId,
      role,
      contenu: [{ type: "text", text: texte }] as Prisma.InputJsonValue,
      texte,
    },
    select: { id: true },
  });
  return id;
}
