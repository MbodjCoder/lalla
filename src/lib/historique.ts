// Reconstitution du fil affiché au client (après un rechargement de page) :
// messages lisibles et cartes de demande, dans l'ordre chronologique — avec,
// comme en direct, la carte reprise en bas quand son état a changé après
// d'autres échanges. La réponse à une question s'affiche dans sa carte.
import "server-only";
import { bdd } from "@/lib/bdd";
import { versVue } from "@/lib/demandes";
import type { ElementFil } from "@/lib/types";

// Messages tolérés sous une carte avant de considérer que la discussion a avancé (même règle qu'en direct)
const ELEMENTS_VISIBLES_APRES_CARTE = 1;

type MessageEquipe = {
  messageId: string;
  auteur?: "equipe" | "lalla";
  le: string;
};

export async function construireFil(conversationId: string, chambreId: string, sejourId: string | null) {
  const conversation = await bdd.conversation.findFirst({
    where: { id: conversationId, chambreId, sejourId },
    include: {
      messages: {
        where: { texte: { not: null }, role: { in: ["CLIENT", "ASSISTANT"] } },
        orderBy: { rang: "asc" },
      },
      demandes: { include: { lignes: true }, orderBy: { creeLe: "asc" } },
    },
  });
  if (!conversation) return null;

  // Qui a écrit chaque message de l'équipe, et à quelle demande il se rapporte
  const messagesEquipe = new Map<string, { auteur: "equipe" | "lalla"; demandeId: string }>();
  for (const demande of conversation.demandes) {
    for (const message of demande.messagesEquipe as MessageEquipe[]) {
      messagesEquipe.set(message.messageId, {
        auteur: message.auteur ?? "equipe",
        demandeId: demande.id,
      });
    }
    if (demande.reponseMessageId && !messagesEquipe.has(demande.reponseMessageId)) {
      messagesEquipe.set(demande.reponseMessageId, {
        auteur: "equipe",
        demandeId: demande.id,
      });
    }
  }
  const instants = conversation.messages.map((message) => message.creeLe.getTime());
  // Échanges écrits entre deux instants : la discussion a-t-elle avancé depuis la carte ?
  const discussionAvancee = (depuis: number, jusqua: number) =>
    instants.filter((instant) => instant > depuis && instant < jusqua).length > ELEMENTS_VISIBLES_APRES_CARTE;

  // La réponse à une question vit dans la carte de la question, pas dans une bulle à part
  const reponsesQuestions = new Set(
    conversation.demandes.flatMap((demande) =>
      demande.type === "QUESTION" && demande.reponseMessageId ? [demande.reponseMessageId] : [],
    ),
  );

  const horodates: { instant: number; element: ElementFil }[] = conversation.messages
    .filter((message) => !reponsesQuestions.has(message.id))
    .map((message) => {
      const instant = message.creeLe.getTime();
      if (message.role === "CLIENT") {
        return {
          instant,
          element: {
            genre: "client",
            id: message.id,
            texte: message.texte!,
            envoyeLe: message.creeLe.toISOString(),
          },
        };
      }
      return {
        instant,
        element: {
          genre: "assistant",
          id: message.id,
          texte: message.texte!,
          idsMessages: [message.id],
          envoyeLe: message.creeLe.toISOString(),
          equipe: messagesEquipe.get(message.id)?.auteur === "equipe" || undefined,
        },
      };
    });

  for (const demande of conversation.demandes) {
    const vue = versVue(demande);
    horodates.push({
      instant: demande.creeLe.getTime(),
      element: { genre: "demande", id: demande.id, demande: vue },
    });

    // Décision ou réponse de la réception arrivée après d'autres échanges : la carte est reprise à ce moment-là
    const decision =
      demande.statut === "TERMINEE"
        ? demande.termineeLe?.getTime()
        : vue.declinee
          ? new Date((demande.messagesEquipe as MessageEquipe[]).at(-1)?.le ?? 0).getTime() - 1
          : undefined;
    if (decision && discussionAvancee(demande.creeLe.getTime(), decision)) {
      horodates.push({
        instant: decision,
        element: {
          genre: "demande",
          id: `${demande.id}-${demande.statut}`,
          demande: vue,
          rappel: true,
        },
      });
    }
  }

  return horodates.sort((a, b) => a.instant - b.instant).map(({ element }) => element);
}
