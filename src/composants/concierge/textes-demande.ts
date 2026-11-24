// Textes calculés d'une demande, partagés par la carte du fil et le récapitulatif du panier.
import type { TraduireClient } from "@/lib/i18n/client";
import { choisirTraduction, type LangueClient } from "@/lib/langues";
import type { ArticleRefuseVue } from "@/lib/types";
import { horairesLisibles } from "./horaires";
import type { ResultatDemandeDirecte } from "./useConversation";

/** « Club sandwich n'a pas été ajouté : service fermé en ce moment (11h – 23h). » */
export function texteRefus(refuse: ArticleRefuseVue, langue: LangueClient, t: TraduireClient): string {
  const article = choisirTraduction(refuse.libelle, langue, refuse.libelle.fr);
  if (refuse.raison === "indisponible") return t("nonAjouteIndisponible", { article });
  const horaires = horairesLisibles(refuse.horaires, langue, t);
  return horaires ? t("nonAjouteFerme", { article, horaires }) : t("nonAjouteFermeSansHoraires", { article });
}

/** Pourquoi une demande directe n'a pas abouti, en phrases prêtes à afficher. */
export function textesEchec(
  echec: Extract<ResultatDemandeDirecte, { ok: false }>,
  langue: LangueClient,
  t: TraduireClient,
): string[] {
  if (echec.erreur === "refusee") return echec.refuses.map((refuse) => texteRefus(refuse, langue, t));
  if (echec.erreur === "commandesFermees") return [t("commandesFermees")];
  if (echec.erreur === "momentInvalide") return [t("momentInvalide")];
  return [t("envoiImpossible")];
}
