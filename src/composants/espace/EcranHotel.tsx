"use client";

// « Hôtel » : les trois barres de la barre du haut (comme le menu côté client), sur toutes les
// pages ; elles ouvrent, en haut, un écran temporaire avec chambres, carte et paramètres. Choisir
// une destination ferme cet écran et ouvre sa page temporaire sur l'accueil (tout de suite si on
// y est déjà). La couleur des barres se règle dans Design → Équipe → Hôtel.
import { BedDouble, BookOpenText, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { couleursCercle, FaceCercle } from "./CerclesNavigation";
import { Fiche } from "./LigneOuvrable";
import { Pastille } from "./Pastille";

export type DestinationHotel = { cle: "chambres" | "carte" | "parametres"; libelle: string; notifications: number };

const ICONES: Record<DestinationHotel["cle"], LucideIcon> = {
  chambres: BedDouble,
  carte: BookOpenText,
  parametres: Settings,
};

/** Événement écouté par l'accueil : ouvrir une page temporaire sans attendre le serveur. */
export const EVENEMENT_PAGE = "lalla:page";

export function EcranHotel({
  libelle,
  libelleFermer,
  destinations,
}: {
  libelle: string;
  libelleFermer: string;
  destinations: DestinationHotel[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();
  const total = destinations.reduce((somme, { notifications }) => somme + notifications, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        aria-label={libelle}
        title={libelle}
        className="relative grid size-11 shrink-0 place-items-center rounded-full bg-surface text-[var(--eq-hotelIcone,#000000)] shadow-[0_1px_2px_rgb(26_27_23/0.06),0_8px_20px_-12px_rgb(26_27_23/0.35)] transition active:scale-90"
      >
        {/* Les mêmes trois barres que chez le client */}
        <svg
          viewBox="0 0 24 24"
          className="size-[30px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M3 5h18M3 12h18M3 19h18" />
        </svg>
        <Pastille nombre={total} className="absolute -end-1.5 -top-1.5 border-white" />
      </button>
      {ouvert && (
        <Fiche libelle={libelle} libelleFermer={libelleFermer} onFermer={() => setOuvert(false)} enHaut>
          <h2 className="texte-sous-titres-equipe px-10 text-center text-sous-titres-equipe">{libelle}</h2>
          <nav aria-label={libelle} className="pt-7 pb-7">
            <ul className="flex justify-center gap-9 sm:gap-14">
              {destinations.map(({ cle, libelle: nom, notifications }) => (
                <li key={cle} style={couleursCercle(cle)}>
                  <Link
                    href={`/espace/accueil?page=${cle}`}
                    onClick={(evenement) => {
                      setOuvert(false);
                      // Déjà sur l'accueil : la page temporaire s'ouvre sans attendre
                      if (chemin === "/espace/accueil") {
                        evenement.preventDefault();
                        window.dispatchEvent(new CustomEvent(EVENEMENT_PAGE, { detail: cle }));
                      }
                    }}
                    className="group flex flex-col items-center gap-2 text-center"
                  >
                    <FaceCercle icone={ICONES[cle]} libelle={nom} notifications={notifications} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Fiche>
      )}
    </>
  );
}
