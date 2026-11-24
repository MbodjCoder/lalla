// Conversation d'une chambre : reprise dans le même séjour, sinon une nouvelle.
// Partagé par le moteur (messages à Lalla) et les demandes directes (panier, services).
import "server-only";
import { bdd } from "@/lib/bdd";
import type { ContexteChambre } from "@/lib/contexte-chambre";

const MESSAGES_MAX_PAR_CONVERSATION = 120; // au-delà, nouvelle conversation

export async function obtenirConversation(contexte: ContexteChambre, conversationId: string | null, langue: string) {
  if (conversationId) {
    const existante = await bdd.conversation.findFirst({
      where: { id: conversationId, chambreId: contexte.chambre.id },
      include: { _count: { select: { messages: true } } },
    });
    // Une conversation n'est reprise que dans le même séjour (jamais celle du client précédent)
    const reprenable =
      existante &&
      existante.sejourId === (contexte.sejour?.id ?? null) &&
      existante._count.messages < MESSAGES_MAX_PAR_CONVERSATION;
    if (reprenable) return existante;
  }
  return bdd.conversation.create({
    data: {
      hotelId: contexte.hotel.id,
      chambreId: contexte.chambre.id,
      sejourId: contexte.sejour?.id ?? null,
      langue,
    },
  });
}
