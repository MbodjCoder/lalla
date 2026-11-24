"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Proprietes = {
  ouverte: boolean;
  titre: string;
  sousTitre?: string;
  libelleFermer: string;
  onFermer: () => void;
  hauteur?: "contenu" | "haute";
  pied?: React.ReactNode; // barre d'action fixée en bas de la feuille (ex. panier)
  actions?: React.ReactNode; // boutons d'en-tête, à côté de la croix (ex. recherche)
  variablesTextes?: Record<string, string>; // réglages de textes propres à cette fenêtre (lib/typographie)
  children: React.ReactNode;
};

// Doit couvrir l'animation de sortie (globals.css)
const DUREE_SORTIE_MS = 240;
// Distance de glissement vers le bas au-delà de laquelle la feuille se ferme
const SEUIL_FERMETURE_PX = 90;

// Feuille modale qui monte du bas de l'écran (geste naturel sur mobile).
// Se ferme par la croix, le voile, Échap, ou en la faisant glisser vers le bas.
export function FeuilleBas({
  ouverte,
  titre,
  sousTitre,
  libelleFermer,
  onFermer,
  hauteur = "contenu",
  pied,
  actions,
  variablesTextes,
  children,
}: Proprietes) {
  const [montee, setMontee] = useState(ouverte); // présente à l'écran, y compris pendant la sortie
  const [entree, setEntree] = useState(true); // animation d'entrée en cours
  const [decalage, setDecalage] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const origineGlissement = useRef<number | null>(null);
  const sortie = montee && !ouverte;

  useEffect(() => {
    if (ouverte) {
      setMontee(true);
      setEntree(true);
      setDecalage(0);
      return;
    }
    const minuteur = setTimeout(() => setMontee(false), DUREE_SORTIE_MS);
    return () => clearTimeout(minuteur);
  }, [ouverte]);

  // Échap pour fermer, défilement de la page bloqué pendant l'ouverture
  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (evenement: KeyboardEvent) => evenement.key === "Escape" && onFermer();
    document.addEventListener("keydown", surTouche);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = "";
    };
  }, [ouverte, onFermer]);

  if (!montee) return null;

  const commencerGlissement = (evenement: React.PointerEvent) => {
    if (sortie || (evenement.target as HTMLElement).closest("button")) return;
    origineGlissement.current = evenement.clientY;
    setGlisse(true);
    (evenement.currentTarget as HTMLElement).setPointerCapture(evenement.pointerId);
  };
  const suivreGlissement = (evenement: React.PointerEvent) => {
    if (origineGlissement.current === null) return;
    setDecalage(Math.max(0, evenement.clientY - origineGlissement.current));
  };
  const terminerGlissement = () => {
    if (origineGlissement.current === null) return;
    origineGlissement.current = null;
    setGlisse(false);
    if (decalage > SEUIL_FERMETURE_PX) onFermer();
    else setDecalage(0);
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={titre}>
      <button
        type="button"
        aria-label={libelleFermer}
        onClick={onFermer}
        tabIndex={-1}
        className={`absolute inset-0 bg-encre/35 backdrop-blur-[2px] ${sortie ? "animate-voile-sortie" : "animate-voile"}`}
      />
      <div
        onAnimationEnd={(evenement) => evenement.target === evenement.currentTarget && setEntree(false)}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-xl flex-col rounded-t-[30px] bg-fond shadow-flottante ${
          hauteur === "haute" ? "h-[90dvh]" : "max-h-[85dvh]"
        } ${sortie ? "animate-feuille-sortie" : entree ? "animate-feuille" : ""}`}
        style={
          {
            ...variablesTextes,
            "--decalage": `${decalage}px`,
            transform: sortie || entree ? undefined : `translateY(${decalage}px)`,
            transition: glisse ? "none" : "transform 260ms var(--ease-douce)",
          } as React.CSSProperties
        }
      >
        {/* Poignée et titre : zone de glissement */}
        <div
          onPointerDown={commencerGlissement}
          onPointerMove={suivreGlissement}
          onPointerUp={terminerGlissement}
          onPointerCancel={terminerGlissement}
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
        >
          <div className="flex justify-center pt-2.5" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-ligne" />
          </div>
          <header className="flex items-start justify-between gap-4 px-5 pt-3 pb-4">
            <div className="min-w-0">
              <h2 className="texte-titres text-titres">{titre}</h2>
              {sousTitre && <p className="texte-secondaires mt-1 text-secondaires">{sousTitre}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={onFermer}
                aria-label={libelleFermer}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-creux text-encre-douce transition active:scale-90"
              >
                <X className="size-5" />
              </button>
            </div>
          </header>
        </div>
        {children}
        {pied}
      </div>
    </div>
  );
}
