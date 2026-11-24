// Traduction du fil quand le client change de langue.
// Seuls des messages de l'assistant appartenant à la conversation de CETTE
// chambre (et de ce séjour) peuvent être traduits ; le résultat est mis en cache.
import { z } from "zod";
import { bdd } from "@/lib/bdd";
import { resoudreChambre } from "@/lib/contexte-chambre";
import { iaConfiguree } from "@/lib/ia/client";
import { traduireTextes } from "@/lib/ia/traduction";
import { LANGUES_CLIENT } from "@/lib/langues";
import { autoriser } from "@/lib/limiteur";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const schemaRequete = z.object({
  jeton: z.string().min(8).max(32),
  conversationId: z.string().max(40),
  langue: z.enum(LANGUES_CLIENT),
  ids: z.array(z.string().max(40)).min(1).max(60),
});

export async function POST(requete: Request) {
  const corps = schemaRequete.safeParse(await requete.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "Requête invalide" }, { status: 400 });
  const { jeton, conversationId, langue, ids } = corps.data;

  if (!autoriser(`traduction:${jeton}`, 15, 10 * 60 * 1000)) {
    return Response.json({ erreur: "Trop de requêtes" }, { status: 429 });
  }

  const contexte = await resoudreChambre(jeton);
  if (!contexte) return Response.json({ erreur: "Chambre introuvable" }, { status: 404 });

  const messages = await bdd.message.findMany({
    where: {
      id: { in: ids },
      role: "ASSISTANT",
      texte: { not: null },
      conversation: { id: conversationId, chambreId: contexte.chambre.id, sejourId: contexte.sejour?.id ?? null },
    },
    select: { id: true, texte: true, traductions: true },
  });

  const resultat: Record<string, string> = {};
  const aTraduire: { id: string; texte: string; traductions: Record<string, string> }[] = [];
  for (const message of messages) {
    const traductions = message.traductions as Record<string, string>;
    if (traductions[langue]) resultat[message.id] = traductions[langue];
    else aTraduire.push({ id: message.id, texte: message.texte!, traductions });
  }

  if (aTraduire.length > 0) {
    if (!iaConfiguree()) return Response.json({ traductions: resultat });
    try {
      const traduits = await traduireTextes(
        aTraduire.map((m) => m.texte),
        langue,
      );
      await Promise.all(
        aTraduire.map((message, rang) => {
          resultat[message.id] = traduits[rang];
          return bdd.message.update({
            where: { id: message.id },
            data: { traductions: { ...message.traductions, [langue]: traduits[rang] } as Prisma.InputJsonValue },
          });
        }),
      );
    } catch (erreur) {
      console.error("[traduction] échec", erreur);
    }
  }

  return Response.json({ traductions: resultat });
}
