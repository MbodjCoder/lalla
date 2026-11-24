import Link from "next/link";
import { AlertesEquipe } from "@/composants/espace/AlertesEquipe";
import { EcranHotel } from "@/composants/espace/EcranHotel";
import { alertesEquipe } from "@/lib/alertes-equipe";
import { lireHotel } from "@/lib/hotel-courant";
import { lireCouleursEquipe, variablesComposantsEquipe, variablesEspace } from "@/lib/couleurs";
import { lireTypographie, variablesTypographie } from "@/lib/typographie";
import { formesPluriel } from "@/lib/i18n/equipe";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { FICHES_LANGUES } from "@/lib/langues";
import { notificationsHotel } from "@/lib/notifications-hotel";
import { exigerPersonnel } from "@/lib/session-personnel";

// Une seule interface pour toute l'équipe : l'accueil (tableau de bord des notifications),
// chaque page y ramène, comme l'identité de l'hôtel. L'en-tête est celui du client (logo, nom,
// mention, fond blanc) ; les trois barres, à droite, ouvrent « Hôtel » (chambres, carte,
// paramètres) depuis n'importe quelle page.
export default async function MiseEnPageEspace({ children }: { children: React.ReactNode }) {
  const session = await exigerPersonnel();
  // L'hôtel et les compteurs en parallèle ; la page réutilise les mêmes lectures
  const [hotel, compte] = await Promise.all([lireHotel(session.hotelId), notificationsHotel(session)]);
  const { langue, t } = await traducteurEquipeCourant(hotel.langueEquipe);
  const alertes = await alertesEquipe(session.hotelId, langue);

  return (
    // data-espace : les fiches s'y ouvrent pour garder les couleurs de l'hôtel et le sens d'écriture
    <div
      data-espace
      lang={langue}
      dir={FICHES_LANGUES[langue].sens}
      className="min-h-dvh"
      style={{
        ...variablesEspace(hotel.couleurAccent, hotel.couleurBoutons),
        ...variablesComposantsEquipe(lireCouleursEquipe(hotel.couleursEquipe)),
        ...variablesTypographie(lireTypographie(hotel.typographie), "equipe"),
      }}
    >
      <header className="sticky top-0 z-20 border-b border-ligne/70 bg-white print:hidden">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between gap-3 ps-5 pe-3">
          <Link href="/espace/accueil" className="flex min-w-0 flex-col items-center text-center">
            {hotel.logoUrl ? (
              // Le logo de l'hôtel porte déjà son nom : il occupe seul la place, comme côté client
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hotel.logoUrl} alt={hotel.nom} className="h-11 w-auto max-w-full object-contain object-left" />
            ) : (
              <>
                <span className="texte-nom-hotel max-w-full truncate text-nom-hotel">{hotel.nom}</span>
                {hotel.sousTitre && (
                  <span className="max-w-full truncate text-[9.5px] leading-[1.3] font-semibold tracking-[0.32em] text-mention-hotel uppercase">
                    {hotel.sousTitre}
                  </span>
                )}
              </>
            )}
          </Link>
          <div className="flex items-center gap-2.5">
            <AlertesEquipe
              alertesInitiales={alertes}
              titrePage={`${hotel.nom} · Lalla`}
              libelles={{
                nouvelleDemande: t("nouvelleDemande"),
                nouvelleQuestion: t("nouvelleQuestion"),
                nouveauSignalement: t("nouveauSignalement"),
                avisDecevant: t("avisDecevant"),
                autresAlertes: formesPluriel(langue, "autresAlertes"),
                chambre: t("chambreCourt"),
              }}
            />
            {/* « Hôtel » : chambres, carte, paramètres, dans un écran temporaire */}
            <EcranHotel
              libelle={t("navHotel")}
              libelleFermer={t("fermer")}
              destinations={[
                { cle: "chambres", libelle: t("navChambres"), notifications: compte.chambres },
                { cle: "carte", libelle: t("carteTitre"), notifications: compte.carte },
                { cle: "parametres", libelle: t("parametres"), notifications: compte.parametres },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-8 pb-16 print:p-0">{children}</main>
    </div>
  );
}
