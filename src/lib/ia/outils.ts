// Outils mis à la disposition du modèle, et leur exécution côté serveur.
// Toute entrée produite par le modèle est revalidée (Zod) avant usage :
// avec le streaming anticipé des entrées, l'API ne la valide plus elle-même.
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { bdd } from "@/lib/bdd";
import {
  deciderDemande,
  proposerCommande,
  proposerService,
  reponseDejaDonnee,
  type Rattachement,
} from "@/lib/demandes";
import { estQuestion, mentionne, MOTS, normaliser, type MotsCles } from "@/lib/ia/secours/comprehension";
import { rechercherConnaissance } from "@/lib/rag/recherche";
import type { EvenementFlux } from "@/lib/types";

type Outil = Anthropic.Beta.BetaTool;

// Un texte destiné à l'équipe (français ET anglais) et au client (sa langue)
const SCHEMA_TEXTE_MULTILINGUE = {
  type: "object",
  properties: {
    fr: { type: "string", description: "En français" },
    en: { type: "string", description: "En anglais" },
    client: {
      type: "string",
      description: "Dans la langue choisie par le client, uniquement si ce n'est ni le français ni l'anglais",
    },
  },
  required: ["fr", "en"],
} as const;

const CATEGORIES_SERVICE = ["linge", "menage", "maintenance", "reveil", "transport", "conciergerie", "autre"] as const;

const OUTIL_RECHERCHE: Outil = {
  name: "rechercher_informations",
  description:
    "Recherche dans la documentation officielle de l'hôtel (livret d'accueil, services, horaires, règles, activités, recommandations locales). À utiliser pour toute question sur l'hôtel dont la réponse n'est pas déjà dans tes informations. Formule la requête en français, langue des documents, avec les mots-clés essentiels.",
  input_schema: {
    type: "object",
    properties: {
      requete: {
        type: "string",
        description: "Requête en français, ex. « horaires piscine »",
      },
    },
    required: ["requete"],
  },
  eager_input_streaming: true,
};

const OUTILS_ACTION: Outil[] = [
  {
    name: "proposer_commande",
    description:
      "Prépare une commande d'articles du catalogue (repas, boissons, soins, excursions, transferts) et l'affiche au client sous forme de carte à confirmer. Rien n'est transmis tant que le client n'a pas confirmé. Chaque article est automatiquement envoyé au service concerné.",
    input_schema: {
      type: "object",
      properties: {
        articles: {
          type: "array",
          minItems: 1,
          maxItems: 15,
          items: {
            type: "object",
            properties: {
              reference: {
                type: "string",
                description: "Référence catalogue, ex. « A3 »",
              },
              quantite: { type: "integer", minimum: 1, maximum: 20 },
              remarque: {
                ...SCHEMA_TEXTE_MULTILINGUE,
                description: "Précision du client (cuisson, sans piment, heure souhaitée…)",
              },
            },
            required: ["reference", "quantite"],
          },
        },
        note: {
          ...SCHEMA_TEXTE_MULTILINGUE,
          description: "Note générale pour l'équipe",
        },
        heure_souhaitee: {
          type: "string",
          description:
            "Heure de service voulue « HH:MM » (heure de l'hôtel), seulement si le client commande pour plus tard (ex. petit-déjeuner de demain à 08:00). Doit tomber dans les horaires du service.",
        },
      },
      required: ["articles"],
    },
    eager_input_streaming: true,
  },
  {
    name: "demander_service",
    description:
      "Prépare une demande d'action hors catalogue (linge, ménage, réveil, transport, réparation, relance d'une demande en attente, réclamation) ou signale un incident, et l'affiche au client sous forme de carte à confirmer. La demande est envoyée au service concerné. Pour une simple question, utilise poser_question_reception.",
    input_schema: {
      type: "object",
      properties: {
        categorie: { type: "string", enum: [...CATEGORIES_SERVICE] },
        resume: {
          ...SCHEMA_TEXTE_MULTILINGUE,
          description: "Résumé court et précis, ex. « 2 serviettes de bain supplémentaires »",
        },
        details: {
          ...SCHEMA_TEXTE_MULTILINGUE,
          description: "Précisions utiles (horaire souhaité…)",
        },
        urgent: {
          type: "boolean",
          description: "Vrai uniquement en cas de danger ou de panne bloquante",
        },
      },
      required: ["categorie", "resume", "urgent"],
    },
    eager_input_streaming: true,
  },
  {
    name: "poser_question_reception",
    description:
      "Transmet à la réception une question dont la réponse n'est pas dans tes informations (disponibilité, renseignement local précis, cas particulier). Le client confirme l'envoi d'un geste ; la réponse de l'équipe s'affichera ensuite dans la carte, traduite dans sa langue. À n'utiliser que si le client souhaite qu'on pose la question et que tu sais précisément laquelle. La carte se suffit : n'écris rien autour.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          ...SCHEMA_TEXTE_MULTILINGUE,
          description:
            "La question même du client, telle qu'il la poserait, claire et brève, ex. « Y a-t-il une salle de sport à proximité ? ». Jamais une consigne à l'équipe (« contacter le client », « préciser sa demande »).",
        },
      },
      required: ["question"],
    },
    eager_input_streaming: true,
  },
  {
    name: "annuler_demande",
    description:
      "Annule une commande ou une demande du client, désignée par sa référence [D…] du contexte, tant que l'équipe ne l'a pas acceptée. Une demande déjà acceptée ne s'annule pas ici : l'outil l'indique.",
    input_schema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Référence de la demande, ex. « D4f9k2a »",
        },
      },
      required: ["reference"],
    },
    eager_input_streaming: true,
  },
  {
    name: "proposer_avis_sejour",
    description:
      "Affiche au client un court formulaire pour noter son séjour. À utiliser quand il exprime une appréciation globale du séjour ou annonce son départ.",
    input_schema: { type: "object", properties: {} },
    eager_input_streaming: true,
  },
];

