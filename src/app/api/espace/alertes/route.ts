// Alertes de l'équipe, interrogées toutes les quelques secondes par l'espace hôtel.
import { alertesEquipe } from "@/lib/alertes-equipe";
import { bdd } from "@/lib/bdd";
import { lireLangueEquipe } from "@/lib/langue-equipe";
import { lireSession } from "@/lib/session-personnel";

export async function GET() {
  const session = await lireSession();
  if (!session) return Response.json({ alertes: [] }, { status: 401 });

  const hotel = await bdd.hotel.findUnique({ where: { id: session.hotelId }, select: { langueEquipe: true } });
  const langue = await lireLangueEquipe(hotel?.langueEquipe);
  const alertes = await alertesEquipe(session.hotelId, langue);
  return Response.json({ alertes }, { headers: { "Cache-Control": "no-store" } });
}
