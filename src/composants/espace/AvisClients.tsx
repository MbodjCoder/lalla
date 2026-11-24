// Onglet « Avis » des Notifications : la note moyenne, tout l'historique des avis et une
// recherche. Les avis décevants à traiter pendant le séjour remontent aussi dans « Tout ».
import { Star } from "lucide-react";
import { LigneAvis } from "@/composants/espace/lignes";
import { RechercheDepliable } from "@/composants/espace/RechercheDepliable";
import { NOTE_AVIS_A_TRAITER } from "@/lib/alertes-equipe";
import { attente, normaliser, SEUIL_RETARD_MIN, type Horloge } from "@/lib/attente";
import { bdd } from "@/lib/bdd";
import type { TraduireEquipe } from "@/lib/i18n/equipe";
import type { LangueEquipe } from "@/lib/langues";
import { depuisDerniereVisite } from "@/lib/notifications-hotel";

// Les plus récents, avec recherche dans tout cet historique
const AVIS_MAX = 200;

export async function AvisClients({
  hotelId,
  avisConsultesLe,
  h,
  langue,
  horloge,
  t,
}: {
  hotelId: string;
  avisConsultesLe: Date | null;
  h: string | undefined;
  langue: LangueEquipe;
  horloge: Horloge;
  t: TraduireEquipe;
}) {
  const recherche = normaliser(h?.trim() ?? "");

  const [avis, notes] = await Promise.all([
    bdd.avis.findMany({
      where: { hotelId },
      include: { chambre: true, sejour: true },
      orderBy: { creeLe: "desc" },
      take: AVIS_MAX,
    }),
    bdd.avis.aggregate({
      where: { hotelId },
      _avg: { note: true },
      _count: true,
    }),
  ]);

  // Ouvrir cette page vaut lecture : les nouveaux avis sont vus (écriture seulement s'il y en a)
  const vusJusquau = depuisDerniereVisite(avisConsultesLe);
  if (avis.some((unAvis) => unAvis.creeLe > vusJusquau)) {
    await bdd.hotel.update({
      where: { id: hotelId },
      data: { avisConsultesLe: new Date() },
    });
  }

  // La recherche porte sur la chambre, le client et le commentaire (dans toutes ses langues)
  const affiches = recherche
    ? avis.filter((unAvis) =>
        normaliser(
          [unAvis.chambre.numero, unAvis.sejour?.nomClient, unAvis.commentaire, JSON.stringify(unAvis.traductions)]
            .filter(Boolean)
            .join(" "),
        ).includes(recherche),
      )
    : avis;
  const noteMoyenne =
    notes._avg.note === null
      ? "—"
      : new Intl.NumberFormat(horloge.locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(notes._avg.note);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-ligne bg-surface px-4 py-3 shadow-carte sm:px-5">
        <p className="flex items-baseline gap-2">
          <span className="texte-numeros flex items-center gap-1.5 tabular-nums tracking-tight text-numeros">
            {noteMoyenne}
            <Star className="size-[18px] fill-accent text-accent" aria-hidden />
          </span>
          <span className="texte-details-equipe text-details-equipe">
            {recherche ? t("resultatsHistorique", { n: affiches.length }) : t("avisCompte", { n: notes._count })}
          </span>
        </p>
        <RechercheDepliable
          parametre="h"
          libelles={{
            rechercher: t("rechercher"),
            placeholder: t("rechercherAvis"),
            fermer: t("fermerRecherche"),
          }}
        />
      </div>

      {affiches.length === 0 ? (
        <p className="texte-details-equipe mt-4 rounded-[24px] border border-ligne bg-surface px-6 py-8 text-center shadow-carte text-details-equipe">
          {recherche ? t("aucunResultat", { q: h?.trim() ?? "" }) : t("aucunAvis")}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {affiches.map((unAvis) => {
            const aTraiter = !unAvis.traite && unAvis.note <= NOTE_AVIS_A_TRAITER;
            return (
              <LigneAvis
                key={unAvis.id}
                avis={unAvis}
                attente={attente(unAvis.creeLe, aTraiter ? SEUIL_RETARD_MIN : Infinity, t, horloge)}
                aTraiter={aTraiter}
                nouveau={unAvis.creeLe > vusJusquau}
                langue={langue}
                t={t}
              />
            );
          })}
        </ul>
      )}
    </>
  );
}
