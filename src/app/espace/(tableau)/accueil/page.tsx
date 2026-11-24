// Accueil de l'équipe, à la manière de Wave : le tableau de bord des notifications (commandes,
// questions, avis), chacun avec le nombre de choses qui l'attendent. Toutes les pages de travail
// s'ouvrent ici en page temporaire (?page=…) : commandes, questions, avis, et, depuis « Hôtel »
// (trois barres du haut), chambres, carte et paramètres.
import { ContenuCarte } from "@/composants/espace/ContenuCarte";
import { ContenuChambres } from "@/composants/espace/ContenuChambres";
import { ContenuNotifications, VUES_NOTIFICATIONS } from "@/composants/espace/ContenuNotifications";
import { ContenuParametres } from "@/composants/espace/ContenuParametres";
import { Rafraichisseur } from "@/composants/espace/Rafraichisseur";
import { TableauNotifications, type PageTemporaire } from "@/composants/espace/TableauNotifications";
import { lireHotel } from "@/lib/hotel-courant";
import type { TraduireEquipe } from "@/lib/i18n/equipe";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { notificationsHotel } from "@/lib/notifications-hotel";
import { exigerPersonnel } from "@/lib/session-personnel";

export const dynamic = "force-dynamic";

const PAGES: readonly PageTemporaire[] = [...VUES_NOTIFICATIONS, "chambres", "carte", "parametres"];

// Le titre de chaque page temporaire
const titres = (t: TraduireEquipe): Record<PageTemporaire, string> => ({
  commandes: t("ongletCommandes"),
  questions: t("ongletQuestions"),
  avis: t("avisClients"),
  chambres: t("navChambres"),
  carte: t("carteTitre"),
  parametres: t("parametres"),
});

export default async function PageAccueil({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; vue?: string; h?: string; categorie?: string; q?: string }>;
}) {
  const parametres = await searchParams;
  const pageOuverte = PAGES.find((cle) => cle === parametres.page) ?? null;
  const session = await exigerPersonnel();
  const [hotel, compte] = await Promise.all([lireHotel(session.hotelId), notificationsHotel(session)]);
  const { t } = await traducteurEquipeCourant(hotel.langueEquipe);

  return (
    <>
      {/* Compteurs et durées à jour sans recharger ; les nouvelles demandes arrivent par les alertes (5 s) */}
      <Rafraichisseur intervalleMs={30000} />
      <h1 className="sr-only">{t("navAccueil")}</h1>

      <div className="mx-auto max-w-3xl pt-2">
        <TableauNotifications
          titres={titres(t)}
          pageOuverte={pageOuverte}
          libelleFermer={t("fermer")}
          details={[
            { cle: "commandes", libelle: t("ongletCommandes"), nombre: compte.commandes },
            { cle: "questions", libelle: t("ongletQuestions"), nombre: compte.questions },
            { cle: "avis", libelle: t("avisClients"), nombre: compte.avis },
          ]}
        >
          {pageOuverte === "chambres" ? (
            <ContenuChambres parametres={parametres} />
          ) : pageOuverte === "carte" ? (
            <ContenuCarte parametres={parametres} />
          ) : pageOuverte === "parametres" ? (
            <ContenuParametres />
          ) : pageOuverte ? (
            <ContenuNotifications vue={pageOuverte} h={parametres.h} />
          ) : null}
        </TableauNotifications>
      </div>
    </>
  );
}
