// Moteur de conversation : un tour complet (message client → réponse).
//
// Boucle d'outils manuelle en streaming : le texte part vers le client au fil
// de l'eau, les cartes (commande, service, avis) sont émises dès que l'outil
// s'exécute. L'historique est rejoué tel quel (ajout seul) : cache de prompt
// efficace et blocs de réflexion toujours valides.
//
// Fournisseur : Claude, ou Gemini à défaut de clé Anthropic (lib/ia/gemini.ts).
// Sans clé d'API, ou si l'API échoue avant d'avoir rien affiché, le mode
// secours prend le relais : le client obtient toujours une réponse.
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { bdd } from "@/lib/bdd";
import { obtenirConversation } from "@/lib/conversations";
import { env } from "@/lib/env";
import { peutCommander, type ContexteChambre } from "@/lib/contexte-chambre";
import { clientAnthropic, fournisseurIA } from "@/lib/ia/client";
import { deroulerTourGemini, type ConsommationIA } from "@/lib/ia/gemini";
import { executerOutil, outilsConcierge, type EnvironnementOutils } from "@/lib/ia/outils";
import {
  construireContexteTour,
  construirePromptStable,
  documentationIntegrable,
  referencesCatalogue,
} from "@/lib/ia/prompt-systeme";
import { repondreEnSecours } from "@/lib/ia/secours";
import { actionCertaine, reponseInstantanee } from "@/lib/ia/voie-rapide";
import { detecterLangue, estQuestion, mentionne, MOTS, normaliser } from "@/lib/ia/secours/comprehension";
import { RESUMES_SERVICE } from "@/lib/ia/secours/textes";
import { proposerService, reponseDejaDonnee } from "@/lib/demandes";
import { traducteurClient } from "@/lib/i18n/client";
import { estLangueClient } from "@/lib/langues";
import { avecTour } from "@/lib/verrou-conversation";
import type { EvenementFlux } from "@/lib/types";
import type { Prisma, RoleMessage } from "@/generated/prisma/client";

type BlocContenu = Anthropic.Beta.BetaContentBlock;
type MessageParam = Anthropic.Beta.BetaMessageParam;

// Garde-fous
const ITERATIONS_MAX = 5; // appels d'outils enchaînés par tour
const DEMANDES_MAX_CONTEXTE = 15; // demandes récentes rappelées au modèle à chaque tour
const VALIDITE_CARTE_MS = 30 * 60 * 1000; // au-delà, une carte non confirmée ne peut plus l'être
// Attente maximale si un autre tour occupe la conversation (autre personne de la chambre, réponse de la réception)
const ATTENTE_TOUR_MS = 20 * 1000;

const BETAS: Anthropic.Beta.AnthropicBeta[] = [
  "server-side-fallback-2026-07-01", // repli automatique si un refus de sécurité survient
  "thinking-binding-controls-2026-08-01", // blocs de réflexion invalides ignorés plutôt qu'en erreur
];

const MESSAGE_REFUS = "Je ne peux pas vous aider sur ce point, mais la réception reste à votre entière disposition.";

const ROLE_API: Record<RoleMessage, MessageParam["role"]> = {
  CLIENT: "user",
  ASSISTANT: "assistant",
  SYSTEME: "system",
};

type ParametresTour = {
  contexte: ContexteChambre;
  conversationId: string | null;
  message: string;
  langueClient: string;
  emettre: (evenement: EvenementFlux) => void;
};

