// Cycle de vie des demandes : proposition (IA) → confirmation (client)
// → notification du bon service (WhatsApp) → prise en charge → terminée.
// Une question suit le même chemin, et se termine par la réponse de l'équipe,
// que Lalla traduit et dépose dans la conversation du client.
//
// Chaque demande porte ses textes en français, en anglais (langues de l'équipe)
// et dans la langue du client. Les prix viennent toujours du catalogue.
import "server-only";
import { customAlphabet } from "nanoid";
import { apprendreDeLaReponse } from "@/lib/apprentissage";
import { enArrierePlan } from "@/lib/arriere-plan";
import { bdd } from "@/lib/bdd";
import { etatOuverture, heureHotel, instantLocal, prochainInstant } from "@/lib/horaires-service";
import { env } from "@/lib/env";
import { formaterPrix } from "@/lib/format";
import { cleDepartement, cleType, traducteurEquipe } from "@/lib/i18n/equipe";
import {
  choisirTraduction,
  estLangueClient,
  estLangueEquipe,
  FICHES_LANGUES,
  nomDeLangue,
  type LangueClient,
} from "@/lib/langues";
import { envoyerNotification } from "@/lib/notifications/whatsapp";
import { traducteurClient } from "@/lib/i18n/client";
import { iaConfiguree } from "@/lib/ia/client";
import { traduireTextes } from "@/lib/ia/traduction";
import type { ArticleRefuseVue, DemandeVue, TexteDemande, TexteLigne, Textes } from "@/lib/types";
import { avecTour } from "@/lib/verrou-conversation";
import type { Departement, Prisma, TypeDemande } from "@/generated/prisma/client";

const genererJeton = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 16);

// Une proposition non confirmée expire : on ne valide pas une commande vieille de deux heures.
const VALIDITE_PROPOSITION_MS = 30 * 60 * 1000;
// Une carte identique encore en attente de confirmation n'est pas reproposée
const FENETRE_DOUBLON_MS = 15 * 60 * 1000;
const LONGUEUR_MAX_REPONSE = 1000;

/** Texte rédigé par le modèle pour l'équipe (fr, en) et pour le client (sa langue). */
export type TexteMultilingue = { fr: string; en: string; client?: string };

/** Message de l'équipe au client, enregistré sur la demande qu'il concerne. */
type MessageEquipe = {
  messageId: string;
  auteur?: "equipe" | "lalla"; // « lalla » : message rédigé par Lalla (explication d'une annulation)
  original: string; // dans la langue de l'équipe
  traductions: Partial<Record<string, string>>; // { <langue du client>: texte }
  le: string;
};

export type Rattachement = {
  hotelId: string;
  chambreId: string;
  sejourId: string | null;
  conversationId: string;
};

const inclusionLignes = { lignes: true } satisfies Prisma.DemandeInclude;
type DemandeAvecLignes = Prisma.DemandeGetPayload<{
  include: typeof inclusionLignes;
}>;

// Langues dans lesquelles une demande est rédigée
const languesDemande = (langueClient: string) => [...new Set(["fr", "en", langueClient])];

function dansLangue(texte: TexteMultilingue | undefined, langue: string): string | null {
  if (!texte) return null;
  const valeur = langue === "fr" ? texte.fr : langue === "en" ? texte.en : (texte.client ?? texte.en);
  return valeur.trim() || null;
}

export function versVue(demande: DemandeAvecLignes): DemandeVue {
  const traductions = demande.traductions as Partial<Record<string, TexteDemande>>;
  return {
    id: demande.id,
    type: demande.type,
    departement: demande.departement,
    statut: demande.statut,
    langueClient: demande.langueClient,
    urgent: demande.urgent,
    montantTotal: demande.montantTotal,
    creeLe: demande.creeLe.toISOString(),
    prevueLe: demande.prevueLe?.toISOString() ?? null,
    refuses: (demande.articlesRefuses ?? []) as ArticleRefuseVue[],
    textes: {
      ...traductions,
      fr: { resume: demande.resume, details: demande.details },
    } as Textes<TexteDemande>,
    reponse: demande.reponse
      ? {
          original: demande.reponse,
          traductions: demande.reponseTraductions as Partial<Record<string, string>>,
          messageId: demande.reponseMessageId,
          le: demande.termineeLe?.toISOString() ?? null,
          retenue: demande.reponseRetenue,
        }
      : null,
    messagesEquipe: ((demande.messagesEquipe ?? []) as MessageEquipe[]).map(
      ({ messageId, auteur, original, traductions }) => ({
        messageId,
        auteur: auteur ?? "equipe",
        original,
        traductions,
      }),
    ),
    // Confirmée puis annulée sans que le client ne l'ait fait lui-même : déclinée par l'hôtel
    declinee: demande.statut === "ANNULEE" && demande.confirmeeLe !== null && !demande.annuleeParClient,
    // Déclinée : l'instant du message d'excuse que Lalla dépose dans la conversation
    decideeLe:
      demande.termineeLe?.toISOString() ??
      (demande.statut === "ANNULEE" ? ((demande.messagesEquipe ?? []) as MessageEquipe[]).at(-1)?.le : null) ??
      null,
    lignes: demande.lignes.map((ligne) => ({
      quantite: ligne.quantite,
      prixUnitaire: ligne.prixUnitaire,
      textes: {
        ...(ligne.traductions as Partial<Record<string, TexteLigne>>),
        fr: { libelle: ligne.libelle, remarque: ligne.remarque },
      } as Textes<TexteLigne>,
    })),
  };
}

