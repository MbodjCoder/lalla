// Le nom de l'assistante, partout où il apparaît dans un message, avec le style réglé
// par la direction (Informations → Textes → Nom de l'assistante).
import { Fragment, type ReactNode } from "react";

export function NomAssistant({ children }: { children: ReactNode }) {
  return <span className="texte-nom-assistant text-nom-assistant">{children}</span>;
}

const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Le texte, où chaque occurrence du nom (mot entier, majuscules ou non) prend le style du nom :
 * « merci lalla » comme « Lalla vous répond ». Le reste du texte est rendu tel quel.
 */
export function avecNomAssistant(texte: string, nom: string): ReactNode[] {
  if (!nom.trim()) return [texte];
  const motif = new RegExp(`(?<![\\p{L}\\p{N}])(${echapper(nom.trim())})(?![\\p{L}\\p{N}])`, "giu");
  // split avec un groupe capturant : les noms trouvés occupent les positions impaires
  return texte
    .split(motif)
    .map((morceau, index) =>
      index % 2 === 1 ? <NomAssistant key={index}>{morceau}</NomAssistant> : <Fragment key={index}>{morceau}</Fragment>,
    );
}