export async function executerTour({
  contexte,
  conversationId,
  message,
  langueClient,
  emettre: emettreBrut,
}: ParametresTour) {
  const { hotel, chambre, sejour } = contexte;

  const conversation = await obtenirConversation(contexte, conversationId, langueClient);
  // Langue de la réponse : celle où le client écrit, sinon celle de l'interface. Imposée
  // explicitement au modèle : les modèles légers suivent sinon la langue des consignes.
  const langueReponse = detecterLangue(message) ?? langueClient;
  emettreBrut({ type: "conversation", id: conversation.id });

  // Un seul tour à la fois dans la conversation : l'historique est lu une fois la main prise
  await avecTour(
    conversation.id,
    async () => {
      // Le client a-t-il déjà vu quelque chose de ce tour ? (sinon, le mode secours peut encore répondre)
      let reponseVisible = false;
      let alerteUrgente = false;
      const emettre = (evenement: EvenementFlux) => {
        if (evenement.type === "texte" || evenement.type === "demande" || evenement.type === "avis")
          reponseVisible = true;
        if (evenement.type === "demande" && evenement.demande.urgent) alerteUrgente = true;
        emettreBrut(evenement);
      };

      const [categories, documents, historique, demandesRecentes] = await Promise.all([
        bdd.categorieCatalogue.findMany({
          where: { hotelId: hotel.id },
          orderBy: [{ ordre: "asc" }, { id: "asc" }],
          include: {
            articles: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
          },
        }),
        bdd.document.findMany({
          where: { hotelId: hotel.id },
          orderBy: [{ type: "asc" }, { titre: "asc" }],
          select: { titre: true, contenu: true },
        }),
        bdd.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { rang: "asc" },
        }),
        // Demandes du séjour (ou de cette conversation sans séjour), pour répondre à « où en est ma commande ? »
        bdd.demande.findMany({
          where: {
            ...(sejour ? { sejourId: sejour.id } : { conversationId: conversation.id }),
            // Une carte non confirmée n'existe pour le client que dans cette conversation, et tant qu'elle est valide
            OR: [
              { statut: { not: "PROPOSEE" } },
              {
                conversationId: conversation.id,
                creeLe: { gte: new Date(Date.now() - VALIDITE_CARTE_MS) },
              },
            ],
          },
          orderBy: { creeLe: "desc" },
          take: DEMANDES_MAX_CONTEXTE,
          select: {
            id: true,
            type: true,
            statut: true,
            resume: true,
            urgent: true,
            creeLe: true,
            priseEnChargeLe: true,
            termineeLe: true,
            reponse: true,
            messagesEquipe: true,
          },
        }),
      ]);

      const rattachement = {
        hotelId: hotel.id,
        chambreId: chambre.id,
        sejourId: sejour?.id ?? null,
        conversationId: conversation.id,
      };
      const secours = () =>
        repondreEnSecours({
          contexte,
          conversationId: conversation.id,
          message,
          langue: langueClient,
          categories,
          documents,
          rattachement,
          emettre,
        });

      const messages: MessageParam[] = historique.map((m) => ({
        role: ROLE_API[m.role],
        content: m.contenu as unknown as MessageParam["content"],
      }));

      const documentationEnLigne = documentationIntegrable(documents);
      const environnementOutils: EnvironnementOutils = {
        rattachement,
        langueClient: langueReponse,
        messageClient: message,
        messagePrecedent: historique.findLast((m) => m.role === "CLIENT" && m.texte)?.texte ?? null,
        references: referencesCatalogue(categories),
        commandesAutorisees: peutCommander(contexte),
        telephoneReception: hotel.telephoneReception,
        emettre,
      };

      // Un tour est atomique pour l'historique : en cas d'échec, tout ce qu'il a
      // écrit est retiré, sinon l'historique deviendrait invalide (appel d'outil
      // sans résultat, message système non suivi d'une réponse…).
      const rangDebut = (historique.at(-1)?.rang ?? 0) + 1;
      const fournisseur = fournisseurIA();
      // Voie rapide : une question d'information simple (Wi-Fi, horaires, départ…) reçoit sa
      // réponse instantanément, tirée des données de l'hôtel ; au moindre doute, le modèle répond
      const instantanee = reponseInstantanee({
        message,
        langueInterface: langueClient,
        contexte,
        categories,
        documents,
      });
      // Question déjà posée à la réception et répondue pendant le séjour : la réponse de l'équipe,
      // aussitôt (elle fait foi, et le modèle pourrait l'oublier)
      const reponseReception =
        !instantanee && estQuestion(message) && estLangueClient(langueReponse)
          ? await reponseDejaDonnee(rattachement, message, langueReponse)
          : null;
      const directe =
        instantanee ??
        (reponseReception && estLangueClient(langueReponse)
          ? `${traducteurClient(langueReponse)("reponseReception")} : ${reponseReception}`
          : null);
      if (directe) {
        emettre({ type: "texte", delta: directe }); // affichée avant même d'être enregistrée
        await persister(conversation.id, "CLIENT", [{ type: "text", text: message }], message);
        emettre({
          type: "messageEnregistre",
          id: await persister(conversation.id, "ASSISTANT", [{ type: "text", text: directe }], directe),
        });
      } else if (!fournisseur || actionCertaine({ message, langueInterface: langueClient, categories })) {
        // Sans IA, ou demande simple et certaine : le mode secours affiche la carte aussitôt
        if (fournisseur) console.info("[conversation] demande simple : voie rapide");
        await secours();
      } else {
        const contexteTour = construireContexteTour(contexte, langueReponse, demandesRecentes.reverse());
        const promptStable = construirePromptStable(contexte, categories, documentationEnLigne ? documents : null);
        const outils = outilsConcierge(!documentationEnLigne);
        try {
          if (fournisseur === "gemini") {
            await deroulerTourGemini({
              historique,
              nouveauMessage: message,
              contexteTour,
              promptStable,
              outils,
              environnementOutils,
              emettre,
              persister: (role, contenu, texte, consommation) =>
                persister(conversation.id, role, contenu, texte, undefined, consommation),
            });
          } else {
            await deroulerTour({
              conversationId: conversation.id,
              messages,
              nouveauMessage: message,
              contexteTour,
              promptStable,
              outils,
              environnementOutils,
              emettre,
            });
          }
          // Ni texte ni carte : le client resterait sans réponse, le mode secours la donne
          if (!reponseVisible) throw new Error("Réponse vide du modèle");
          // Filet de sécurité : un message d'urgence reçoit toujours sa carte d'alerte,
          // même si le modèle l'a oubliée (la sécurité ne dépend pas de sa constance)
          if (mentionne(normaliser(message), MOTS.urgence) && !alerteUrgente) {
            const resume = RESUMES_SERVICE.urgence;
            const langue = langueReponse as keyof typeof resume;
            const { demande, doublon } = await proposerService(
              rattachement,
              langueReponse,
              "autre",
              {
                fr: resume.fr,
                en: resume.en,
                client: resume[langue] ?? resume.en,
              },
              {
                fr: `« ${message} »`,
                en: `“${message}”`,
                client: `« ${message} »`,
              },
              true,
            );
            if (!doublon) emettre({ type: "demande", demande });
          }
        } catch (erreur) {
          await bdd.message.deleteMany({
            where: {
              conversationId: conversation.id,
              rang: { gte: rangDebut },
            },
          });
          // Réponse déjà entamée : impossible de la remplacer proprement, le client réessaiera
          if (reponseVisible) throw erreur;
          console.error(
            "[conversation] IA indisponible, mode secours :",
            erreur instanceof Error ? erreur.message : erreur,
          );
          await secours();
        }
      }

      await bdd.conversation.update({
        where: { id: conversation.id },
        data: { dernierMessageLe: new Date(), langue: langueClient },
      });
      emettre({ type: "fin" });
    },
    { attenteMaxMs: ATTENTE_TOUR_MS },
  );
}

