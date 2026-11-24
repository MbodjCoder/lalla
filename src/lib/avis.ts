// Passerelle d'e-réputation.
//
// Conformité : TripAdvisor et Google interdisent le « review gating »
// (ne solliciter un avis public qu'auprès des clients satisfaits). Lalla
// propose donc le lien public à TOUS ; la valeur ajoutée est ailleurs :
// une note basse alerte la direction pendant que le client est encore là,
// ce qui permet de rattraper l'expérience avant son départ.
import "server-only";
import { enArrierePlan } from "@/lib/arriere-plan";
import { bdd } from "@/lib/bdd";
import { env } from "@/lib/env";
import type { ContexteChambre } from "@/lib/contexte-chambre";
import { iaConfiguree } from "@/lib/ia/client";
import { traduireTextes } from "@/lib/ia/traduction";
import { traducteurEquipe } from "@/lib/i18n/equipe";
import { estLangueEquipe, type LangueClient, type LangueEquipe } from "@/lib/langues";
import { envoyerNotification } from "@/lib/notifications/whatsapp";

const SEUIL_ALERTE = 3; // note ≤ 3 : alerte immédiate de la direction

/**
 * Commentaire traduit pour l'équipe : dans sa langue, en français et en anglais (pas dans
 * les huit langues : chaque traduction coûte un appel au modèle). Autres langues : l'original.
 */
async function traduirePourEquipe(commentaire: string, langueClient: LangueClient, langueEquipe: LangueEquipe) {
  const traductions: Record<string, string> = {};
  if (!iaConfiguree()) return traductions;
  const langues = [...new Set<LangueEquipe>([langueEquipe, "fr", "en"])].filter((l) => l !== langueClient);
  for (const langue of langues) {
    try {
      [traductions[langue]] = await traduireTextes([commentaire], langue);
    } catch (erreur) {
      console.error("[avis] traduction impossible", erreur);
    }
  }
  return traductions;
}

export async function enregistrerAvis(
  contexte: ContexteChambre,
  note: number,
  commentaire: string | null,
  langueClient: LangueClient,
) {
  const { hotel, chambre, sejour } = contexte;
  const langueEquipe = estLangueEquipe(hotel.langueEquipe) ? hotel.langueEquipe : "fr";
  const texte = commentaire?.trim().slice(0, 2000) || null;

  // Un avis par séjour : un double envoi (double appui, réseau qui renvoie) renvoie le premier
  if (sejour) {
    const { count } = await bdd.sejour.updateMany({
      where: { id: sejour.id, avisSollicite: false },
      data: { avisSollicite: true },
    });
    if (count === 0) {
      const existant = await bdd.avis.findFirst({ where: { sejourId: sejour.id }, orderBy: { creeLe: "desc" } });
      if (existant) return { id: existant.id, lienPublic: hotel.lienAvisPublic };
    }
  }
  const traductions = texte ? await traduirePourEquipe(texte, langueClient, langueEquipe) : {};

  const avis = await bdd.avis.create({
    data: {
      hotelId: hotel.id,
      chambreId: chambre.id,
      sejourId: sejour?.id ?? null,
      note,
      commentaire: texte,
      langueClient,
      traductions,
    },
  });

  if (note <= SEUIL_ALERTE && hotel.whatsappDirection) {
    const t = traducteurEquipe(langueEquipe);
    const commentaireEquipe = texte ? (traductions[langueEquipe] ?? texte) : null;
    const destinataire = hotel.whatsappDirection;
    enArrierePlan("alerte avis", () =>
      envoyerNotification({
        destinataire,
        titre: `⚠️ ${t("chambre")} ${chambre.numero} · ${note}/5`,
        details: [
          sejour?.nomClient ? `${t("client")} : ${sejour.nomClient}` : t("alerteClientNonRenseigne"),
          commentaireEquipe ? `« ${commentaireEquipe} »` : t("alerteSansCommentaire"),
          t("alerteClientPresent"),
        ],
        lien: `${env.URL_PUBLIQUE}/espace/notifications?vue=avis`,
      }),
    );
  }

  return { id: avis.id, lienPublic: hotel.lienAvisPublic };
}

export async function marquerLienOuvert(chambreId: string, avisId: string) {
  await bdd.avis.updateMany({ where: { id: avisId, chambreId }, data: { lienPublicOuvert: true } });
}
