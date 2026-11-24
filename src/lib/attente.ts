// Temps d'attente d'une demande ou d'un avis, dans la langue de l'équipe et à l'heure de l'hôtel.
import type { TraduireEquipe } from "@/lib/i18n/equipe";

// heure : « il y a 12 min », « il y a 3 h 05 », au-delà de 24 h la date exacte (« 17 oct., 19:37 ») ;
// duree : temps d'attente (« 12 min ») ; enRetard : au-delà du seuil, l'attente passe au rouge
export type Attente = { heure: string; duree: string; enRetard: boolean };

export type Horloge = { locale: string; fuseau: string };

// Au-delà de ces durées (minutes), le délai d'attente passe au rouge ; une urgence n'attend pas
export const SEUIL_RETARD_MIN = 15;
export const SEUIL_RETARD_URGENT_MIN = 5;

export function attente(depuis: Date, seuilMinutes: number, t: TraduireEquipe, horloge: Horloge): Attente {
  const minutes = Math.max(0, Math.floor((Date.now() - depuis.getTime()) / 60000));
  const heuresMinutes = {
    h: Math.floor(minutes / 60),
    m: String(minutes % 60).padStart(2, "0"),
  };
  const duree =
    minutes < 1
      ? t("delaiInstant")
      : minutes < 60
        ? t("delaiMinutes", { n: minutes })
        : minutes < 24 * 60
          ? t("delaiHeures", heuresMinutes)
          : t("delaiJours", { n: Math.floor(minutes / (24 * 60)) });
  const heure =
    minutes < 1
      ? t("delaiInstant")
      : minutes < 60
        ? t("ilYaMinutes", { n: minutes })
        : minutes < 24 * 60
          ? t("ilYaHeures", heuresMinutes)
          : new Intl.DateTimeFormat(horloge.locale, {
              timeZone: horloge.fuseau,
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(depuis);
  return { heure, duree, enRetard: minutes >= seuilMinutes };
}

/** Normalisé pour comparer ou chercher du texte (accents, casse et ponctuation ignorés). */
export const normaliser = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