type ParametresDeroulement = {
  conversationId: string;
  messages: MessageParam[];
  nouveauMessage: string;
  contexteTour: string;
  promptStable: string;
  outils: Anthropic.Beta.BetaTool[];
  environnementOutils: EnvironnementOutils;
  emettre: (evenement: EvenementFlux) => void;
};

async function deroulerTour({
  conversationId,
  messages,
  nouveauMessage,
  contexteTour,
  promptStable,
  outils,
  environnementOutils,
  emettre,
}: ParametresDeroulement) {
  // Message du client puis contexte daté (message « system » en milieu de conversation)
  const messageClient: MessageParam = {
    role: "user",
    content: [{ type: "text", text: nouveauMessage }],
  };
  const messageContexte: MessageParam = {
    role: "system",
    content: contexteTour,
  };
  await persister(conversationId, "CLIENT", messageClient.content, nouveauMessage);
  await persister(conversationId, "SYSTEME", messageContexte.content, null);
  messages.push(messageClient, messageContexte);

  let texteDejaEmis = false;

  for (let iteration = 0; iteration < ITERATIONS_MAX; iteration++) {
    const flux = clientAnthropic().beta.messages.stream({
      model: env.LALLA_MODELE_IA,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: "default",
      thinking: {
        type: "adaptive",
        block_binding: { prefix_mismatch_behavior: "drop_block" },
      },
      output_config: { effort: "low" }, // conversation : la réactivité prime
      system: [
        {
          type: "text",
          text: promptStable,
          cache_control: { type: "ephemeral" },
        },
      ],
      cache_control: { type: "ephemeral" }, // met aussi en cache l'historique
      tools: outils,
      messages,
    });

    // Deux réponses successives d'un même tour sont séparées d'un paragraphe
    let premierDelta = true;
    flux.on("text", (delta) => {
      if (premierDelta && texteDejaEmis) emettre({ type: "texte", delta: "\n\n" });
      premierDelta = false;
      texteDejaEmis = true;
      emettre({ type: "texte", delta });
    });

    const reponse = await flux.finalMessage();

    if (reponse.stop_reason === "refusal") {
      emettre({
        type: "texte",
        delta: (texteDejaEmis ? "\n\n" : "") + MESSAGE_REFUS,
      });
      const id = await persister(conversationId, "ASSISTANT", [{ type: "text", text: MESSAGE_REFUS }], MESSAGE_REFUS);
      emettre({ type: "messageEnregistre", id });
      return;
    }

    const contenu = preparerPourRejeu(reponse.content);
    const appels = contenu.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    // Une entrée d'outil tronquée peut sembler valide : on ne l'exécute pas.
    if (reponse.stop_reason === "max_tokens" && appels.length > 0) {
      throw new Error("Réponse tronquée pendant un appel d'outil");
    }

    const texte = extraireTexte(contenu);
    const idMessage = await persister(conversationId, "ASSISTANT", contenu, texte, reponse.usage);
    if (texte) emettre({ type: "messageEnregistre", id: idMessage });
    messages.push({ role: "assistant", content: contenu });

    if (appels.length === 0 || reponse.stop_reason !== "tool_use") return;

    // Tous les résultats d'outils dans UN seul message utilisateur
    const resultats: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const appel of appels) {
      const { contenu: texte, erreur } = await executerOutil(appel, environnementOutils);
      resultats.push({
        type: "tool_result",
        tool_use_id: appel.id,
        content: texte,
        is_error: erreur,
      });
    }
    await persister(conversationId, "CLIENT", resultats, null);
    messages.push({ role: "user", content: resultats });
    if (environnementOutils.carteAffichee) return;
  }
}

