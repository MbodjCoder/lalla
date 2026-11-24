// Découpage d'un document en fragments cohérents pour l'indexation.
// Stratégie : on respecte les paragraphes et les titres, on regroupe
// jusqu'à ~900 caractères, et chaque fragment rappelle le titre du
// document (le contexte améliore nettement la pertinence de la recherche).
const TAILLE_CIBLE = 900;

export function decouperDocument(titre: string, contenu: string): string[] {
  const blocs = contenu
    .split(/\n\s*\n/)
    .map((bloc) => bloc.trim())
    .filter(Boolean);

  const fragments: string[] = [];
  let courant = "";

  for (const bloc of blocs) {
    const estTitre = /^#{1,6}\s/.test(bloc);
    const deborde = courant.length + bloc.length > TAILLE_CIBLE;
    if (courant && (estTitre || deborde)) {
      fragments.push(courant);
      courant = "";
    }
    courant = courant ? `${courant}\n\n${bloc}` : bloc;
  }
  if (courant) fragments.push(courant);

  return fragments.map((fragment) => `[${titre}]\n${fragment}`);
}