/** Outils du tour ; la recherche seulement quand la documentation n'est pas déjà dans le prompt. */
export function outilsConcierge(rechercheNecessaire: boolean): Outil[] {
  return rechercheNecessaire ? [OUTIL_RECHERCHE, ...OUTILS_ACTION] : OUTILS_ACTION;
}

const texteMultilingue = (maximum: number) =>
  z.object({
    fr: z.string().min(1).max(maximum),
    en: z.string().min(1).max(maximum),
    client: z.string().max(maximum).optional(),
  });

const schemas = {
  rechercher_informations: z.object({ requete: z.string().min(2).max(300) }),
  proposer_commande: z.object({
    articles: z
      .array(
        z.object({
          reference: z.string().regex(/^A\d+$/),
          quantite: z.number().int().min(1).max(20),
          remarque: texteMultilingue(200).optional(),
        }),
      )
      .min(1)
      .max(15),
    note: texteMultilingue(400).optional(),
    heure_souhaitee: z
      .string()
      .regex(/^\d{1,2}:\d{2}$/)
      .optional(),
  }),
  poser_question_reception: z.object({ question: texteMultilingue(300) }),
  annuler_demande: z.object({
    reference: z.string().regex(/^\[?D?[a-z0-9]{4,12}\]?$/i),
  }),
  demander_service: z.object({
    categorie: z.enum(CATEGORIES_SERVICE),
    resume: texteMultilingue(200),
    details: texteMultilingue(600).optional(),
    urgent: z.boolean(),
  }),
};

export type EnvironnementOutils = {
  rattachement: Rattachement;
  langueClient: string;
  references: Map<string, string>;
  commandesAutorisees: boolean;
  telephoneReception: string | null;
  messageClient: string; // message du tour, pour reconnaître une question mal rangée
  messagePrecedent?: string | null; // message précédent du client : la question qu'il accepte de transmettre
  emettre: (evenement: EvenementFlux) => void;
  // Une carte se suffit à elle-même : le tour s'arrête là, sans commentaire du modèle (sauf urgence)
  carteAffichee?: boolean;
};

// Une demande « conciergerie » qui n'est qu'une demande de renseignement est une question :
// l'équipe doit pouvoir y répondre, pas seulement la « terminer »
const SIGNES_RENSEIGNEMENT =
  /(?<!\p{L})(savoir|renseign\p{L}*|information|emplacement|se trouve|où|est-il possible|y a-t-il|existe-t-il)(?!\p{L})/iu;

function estUneQuestion(resume: string, details: string | undefined, messageClient: string): boolean {
  return estQuestion(messageClient) || estQuestion(resume) || SIGNES_RENSEIGNEMENT.test(`${resume} ${details ?? ""}`);
}

