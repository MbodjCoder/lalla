// Un cercle de destination (écran « Hôtel ») : son icône dedans, son nom dessous, et le nombre
// de choses qui l'attendent en pastille. Chaque cercle a ses couleurs (fond, icône, texte),
// réglées dans Design → Équipe → Hôtel.
import type { LucideIcon } from "lucide-react";
import { Pastille } from "./Pastille";

export type CleCercle = "hotel" | "chambres" | "carte" | "parametres";

export type Cercle = {
  cle: CleCercle;
  href: string;
  icone: LucideIcon;
  libelle: string;
  notifications?: number;
};

/** Les couleurs du cercle (variables --eq-<cercle>*) : absentes, celles d'origine s'appliquent (globals.css). */
export const couleursCercle = (cle: CleCercle) =>
  ({
    "--eq-c-fond": `var(--eq-${cle}Fond)`,
    "--eq-c-icone": `var(--eq-${cle}Icone)`,
    "--eq-c-texte": `var(--eq-${cle}Texte)`,
  }) as React.CSSProperties;

/** Le cercle seul (icône, pastille, nom) : partagé par les liens et par le bouton « Hôtel ». */
export function FaceCercle({ icone: Icone, libelle, notifications = 0 }: Omit<Cercle, "href" | "cle">) {
  return (
    <>
      <span className="relative grid size-16 place-items-center rounded-full border border-ligne bg-cercle text-icone-cercle shadow-carte transition duration-200 group-hover:-translate-y-0.5 group-hover:border-encre/25 group-active:scale-95">
        <Icone className="size-[26px]" strokeWidth={2.3} aria-hidden />
        <Pastille nombre={notifications} className="absolute -end-1 -top-1 border-fond" />
      </span>
      <span className="texte-tuiles-equipe line-clamp-2 max-w-24 break-words text-texte-cercle">{libelle}</span>
    </>
  );
}
