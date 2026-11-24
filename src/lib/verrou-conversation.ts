// Un seul tour à la fois par conversation. Deux personnes écrivant depuis la même
// chambre, ou la réception qui répond pendant que Lalla rédige, ne doivent jamais
// entremêler leurs messages : l'historique rejoué au modèle deviendrait invalide
// (appel d'outil sans son résultat) et l'annulation d'un tour en échec effacerait
// le message de l'autre.
//
// Verrou en base (bail daté) : valable avec plusieurs instances du serveur, et
// libéré tout seul si une instance s'arrête en plein tour.
import "server-only";
import { bdd } from "@/lib/bdd";

// Plus long que la durée maximale d'un tour (maxDuration de la route : 60 s)
const DUREE_BAIL_MS = 90 * 1000;
const PAS_ATTENTE_MS = 250;

const pause = (ms: number) => new Promise((resoudre) => setTimeout(resoudre, ms));

/** Prend le tour, en attendant au plus `attenteMaxMs` ; false si la conversation reste occupée. */
async function prendreTour(conversationId: string, attenteMaxMs: number): Promise<boolean> {
  const limite = Date.now() + attenteMaxMs;
  for (;;) {
    const maintenant = new Date();
    const { count } = await bdd.conversation.updateMany({
      where: {
        id: conversationId,
        OR: [{ tourVerrouilleJusqua: null }, { tourVerrouilleJusqua: { lt: maintenant } }],
      },
      data: { tourVerrouilleJusqua: new Date(maintenant.getTime() + DUREE_BAIL_MS) },
    });
    if (count === 1) return true;
    if (Date.now() >= limite) return false;
    await pause(PAS_ATTENTE_MS);
  }
}

async function rendreTour(conversationId: string) {
  await bdd.conversation
    .updateMany({ where: { id: conversationId }, data: { tourVerrouilleJusqua: null } })
    .catch((erreur) => console.error("[verrou] libération impossible", erreur));
}

export class ConversationOccupee extends Error {
  constructor() {
    super("Conversation occupée");
  }
}

/**
 * Exécute `action` en ayant seul la main sur la conversation.
 * `forcer` : passé le délai, l'action s'exécute quand même (un message de la réception
 * doit toujours arriver) ; sinon ConversationOccupee est levée.
 */
export async function avecTour<T>(
  conversationId: string,
  action: () => Promise<T>,
  { attenteMaxMs, forcer = false }: { attenteMaxMs: number; forcer?: boolean },
): Promise<T> {
  const obtenu = await prendreTour(conversationId, attenteMaxMs);
  if (!obtenu && !forcer) throw new ConversationOccupee();
  try {
    return await action();
  } finally {
    if (obtenu) await rendreTour(conversationId);
  }
}
