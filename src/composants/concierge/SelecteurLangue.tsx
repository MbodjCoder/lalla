"use client";

import { Check } from "lucide-react";
import type { TraduireClient } from "@/lib/i18n/client";
import { FICHES_LANGUES, LANGUES_CLIENT, type LangueClient } from "@/lib/langues";
import { FeuilleBas } from "./FeuilleBas";

type Proprietes = {
  ouvert: boolean;
  langue: LangueClient;
  t: TraduireClient;
  onChoisir: (langue: LangueClient) => void;
  onFermer: () => void;
};

// Choix de la langue : interface, carte, cartes de demande ET réponses de
// l'assistant basculent ensemble dans la langue choisie.
export function SelecteurLangue({ ouvert, langue, t, onChoisir, onFermer }: Proprietes) {
  return (
    <FeuilleBas ouverte={ouvert} titre={t("choisirLangue")} libelleFermer={t("fermer")} onFermer={onFermer}>
      <ul className="marge-securite-bas grid grid-cols-2 gap-2.5 overflow-y-auto px-6 pb-6" role="radiogroup">
        {LANGUES_CLIENT.map((code) => {
          const active = code === langue;
          const fiche = FICHES_LANGUES[code];
          return (
            <li key={code}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                lang={code}
                dir={fiche.sens}
                onClick={() => onChoisir(code)}
                className={`flex h-16 w-full items-center justify-between gap-2 rounded-2xl border px-4 text-start transition active:scale-[0.97] ${
                  active ? "border-accent bg-accent-pale text-accent-profond" : "border-ligne bg-surface text-encre"
                }`}
              >
                <span className="text-[16.5px] font-semibold">{fiche.nomNatif}</span>
                {active ? (
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-encre-pale">{code}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </FeuilleBas>
  );
}