// Une question ne part à la réception que si le client le souhaite : posée telle quelle (« y a-t-il une
// salle de sport ? »), elle appelle d'abord une réponse, ou l'offre de la transmettre
// prettier-ignore
const MOTS_TRANSMETTRE: MotsCles = [...MOTS.reception, "demand*", "renseign*", "verifi*", "ask", "find out", "check", "pregunt*", "chied*", "frag*", "pergunt*", "laaj", "اسأل"];

// « Oui », « d'accord, demandez » : le client accepte l'offre de transmettre sa question précédente
const accordSeul = (message: string) => {
  const texte = normaliser(message);
  return texte.split(" ").length <= 4 && mentionne(texte, MOTS.accord) && !mentionne(texte, MOTS.refus);
};

function transmissionSouhaitee(messageClient: string): boolean {
  return !estQuestion(messageClient) || mentionne(normaliser(messageClient), MOTS_TRANSMETTRE);
}

type ResultatOutil = { contenu: string; erreur?: boolean };

export async function executerOutil(
  appel: Anthropic.Beta.BetaToolUseBlock,
  env: EnvironnementOutils,
): Promise<ResultatOutil> {
  switch (appel.name) {
    case "rechercher_informations": {
      const entree = schemas.rechercher_informations.safeParse(appel.input);
      if (!entree.success) return entreeInvalide(entree.error);
      const resultats = await rechercherConnaissance(env.rattachement.hotelId, entree.data.requete);
      if (resultats.length === 0) {
        return {
          contenu: "Aucun passage pertinent dans la documentation de l'hôtel.",
        };
      }
      return { contenu: resultats.map((r) => r.contenu).join("\n\n---\n\n") };
    }

    case "proposer_commande": {
      const entree = schemas.proposer_commande.safeParse(appel.input);
      if (!entree.success) return entreeInvalide(entree.error);
      if (!env.commandesAutorisees) return commandesBloquees(env.telephoneReception);

      const lignes = [];
      for (const article of entree.data.articles) {
        const articleId = env.references.get(article.reference);
        if (!articleId)
          return {
            contenu: `Référence inconnue : ${article.reference}.`,
            erreur: true,
          };
        lignes.push({
          articleId,
          quantite: article.quantite,
          remarque: article.remarque,
        });
      }

      const resultat = await proposerCommande(env.rattachement, env.langueClient, lignes, {
        note: entree.data.note,
        heureSouhaitee: entree.data.heure_souhaitee,
      });
      if (!resultat.ok) return { contenu: resultat.erreur, erreur: true };

      for (const demande of resultat.demandes) env.emettre({ type: "demande", demande });
      if (resultat.demandes.length === 0) return { contenu: CARTE_DEJA_AFFICHEE };
      env.carteAffichee = true;
      const plusieurs = resultat.demandes.length > 1;
      // Les articles non ajoutés sont nommés sur la carte, avec leur raison : le client les voit
      const nonAjoutes = resultat.refuses.length
        ? ` Non ajouté (indiqué sur la carte) : ${resultat.refuses
            .map((r) => `${r.libelle.fr} (${r.raison === "ferme" ? `service fermé, ${r.horaires}` : "indisponible"})`)
            .join(", ")}.`
        : "";
      return {
        contenu: `${plusieurs ? `${resultat.demandes.length} cartes affichées (une par service concerné)` : "Carte de commande affichée"} au client avec le détail et le total : il la confirme d'un geste.${nonAjoutes}`,
      };
    }

    case "demander_service": {
      const entree = schemas.demander_service.safeParse(appel.input);
      if (!entree.success) return entreeInvalide(entree.error);
      const { categorie, resume, details, urgent } = entree.data;
      // Un incident urgent passe même sans séjour enregistré : la sécurité prime.
      if (!env.commandesAutorisees && !urgent) return commandesBloquees(env.telephoneReception);
      const question =
        categorie === "conciergerie" && !urgent && estUneQuestion(resume.fr, details?.fr, env.messageClient);

      const { demande, doublon } = await proposerService(
        env.rattachement,
        env.langueClient,
        question ? "question" : categorie,
        resume,
        details,
        urgent,
      );
      if (doublon) return { contenu: CARTE_DEJA_AFFICHEE };
      env.emettre({ type: "demande", demande });
      // Une urgence garde la parole : les consignes de sécurité passent avant tout
      if (!urgent) env.carteAffichee = true;
      return {
        contenu: "Carte de demande affichée au client : il la confirme d'un geste.",
      };
    }

    case "poser_question_reception": {
      const entree = schemas.poser_question_reception.safeParse(appel.input);
      if (!entree.success) return entreeInvalide(entree.error);
      if (!transmissionSouhaitee(env.messageClient)) {
        return {
          contenu:
            "Question non transmise : le client a seulement posé sa question, sans demander qu'elle parte à la réception. Dis-lui que tu n'as pas cette précision et propose de la poser à la réception ; s'il accepte, appelle alors poser_question_reception.",
          erreur: true,
        };
      }
      // Déjà posée et répondue pendant le séjour : la réponse de l'équipe, pas une nouvelle carte
      const dejaRepondue = await reponseDejaDonnee(env.rattachement, entree.data.question.fr, "fr");
      if (dejaRepondue) {
        return {
          contenu: `La réception a déjà répondu à cette question pendant le séjour : « ${dejaRepondue} ». Réponds au client d'après cette réponse, sans nouvelle carte.`,
          erreur: true,
        };
      }
      // La question même du client, mot pour mot, plutôt qu'une reformulation qui peut l'abîmer
      const precedente = env.messagePrecedent?.trim();
      const motPourMot =
        env.langueClient === "fr" && precedente && estQuestion(precedente) && accordSeul(env.messageClient)
          ? { ...entree.data.question, fr: precedente.slice(0, 300) }
          : entree.data.question;
      const { demande, doublon } = await proposerService(
        env.rattachement,
        env.langueClient,
        "question",
        motPourMot,
        undefined,
        false,
      );
      if (doublon) return { contenu: CARTE_DEJA_AFFICHEE };
      env.emettre({ type: "demande", demande });
      env.carteAffichee = true;
      return {
        contenu: "Carte de question affichée : le client confirme l'envoi d'un geste.",
      };
    }

    case "annuler_demande": {
      const entree = schemas.annuler_demande.safeParse(appel.input);
      if (!entree.success) return entreeInvalide(entree.error);
      const suffixe = entree.data.reference.replace(/^\[?D?/i, "").replace(/\]$/, "");
      const { chambreId, sejourId, conversationId } = env.rattachement;
      // Uniquement parmi les demandes de ce séjour (ou de cette conversation) : jamais celles d'un autre client
      const demande = await bdd.demande.findFirst({
        where: {
          chambreId,
          id: { endsWith: suffixe },
          ...(sejourId ? { sejourId } : { conversationId }),
        },
      });
      if (!demande)
        return {
          contenu: `Référence inconnue : ${entree.data.reference}.`,
          erreur: true,
        };
      if (demande.statut === "ANNULEE") return { contenu: "Cette demande est déjà annulée." };
      // Annulable tant que l'équipe ne l'a pas acceptée (une urgence ou une question transmise ne s'annule pas ici)
      const annulee = await deciderDemande(chambreId, demande.id, "annuler");
      if (!annulee) {
        return {
          contenu:
            "Annulation impossible ici : la demande a déjà été acceptée par l'équipe (ou c'est une urgence ou une question transmise). Si besoin, propose au client de prévenir la réception (demander_service, catégorie « autre »).",
        };
      }
      env.emettre({ type: "demande", demande: annulee });
      return {
        contenu: "Demande annulée, le client la voit comme telle. Confirme-le en une phrase.",
      };
    }

    case "proposer_avis_sejour": {
      env.emettre({ type: "avis" });
      return { contenu: "Formulaire d'avis affiché au client." };
    }

    default:
      return { contenu: `Outil inconnu : ${appel.name}`, erreur: true };
  }
}

// Même carte déjà proposée dans ce tour ou juste avant : on n'en affiche pas une seconde
const CARTE_DEJA_AFFICHEE =
  "Une carte identique est déjà affichée et attend la confirmation du client : n'en crée pas d'autre. Invite-le à la confirmer ; si le contenu doit changer, annule-la (annuler_demande) puis prépare la nouvelle.";

function entreeInvalide(erreur: z.ZodError): ResultatOutil {
  return {
    contenu: `Entrée invalide : ${erreur.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`,
    erreur: true,
  };
}

function commandesBloquees(telephone: string | null): ResultatOutil {
  return {
    contenu: `Impossible : aucun séjour actif n'est enregistré pour cette chambre. Invite le client à contacter la réception${
      telephone ? ` (${telephone})` : ""
    }.`,
    erreur: true,
  };
}
