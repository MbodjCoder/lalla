"use client";

import type { TraduireClient } from "@/lib/i18n/client";
import { RUBRIQUES, type IdRubrique } from "./rubriques";

type Proprietes = {
  t: TraduireClient;
  carteAvis: React.ReactNode;
  onOuvrirRubrique: (rubrique: IdRubrique) => void;
};

// Écran d'accueil, ouvert dès le scan du QR code : tout tient sur un écran de téléphone.
// Tout se joue en bas, près du pouce : juste au-dessus du champ, les quatre besoins les plus
// fréquents (chacun ouvre sa feuille).
export function Accueil({ t, carteAvis, onOuvrirRubrique }: Proprietes) {
  return (
    <section className="flex h-full flex-col pt-[clamp(1rem,3dvh,1.75rem)] pb-[clamp(0.75rem,2dvh,1.25rem)]">
      <h1 className="sr-only">{t("titreAccueil")}</h1>

      {carteAvis && <div className="animate-montee">{carteAvis}</div>}

      <div className="min-h-3 flex-1" />

      {/* Les quatre rubriques sur une ligne, juste au-dessus du champ : l'icône dans un rond, son nom dessous */}
      <ul className="mx-auto grid w-full max-w-sm grid-cols-4 gap-2">
        {RUBRIQUES.map(({ id, icone: Icone, titre, nomAccueil }, rang) => (
          <li key={id} className="animate-montee" style={{ animationDelay: `${120 + rang * 50}ms` }}>
            <button
              type="button"
              onClick={() => onOuvrirRubrique(id)}
              className="group flex w-full flex-col items-center gap-2 text-center"
            >
              <span className="flex size-[clamp(3.5rem,16vw,4.25rem)] items-center justify-center rounded-full border border-ligne/60 bg-surface shadow-[0_1px_2px_rgb(26_27_23/0.05),0_10px_24px_-14px_rgb(26_27_23/0.4)] transition duration-200 ease-out group-hover:-translate-y-0.5 group-active:translate-y-0 group-active:scale-[0.94] group-active:bg-creux">
                <Icone className="size-7" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="texte-rubriques-accueil line-clamp-2 max-w-full text-rubriques-accueil">
                {t(nomAccueil ?? titre)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
