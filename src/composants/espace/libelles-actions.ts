// Libellés des décisions de l'équipe, communs à l'espace hôtel et à la page du lien WhatsApp.
import type { TraduireEquipe } from "@/lib/i18n/equipe";
import type { LibellesActions } from "./ActionsDemande";

/**
 * @param nomLangueClient langue du client quand elle diffère de celle de l'équipe
 *   (la réponse sera traduite), sinon null.
 */
export function libellesActionsEquipe(t: TraduireEquipe, nomLangueClient: string | null): LibellesActions {
  return {
    accepter: t("accepterDemande"),
    annuler: t("annulerDemande"),
    repondre: t("repondre"),
    envoyer: t("envoyerAuClient"),
    retour: t("retour"),
    confirmerAnnulation: t("confirmerAnnulation"),
    questionAnnulation: t("questionAnnulation"),
    placeholderReponse: t("placeholderReponse"),
    aideReponse: t("aideReponseQuestion", {
      traduction: nomLangueClient ? t("traduitEn", { langue: nomLangueClient }) : "",
    }),
  };
}
