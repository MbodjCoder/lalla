"use client";

import { ChevronRight, Globe, type LucideIcon } from "lucide-react";
import type { TraduireClient } from "@/lib/i18n/client";
import { FICHES_LANGUES, type LangueClient } from "@/lib/langues";
import { FeuilleBas } from "./FeuilleBas";
import { RUBRIQUES, type IdRubrique } from "./rubriques";

type Proprietes = {
  ouverte: boolean;
  ville: string;
  langue: LangueClient;
  t: TraduireClient;
  onFermer: () => void;
  onChoisir: (rubrique: IdRubrique) => void;
  onChoisirLangue: () => void;
};

// Le menu : les quatre rubriques de l'accueil, toujours à portée, puis la langue de l'interface.
export function FeuilleRubriques({ ouverte, ville, langue, t, onFermer, onChoisir, onChoisirLangue }: Proprietes) {
  return (
    <FeuilleBas ouverte={ouverte} titre={t("menu")} libelleFermer={t("fermer")} onFermer={onFermer}>
      <div className="marge-securite-bas space-y-4 px-5 pb-4">
        {/* Chaque rubrique dans sa propre carte, rapprochées : quatre choix distincts, un seul ensemble */}
        <ul className="space-y-2">
          {RUBRIQUES.map(({ id, icone, titre, detail }) => (
            <li key={id} className="overflow-hidden rounded-[22px] border border-ligne/80 bg-surface shadow-carte">
              <Ligne icone={icone} titre={t(titre)} detail={t(detail, { ville })} onClick={() => onChoisir(id)} />
            </li>
          ))}
        </ul>
        <div className="overflow-hidden rounded-[22px] border border-ligne/80 bg-surface shadow-carte">
          <Ligne icone={Globe} titre={t("langue")} detail={FICHES_LANGUES[langue].nomNatif} onClick={onChoisirLangue} />
        </div>
      </div>
    </FeuilleBas>
  );
}

function Ligne({
  icone: Icone,
  titre,
  detail,
  onClick,
}: {
  icone: LucideIcon;
  titre: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 px-4 py-3.5 text-start transition active:bg-creux"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-bouton/10 text-bouton" aria-hidden>
        <Icone className="size-6" strokeWidth={2.3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="texte-rubriques-menu block text-rubriques-menu">{titre}</span>
        <span className="texte-details-menu block truncate text-details-menu">{detail}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-encre-pale rtl:-scale-x-100" aria-hidden />
    </button>
  );
}