/**
 * Règle de rejeu après un repli de modèle en cours de réponse : les blocs
 * de réflexion et d'appel d'outil situés AVANT le dernier bloc « fallback »
 * appartiennent à la tentative abandonnée — on ne les rejoue ni ne les exécute.
 */
function preparerPourRejeu(contenu: BlocContenu[]): BlocContenu[] {
  const frontiere = contenu.findLastIndex((bloc) => bloc.type === "fallback");
  if (frontiere === -1) return contenu;
  const internes = new Set(["thinking", "redacted_thinking", "tool_use", "server_tool_use"]);
  return contenu.filter((bloc, index) => index > frontiere || !internes.has(bloc.type));
}

function extraireTexte(contenu: BlocContenu[]): string | null {
  const texte = contenu
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
  return texte || null;
}

async function persister(
  conversationId: string,
  role: RoleMessage,
  contenu: unknown,
  texte: string | null,
  usage?: Anthropic.Beta.BetaUsage,
  consommation?: ConsommationIA, // Gemini
): Promise<string> {
  const { id } = await bdd.message.create({
    data: {
      conversationId,
      role,
      contenu: contenu as Prisma.InputJsonValue,
      texte,
      jetonsEntree: usage
        ? usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
        : (consommation?.entree ?? null),
      jetonsSortie: usage?.output_tokens ?? consommation?.sortie ?? null,
    },
    select: { id: true },
  });
  return id;
}
