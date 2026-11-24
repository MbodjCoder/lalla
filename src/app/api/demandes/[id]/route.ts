// Décision du client sur une proposition : confirmer ou annuler.
import { z } from "zod";
import { resoudreChambre } from "@/lib/contexte-chambre";
import { deciderDemande } from "@/lib/demandes";

const schemaDecision = z.object({
  jeton: z.string().min(8).max(32),
  decision: z.enum(["confirmer", "annuler"]),
});

export async function POST(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corps = schemaDecision.safeParse(await requete.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "Requête invalide" }, { status: 400 });

  const contexte = await resoudreChambre(corps.data.jeton);
  if (!contexte) return Response.json({ erreur: "Chambre introuvable" }, { status: 404 });

  const demande = await deciderDemande(contexte.chambre.id, id, corps.data.decision);
  if (!demande) return Response.json({ erreur: "expiree" }, { status: 409 });

  return Response.json({ demande });
}