export type LigneCommande = {
  articleId: string;
  quantite: number;
  remarque?: TexteMultilingue;
};

/** Jour (« AAAA-MM-JJ ») et heure facultative (« HH:MM ») choisis par le client, à l'heure de l'hôtel. */
export type Moment = { jour: string; heure?: string };

/** « Pour le jeudi 29 octobre à 10:00 », dans les langues d'une demande (fr et en pour l'équipe, celle du client). */
export function textesMoment(langueClient: string, { jour, heure }: Moment, fuseau: string): TexteMultilingue {
  const instant = instantLocal(jour, heure ?? "12:00", fuseau);
  const pour = (langue: string) => {
    const code = estLangueClient(langue) ? langue : "fr";
    const date = new Intl.DateTimeFormat(FICHES_LANGUES[code].locale, {
      timeZone: fuseau,
      weekday: "long",
      day: "numeric",
      month: "long",
      ...(heure ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(instant);
    return traducteurClient(code)("reservationPour", { date });
  };
  return { fr: pour("fr"), en: pour("en"), client: pour(langueClient) };
}

/** Le moment choisi, suivi de la précision éventuelle du client. */
function avecPrecision(moment: TexteMultilingue, precision: TexteMultilingue | undefined): TexteMultilingue {
  if (!precision) return moment;
  return {
    fr: `${moment.fr} — ${precision.fr}`,
    en: `${moment.en} — ${precision.en}`,
    client: `${moment.client} — ${precision.client ?? precision.en}`,
  };
}

export type OptionsCommande = {
  note?: TexteMultilingue;
  heureSouhaitee?: string; // « 08:00 » : commande programmée, à l'heure de l'hôtel
  reservation?: Moment; // réservation choisie dans l'interface (excursion, soin, transfert)
  ignorerDoublons?: boolean; // panier envoyé par le client lui-même : jamais écarté comme doublon
};

export type ResultatCommande =
  | {
      ok: true;
      demandes: DemandeVue[];
      doublons: number;
      refuses: ArticleRefuseVue[];
    }
  | { ok: false; erreur: string; refuses: ArticleRefuseVue[] };

type ArticleAvecCategorie = Prisma.ArticleCatalogueGetPayload<{
  include: { categorie: true };
}>;

/**
 * Prépare une ou plusieurs commandes à partir d'articles du catalogue.
 * Une commande qui mêle plusieurs services (un plat et un massage) est
 * découpée : chaque service reçoit uniquement ce qui le concerne.
 * Un article indisponible ou hors des horaires de son service n'est pas ajouté :
 * la carte le nomme, avec la raison ; si aucun article ne passe, rien n'est créé.
 */
export async function proposerCommande(
  rattachement: Rattachement,
  langueClient: string,
  lignes: LigneCommande[],
  { note: noteClient, heureSouhaitee, reservation, ignorerDoublons = false }: OptionsCommande = {},
): Promise<ResultatCommande> {
  const [articles, { fuseauHoraire }] = await Promise.all([
    bdd.articleCatalogue.findMany({
      where: {
        hotelId: rattachement.hotelId,
        id: { in: lignes.map((ligne) => ligne.articleId) },
      },
      include: { categorie: true },
    }),
    bdd.hotel.findUniqueOrThrow({
      where: { id: rattachement.hotelId },
      select: { fuseauHoraire: true },
    }),
  ]);
  const parId = new Map(articles.map((article) => [article.id, article]));

  if (lignes.some((ligne) => !parId.has(ligne.articleId))) {
    return {
      ok: false,
      erreur: "Article inconnu dans le catalogue.",
      refuses: [],
    };
  }

  const langues = languesDemande(langueClient);
  const nomDans = (article: ArticleAvecCategorie, langue: string) =>
    choisirTraduction(article.traductions as Partial<Record<string, { nom: string }>>, langue, { nom: article.nom })
      .nom;

  // Indisponible, ou hors des horaires du service : refusé ici, quoi qu'ait proposé le modèle.
  // Une réservation sans heure (excursion à la journée) ne dépend pas de l'heure actuelle.
  const heureVoulue = reservation ? reservation.heure : heureSouhaitee;
  const horairesAVerifier = !reservation || Boolean(reservation.heure);
  const refus = new Map<string, ArticleRefuseVue["raison"]>();
  for (const article of articles) {
    if (!article.disponible) refus.set(article.id, "indisponible");
    else if (horairesAVerifier && etatOuverture(article.categorie.horaires, fuseauHoraire, { heureVoulue }) === "ferme")
      refus.set(article.id, "ferme");
  }
  const refusesParService = [...refus].map(([id, raison]) => {
    const article = parId.get(id)!;
    const refuse: ArticleRefuseVue = {
      libelle: Object.fromEntries(langues.map((langue) => [langue, nomDans(article, langue)])) as Textes<string>,
      raison,
      horaires: article.categorie.horaires,
    };
    return { departement: article.categorie.departement, refuse };
  });
  const refuses = refusesParService.map(({ refuse }) => refuse);

  const acceptees = lignes.filter((ligne) => !refus.has(ligne.articleId));
  if (acceptees.length === 0) {
    return {
      ok: false,
      erreur: explicationRefus(refus, parId, fuseauHoraire, heureSouhaitee),
      refuses,
    };
  }

  // Réservation ou commande programmée : le moment voulu figure en tête de la note, pour l'équipe comme pour le client
  const note: TexteMultilingue | undefined = reservation
    ? avecPrecision(textesMoment(langueClient, reservation, fuseauHoraire), noteClient)
    : heureSouhaitee
      ? {
          fr: [`Souhaitée pour ${heureSouhaitee}`, noteClient?.fr].filter(Boolean).join(" — "),
          en: [`Requested for ${heureSouhaitee}`, noteClient?.en].filter(Boolean).join(" — "),
          ...(noteClient?.client ? { client: `${heureSouhaitee} — ${noteClient.client}` } : {}),
        }
      : noteClient;
  // Réservée ou programmée : l'heure annoncée au client est celle qu'il a choisie
  const prevueLe = reservation?.heure
    ? instantLocal(reservation.jour, reservation.heure, fuseauHoraire)
    : heureSouhaitee
      ? prochainInstant(heureSouhaitee, fuseauHoraire)
      : null;

  const parDepartement = Map.groupBy(acceptees, (ligne) => parId.get(ligne.articleId)!.categorie.departement);
  const demandes: DemandeVue[] = [];
  const enAttente = ignorerDoublons ? [] : await propositionsEnAttente(rattachement);
  let doublons = 0;
  // Les articles refusés s'affichent sur la carte de leur service, à défaut sur la dernière carte créée
  let refusesAPlacer = refusesParService;
  const services = [...parDepartement.keys()];

  for (const [departement, lignesService] of parDepartement) {
    // La même commande attend déjà sa confirmation : on ne l'affiche pas deux fois
    const signature = signatureLignes(lignesService);
    if (enAttente.some((d) => d.type === "COMMANDE" && signatureLignes(d.lignes) === signature)) {
      doublons++;
      continue;
    }

    const lignesCompletes = lignesService.map((ligne) => {
      const article = parId.get(ligne.articleId)!;
      const textes = Object.fromEntries(
        langues.map((langue) => [
          langue,
          {
            libelle: nomDans(article, langue),
            remarque: dansLangue(ligne.remarque, langue),
          } satisfies TexteLigne,
        ]),
      ) as Record<string, TexteLigne>;
      return { article, quantite: ligne.quantite, textes };
    });

    const textesDemande = Object.fromEntries(
      langues.map((langue) => [
        langue,
        {
          resume: lignesCompletes.map((l) => `${l.quantite} × ${l.textes[langue].libelle}`).join(", "),
          details: dansLangue(note, langue),
        } satisfies TexteDemande,
      ]),
    ) as Record<string, TexteDemande>;

    const derniere = departement === services.at(-1);
    const refusesIci = refusesAPlacer.filter((r) => r.departement === departement || derniere);
    refusesAPlacer = refusesAPlacer.filter((r) => !refusesIci.includes(r));

    const demande = await bdd.demande.create({
      data: {
        ...rattachement,
        type: "COMMANDE",
        departement,
        langueClient,
        resume: textesDemande.fr.resume,
        details: textesDemande.fr.details,
        traductions: textesDemande,
        montantTotal: lignesCompletes.reduce((total, l) => total + l.quantite * l.article.prix, 0),
        jetonPersonnel: genererJeton(),
        articlesRefuses: refusesIci.map(({ refuse }) => refuse),
        prevueLe,
        lignes: {
          create: lignesCompletes.map((l) => ({
            articleId: l.article.id,
            libelle: l.textes.fr.libelle,
            remarque: l.textes.fr.remarque,
            quantite: l.quantite,
            prixUnitaire: l.article.prix,
            traductions: l.textes,
          })),
        },
      },
      include: inclusionLignes,
    });
    demandes.push(versVue(demande));
  }

  return { ok: true, demandes, doublons, refuses };
}

/** Pourquoi aucun article n'a pu être ajouté, pour le modèle (qui l'explique au client). */
function explicationRefus(
  refus: Map<string, ArticleRefuseVue["raison"]>,
  parId: Map<string, ArticleAvecCategorie>,
  fuseauHoraire: string,
  heureSouhaitee: string | undefined,
): string {
  const articles = (raison: ArticleRefuseVue["raison"]) =>
    [...refus].filter(([, r]) => r === raison).map(([id]) => parId.get(id)!);
  const indisponibles = articles("indisponible");
  const fermes = articles("ferme");
  const phrases: string[] = [];
  if (indisponibles.length > 0) {
    phrases.push(`Indisponible actuellement : ${indisponibles.map((a) => a.nom).join(", ")}.`);
  }
  if (fermes.length > 0) {
    const moment = heureSouhaitee
      ? `à ${heureSouhaitee}`
      : `en ce moment (il est ${heureHotel(fuseauHoraire)} à l'hôtel)`;
    phrases.push(
      `Service fermé ${moment} : ${fermes.map((a) => `${a.nom} (service ${a.categorie.horaires})`).join(", ")}. Aucune carte affichée. Dis-le au client avec l'horaire d'ouverture et propose une alternative ouverte maintenant, ou une commande programmée dans les horaires (heure_souhaitee).`,
    );
  }
  return phrases.join(" ");
}

/**
 * Panier envoyé par le client depuis la carte du room service : la commande est créée et
 * transmise aussitôt (le récapitulatif vaut confirmation), sans passer par le modèle.
 */
export async function commanderDirectement(
  rattachement: Rattachement,
  langueClient: string,
  lignes: LigneCommande[],
  reservation?: Moment,
  precision?: string, // précision libre du client (numéro de vol…), citée telle quelle
): Promise<ResultatCommande> {
  const note = precision ? { fr: `« ${precision} »`, en: `“${precision}”`, client: `« ${precision} »` } : undefined;
  const resultat = await proposerCommande(rattachement, langueClient, lignes, {
    reservation,
    note,
    ignorerDoublons: true,
  });
  if (!resultat.ok) return resultat;
  const transmises = await Promise.all(
    resultat.demandes.map(
      async (demande) => (await deciderDemande(rattachement.chambreId, demande.id, "confirmer")) ?? demande,
    ),
  );
  return { ...resultat, demandes: transmises };
}

/** Propositions encore en attente de confirmation dans cette conversation. */
export function propositionsEnAttente(rattachement: Rattachement) {
  return bdd.demande.findMany({
    where: {
      conversationId: rattachement.conversationId,
      statut: "PROPOSEE",
      creeLe: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) },
    },
    include: inclusionLignes,
  });
}

export const signatureLignes = (lignes: { articleId: string | null; quantite: number }[]) =>
  lignes
    .map((ligne) => `${ligne.articleId}×${ligne.quantite}`)
    .sort()
    .join("|");

export type CategorieService =
  "linge" | "menage" | "maintenance" | "reveil" | "transport" | "conciergerie" | "question" | "autre";

// Routage des demandes hors catalogue vers le service compétent
const ROUTAGE_SERVICES: Record<CategorieService, { type: TypeDemande; departement: Departement }> = {
  linge: { type: "SERVICE", departement: "ETAGES" },
  menage: { type: "SERVICE", departement: "ETAGES" },
  maintenance: { type: "INCIDENT", departement: "TECHNIQUE" },
  reveil: { type: "SERVICE", departement: "RECEPTION" },
  transport: { type: "SERVICE", departement: "CONCIERGERIE" },
  conciergerie: { type: "SERVICE", departement: "CONCIERGERIE" },
  question: { type: "QUESTION", departement: "RECEPTION" },
  autre: { type: "SERVICE", departement: "RECEPTION" },
};

/** Type et service auxquels une catégorie de demande est confiée. */
export const routageService = (categorie: CategorieService) => ROUTAGE_SERVICES[categorie];

const comparable = (texte: string) =>
  texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Même intitulé, à la casse, aux accents et à la ponctuation près. */
export const memeIntitule = (a: string, b: string) => comparable(a) === comparable(b);

/**
 * Prépare une demande de service, un signalement d'incident ou une question.
 * `doublon` : la même carte (même service, même intitulé) attend déjà la confirmation
 * du client, c'est elle qui est renvoyée (rien n'est créé). Une autre question ou un autre
 * service du même département n'est jamais un doublon.
 */
export async function proposerService(
  rattachement: Rattachement,
  langueClient: string,
  categorie: CategorieService,
  resume: TexteMultilingue,
  details: TexteMultilingue | undefined,
  urgent: boolean,
  // Formulaire rempli par le client : jamais écarté comme doublon ; heure annoncée (réveil, taxi)
  { ignorerDoublons = false, prevueLe = null }: { ignorerDoublons?: boolean; prevueLe?: Date | null } = {},
): Promise<{ demande: DemandeVue; doublon: boolean }> {
  const { type, departement } = ROUTAGE_SERVICES[categorie];
  const resumeFr = (dansLangue(resume, "fr") ?? resume.fr).slice(0, 200);
  const existante = ignorerDoublons
    ? undefined
    : (await propositionsEnAttente(rattachement)).find(
        (d) =>
          d.type === type && d.departement === departement && d.urgent === urgent && memeIntitule(d.resume, resumeFr),
      );
  if (existante) return { demande: versVue(existante), doublon: true };

  const textes = Object.fromEntries(
    languesDemande(langueClient).map((langue) => [
      langue,
      {
        resume: dansLangue(resume, langue) ?? resume.fr,
        details: dansLangue(details, langue),
      } satisfies TexteDemande,
    ]),
  ) as Record<string, TexteDemande>;

  const demande = await bdd.demande.create({
    data: {
      ...rattachement,
      type,
      departement,
      langueClient,
      resume: textes.fr.resume.slice(0, 200),
      details: textes.fr.details?.slice(0, 600) ?? null,
      traductions: textes,
      urgent,
      prevueLe,
      jetonPersonnel: genererJeton(),
    },
    include: inclusionLignes,
  });
  return { demande: versVue(demande), doublon: false };
}

/**
 * Le client confirme (ou annule) une proposition depuis SA chambre. Une demande déjà
 * transmise reste annulable tant que l'équipe ne l'a pas acceptée (sauf une urgence).
 */
export async function deciderDemande(
  chambreId: string,
  demandeId: string,
  decision: "confirmer" | "annuler",
): Promise<DemandeVue | null> {
  const demande = await bdd.demande.findFirst({
    where: {
      id: demandeId,
      chambreId,
      statut: { in: ["PROPOSEE", "CONFIRMEE"] },
    },
    include: {
      ...inclusionLignes,
      chambre: true,
      hotel: { include: { services: true } },
    },
  });
  if (!demande) return null;

  if (decision === "annuler") {
    const transmise = demande.statut === "CONFIRMEE";
    if (transmise && (demande.urgent || demande.type === "QUESTION")) return null;
    // Conditionnelle : l'équipe a pu accepter entre-temps
    const { count } = await bdd.demande.updateMany({
      where: { id: demande.id, statut: demande.statut },
      data: { statut: "ANNULEE", annuleeParClient: transmise },
    });
    if (count === 0) return null;
    if (transmise) prevenirAnnulationClient(demande);
    return versVue(
      await bdd.demande.findUniqueOrThrow({
        where: { id: demande.id },
        include: inclusionLignes,
      }),
    );
  }

  if (demande.statut !== "PROPOSEE" || Date.now() - demande.creeLe.getTime() > VALIDITE_PROPOSITION_MS) return null;

  // Conditionnelle : deux confirmations simultanées (double appui, deux téléphones) ne notifient qu'une fois
  const { count } = await bdd.demande.updateMany({
    where: { id: demande.id, statut: "PROPOSEE" },
    data: { statut: "CONFIRMEE", confirmeeLe: new Date() },
  });
  if (count === 0) return null;
  const confirmee = await bdd.demande.findUniqueOrThrow({
    where: { id: demande.id },
    include: inclusionLignes,
  });

  // Destinataire : numéro dédié du service, sinon la réception
  const { hotel } = demande;
  const service = hotel.services.find((s) => s.departement === demande.departement);
  const destinataire = (service?.actif && service.whatsapp) || hotel.whatsappReception;

  // La notification ne doit jamais faire échouer la confirmation côté client :
  // la demande reste visible dans l'espace hôtel quoi qu'il arrive.
  if (destinataire) {
    const vue = versVue(confirmee);
    const langueEquipe = estLangueEquipe(hotel.langueEquipe) ? hotel.langueEquipe : "fr";
    const t = traducteurEquipe(langueEquipe);
    const textes = choisirTraduction(vue.textes, langueEquipe, vue.textes.fr);

    const details =
      vue.type === "COMMANDE"
        ? [
            ...vue.lignes.map((ligne) => {
              const texte = choisirTraduction(ligne.textes, langueEquipe, ligne.textes.fr);
              return `${ligne.quantite} × ${texte.libelle}${texte.remarque ? ` (${texte.remarque})` : ""}`;
            }),
            `${t("total")} ${formaterPrix(vue.montantTotal, hotel.devise, langueEquipe)}`,
          ]
        : [textes.resume];
    if (textes.details) details.push(`${t("note")} ${textes.details}`);
    if (vue.langueClient !== langueEquipe && estLangueClient(vue.langueClient)) {
      details.push(
        t("languesClient", {
          langue: nomDeLangue(vue.langueClient, langueEquipe),
        }),
      );
    }

    enArrierePlan("notification", async () => {
      const envoyee = await envoyerNotification({
        destinataire,
        titre: `${vue.urgent ? `🔴 ${t("urgent").toUpperCase()} · ` : ""}${t("chambre")} ${demande.chambre.numero} · ${t(cleType(vue.type))} · ${t(cleDepartement(vue.departement))}`,
        details,
        lien: `${env.URL_PUBLIQUE}/p/${demande.jetonPersonnel}`,
      });
      if (envoyee)
        await bdd.demande.update({
          where: { id: demande.id },
          data: { notifiee: true },
        });
    });
  }

  return versVue(confirmee);
}

/** L'équipe prévenue par WhatsApp d'une demande transmise : elle apprend aussi son annulation. */
function prevenirAnnulationClient(demande: {
  id: string;
  departement: Departement;
  notifiee: boolean;
  jetonPersonnel: string;
  resume: string;
  traductions: unknown;
  chambre: { numero: string };
  hotel: {
    langueEquipe: string;
    whatsappReception: string | null;
    services: {
      departement: Departement;
      actif: boolean;
      whatsapp: string | null;
    }[];
  };
}) {
  if (!demande.notifiee) return;
  const { hotel } = demande;
  const service = hotel.services.find((s) => s.departement === demande.departement);
  const destinataire = (service?.actif && service.whatsapp) || hotel.whatsappReception;
  if (!destinataire) return;
  const langueEquipe = estLangueEquipe(hotel.langueEquipe) ? hotel.langueEquipe : "fr";
  const t = traducteurEquipe(langueEquipe);
  const traductions = demande.traductions as Partial<Record<string, TexteDemande>>;
  const resume = choisirTraduction(traductions, langueEquipe, {
    resume: demande.resume,
    details: null,
  }).resume;
  enArrierePlan("notification d'annulation", () =>
    envoyerNotification({
      destinataire,
      titre: `${t("chambre")} ${demande.chambre.numero} · ${t("annuleeParClient")}`,
      details: [resume],
      lien: `${env.URL_PUBLIQUE}/p/${demande.jetonPersonnel}`,
    }),
  );
}

/** Statut courant des demandes d'une chambre (suivi en direct côté client). */
export async function statutsDemandes(chambreId: string, ids: string[]): Promise<DemandeVue[]> {
  const demandes = await bdd.demande.findMany({
    where: { chambreId, id: { in: ids.slice(0, 20) } },
    include: inclusionLignes,
  });
  return demandes.map(versVue);
}

export type DecisionCommande = "accepter" | "annuler";

type DelaisHotel = {
  delaiRestauration: number | null;
  delaiEtages: number | null;
  delaiTechnique: number | null;
};

/** Délai habituel (minutes) d'un service entre l'acceptation et l'arrivée ; null : aucune heure annoncée. */
function delaiHabituel(hotel: DelaisHotel, departement: Departement): number | null {
  if (departement === "RESTAURATION") return hotel.delaiRestauration;
  if (departement === "ETAGES") return hotel.delaiEtages;
  if (departement === "TECHNIQUE") return hotel.delaiTechnique;
  return null; // réception, conciergerie, bien-être : rendez-vous ou horaires propres à chaque demande
}

/**
 * Décision de l'équipe sur une commande ou une demande (tout sauf une question) :
 * l'accepter, ou l'annuler. L'annulation est expliquée au client par Lalla, en
 * une phrase brève et professionnelle, dans sa langue.
 */
export async function deciderCommande(
  demandeId: string,
  hotelId: string,
  decision: DecisionCommande,
): Promise<boolean> {
  const demande = await bdd.demande.findFirst({
    where: {
      id: demandeId,
      hotelId,
      type: { not: "QUESTION" },
      statut: { in: ["CONFIRMEE", "PRISE_EN_CHARGE"] },
    },
    include: {
      hotel: {
        select: {
          delaiRestauration: true,
          delaiEtages: true,
          delaiTechnique: true,
        },
      },
    },
  });
  if (!demande) return false;
  const maintenant = new Date();

  if (decision === "accepter") {
    // Heure annoncée au client : celle qu'il a choisie (commande programmée), sinon le délai habituel du service
    const delai = delaiHabituel(demande.hotel, demande.departement);
    const prevueLe = demande.prevueLe ?? (delai ? new Date(maintenant.getTime() + delai * 60_000) : null);
    // Garde d'état : si un collègue a agi entre-temps, rien n'est écrasé
    const { count } = await bdd.demande.updateMany({
      where: { id: demande.id, statut: demande.statut },
      data: {
        statut: "TERMINEE",
        termineeLe: maintenant,
        priseEnChargeLe: demande.priseEnChargeLe ?? maintenant,
        prevueLe,
      },
    });
    return count === 1;
  }

  const { count } = await bdd.demande.updateMany({
    where: { id: demande.id, statut: demande.statut },
    data: { statut: "ANNULEE" },
  });
  if (count !== 1) return false;
  const langueClient = estLangueClient(demande.langueClient) ? demande.langueClient : "fr";
  const traductions = demande.traductions as Partial<Record<string, TexteDemande>>;
  const resume = traductions[langueClient]?.resume ?? demande.resume;
  const explication = traducteurClient(langueClient)("annulationParReception", {
    resume,
  });
  const message = await inscrireMessage(demande, explication, langueClient, maintenant, "lalla", explication);
  await bdd.demande.update({
    where: { id: demande.id },
    data: {
      messagesEquipe: [...(demande.messagesEquipe as MessageEquipe[]), message],
    },
  });
  return true;
}

/**
 * Réponse de l'équipe à une question, écrite dans sa langue : Lalla la traduit et la
 * dépose dans la conversation du client, et la question est close.
 */
export async function repondreQuestion(
  demandeId: string,
  hotelId: string,
  texte: string,
  langueEquipe: string,
): Promise<boolean> {
  const contenu = texte.trim().slice(0, LONGUEUR_MAX_REPONSE);
  if (!contenu) return false;
  const question = await bdd.demande.findFirst({
    where: {
      id: demandeId,
      hotelId,
      type: "QUESTION",
      statut: { in: ["CONFIRMEE", "PRISE_EN_CHARGE"] },
    },
  });
  if (!question) return false;

  // Traduite d'abord (sans effet de bord), puis la question est réservée par une écriture
  // conditionnelle : deux réponses simultanées n'en transmettent qu'une au client
  const { langueClient, pourLeClient } = await traduirePourClient(question.langueClient, contenu, langueEquipe);
  const maintenant = new Date();
  const { count } = await bdd.demande.updateMany({
    where: { id: question.id, statut: question.statut },
    data: {
      statut: "TERMINEE",
      termineeLe: maintenant,
      priseEnChargeLe: question.priseEnChargeLe ?? maintenant,
      reponse: contenu,
      reponseTraductions: { [langueClient]: pourLeClient },
    },
  });
  if (count !== 1) return false;

  const message = await inscrireMessage(question, pourLeClient, langueClient, maintenant, "equipe", contenu);
  await bdd.demande.update({
    where: { id: question.id },
    data: {
      reponseMessageId: message.messageId,
      messagesEquipe: [...(question.messagesEquipe as MessageEquipe[]), message],
    },
  });
  // Réponse utile à d'autres clients : Lalla la retient et répondra seule la prochaine fois
  enArrierePlan("apprentissage", () => apprendreDeLaReponse(question.id));
  return true;
}

// Mots qui ne disent rien du sujet d'une question (« avez-vous », « est-ce qu'il y a »…)
// prettier-ignore
const MOTS_SANS_SUJET = new Set([
  "est", "que", "qui", "quoi", "quel", "quelle", "quels", "quelles", "vous", "avez", "avoir", "pouvez", "peut", "peux",
  "pourriez", "une", "des", "les", "pour", "dans", "sur", "avec", "par", "hotel", "lhotel", "ici", "ilya", "trouve",
  "trouver", "existe", "possible", "faut", "aussi", "encore", "savoir", "demander", "reception", "votre", "vos",
  "nous", "moi", "mon", "mes", "the", "you", "have", "there", "any", "can", "could", "what", "where", "how", "when",
  "does", "your", "are", "hay", "tiene", "tienen", "donde", "avete", "dove", "gibt", "haben", "tem", "onde",
]);

const sujetQuestion = (texte: string) =>
  new Set(
    comparable(texte)
      .split(" ")
      .filter((mot) => mot.length >= 3 && !MOTS_SANS_SUJET.has(mot))
      .map((mot) => mot.replace(/s$/, "")),
  );

/** Deux questions portent sur le même sujet : leurs mots porteurs se recouvrent largement. */
function memeSujet(a: string, b: string): boolean {
  const sujetA = sujetQuestion(a);
  const sujetB = sujetQuestion(b);
  const communs = [...sujetA].filter((mot) => sujetB.has(mot)).length;
  return communs > 0 && communs >= Math.ceil(Math.min(sujetA.size, sujetB.size) * 0.6);
}

/**
 * Question du client déjà posée à la réception, et répondue, pendant ce séjour (ou dans cette
 * conversation sans séjour) : la réponse de l'équipe dans la langue demandée, null sinon (ou si
 * elle n'existe pas dans cette langue).
 */
export async function reponseDejaDonnee(
  rattachement: Rattachement,
  question: string,
  langue: string,
): Promise<string | null> {
  const repondues = await bdd.demande.findMany({
    where: {
      chambreId: rattachement.chambreId,
      ...(rattachement.sejourId
        ? { sejourId: rattachement.sejourId }
        : { conversationId: rattachement.conversationId }),
      type: "QUESTION",
      statut: "TERMINEE",
      reponse: { not: null },
    },
    orderBy: { termineeLe: "desc" },
    take: 20,
    select: { resume: true, details: true, traductions: true, reponse: true, reponseTraductions: true },
  });
  const trouvee = repondues.find((demande) => {
    const textes = Object.values(demande.traductions as Record<string, TexteDemande>).map((texte) => texte.resume);
    return [demande.resume, ...textes].some((intitule) => memeSujet(intitule, question));
  });
  if (!trouvee?.reponse) return null;
  const traduites = trouvee.reponseTraductions as Partial<Record<string, string>>;
  return traduites[langue] ?? (langue === "fr" ? trouvee.reponse : null);
}

/** Texte de l'équipe dans la langue du client ; la traduction n'empêche jamais le message d'arriver. */
async function traduirePourClient(langueDemande: string, contenu: string, langueSource: string) {
  const langueClient = estLangueClient(langueDemande) ? langueDemande : "fr";
  let pourLeClient = contenu;
  if (langueClient !== langueSource && iaConfiguree()) {
    try {
      [pourLeClient] = await traduireTextes([contenu], langueClient);
    } catch (erreur) {
      console.error("[demandes] traduction du message impossible", erreur);
    }
  }
  return { langueClient, pourLeClient };
}

/**
 * Ajoute à la conversation du client un message déjà dans sa langue (Lalla le transmet).
 * Pris dans le tour de la conversation : jamais au milieu d'une réponse de Lalla.
 */
async function inscrireMessage(
  demande: { conversationId: string | null },
  pourLeClient: string,
  langueClient: LangueClient,
  maintenant: Date,
  auteur: MessageEquipe["auteur"],
  original: string,
): Promise<MessageEquipe> {
  // Le modèle relira ce message dans l'historique : il sait ce qui vient de l'équipe
  const pourLeModele =
    auteur === "equipe" ? `${traducteurClient(langueClient)("reponseReception")} : ${pourLeClient}` : pourLeClient;
  let messageId = `sans-conversation-${maintenant.getTime()}`;
  const conversationId = demande.conversationId;
  if (conversationId) {
    messageId = await avecTour(
      conversationId,
      async () => {
        const message = await bdd.message.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            contenu: [{ type: "text", text: pourLeModele }] as Prisma.InputJsonValue,
            texte: pourLeClient,
          },
          select: { id: true },
        });
        await bdd.conversation.update({
          where: { id: conversationId },
          data: { dernierMessageLe: maintenant },
        });
        return message.id;
      },
      // Un message de la réception arrive toujours, au pire après le tour en cours
      { attenteMaxMs: 30 * 1000, forcer: true },
    );
  }
  return {
    messageId,
    auteur,
    original,
    traductions: { [langueClient]: pourLeClient },
    le: maintenant.toISOString(),
  };
}
