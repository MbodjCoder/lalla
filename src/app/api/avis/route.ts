// Avis de séjour : enregistrement de la note, puis suivi du clic vers l'avis public.
import { z } from "zod";
import { enregistrerAvis, marquerLienOuvert } from "@/lib/avis";
import { resoudreChambre } from "@/lib/contexte-chambre";
import { LANGUES_CLIENT } from "@/lib/langues";
import { autoriser } from "@/lib/limiteur";

const schemaAvis = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("noter"),
    jeton: z.string().min(8).max(32),
    note: z.number().int().min(1).max(5),
    commentaire: z.string().max(2000).nullable(),
    langue: z.enum(LANGUES_CLIENT).default("fr"),
  }),
  z.object({
    action: z.literal("lienOuvert"),
    jeton: z.string().min(8).max(32),
    avisId: z.string().max(40),
  }),
]);

export async function POST(requete: Request) {
  const corps = schemaAvis.safeParse(await requete.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "Requête invalide" }, { status: 400 });

  if (!autoriser(`avis:${corps.data.jeton}`, 6, 60 * 60 * 1000)) {
    return Response.json({ erreur: "Trop de requêtes" }, { status: 429 });
  }

  const contexte = await resoudreChambre(corps.data.jeton);
  if (!contexte) return Response.json({ erreur: "Chambre introuvable" }, { status: 404 });

  if (corps.data.action === "lienOuvert") {
    await marquerLienOuvert(contexte.chambre.id, corps.data.avisId);
    return Response.json({ ok: true });
  }

  const resultat = await enregistrerAvis(contexte, corps.data.note, corps.data.commentaire, corps.data.langue);
  return Response.json(resultat);
}
