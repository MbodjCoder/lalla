// Rendu minimal et sûr du texte de l'assistant : paragraphes, listes « - »,
// gras **…**, liens cliquables et nom de l'assistante dans son style. Aucun HTML injecté.
import { Fragment, type ReactNode } from "react";
import { avecNomAssistant } from "./NomAssistant";

const MOTIF_EN_LIGNE = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g;

function rendreEnLigne(texte: string, nom: string): ReactNode[] {
  return texte.split(MOTIF_EN_LIGNE).map((morceau, index) => {
    if (morceau.startsWith("**") && morceau.endsWith("**")) {
      return (
        <strong key={index} className="font-bold">
          {avecNomAssistant(morceau.slice(2, -2), nom)}
        </strong>
      );
    }
    if (/^https?:\/\//.test(morceau)) {
      const ponctuation = morceau.match(/[.,;:!?]+$/)?.[0] ?? "";
      const url = ponctuation ? morceau.slice(0, -ponctuation.length) : morceau;
      return (
        <Fragment key={index}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-current/40 underline-offset-[3px] break-all"
          >
            {url.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
          {ponctuation}
        </Fragment>
      );
    }
    return <Fragment key={index}>{avecNomAssistant(morceau, nom)}</Fragment>;
  });
}

const MOTIF_PUCE = /^\s*[-•*]\s+/;

type Bloc = { genre: "paragraphe"; lignes: string[] } | { genre: "liste"; elements: string[] };

// Regroupe les lignes en paragraphes et listes : une liste peut suivre
// directement une phrase d'introduction, sans ligne vide.
function decouperEnBlocs(texte: string): Bloc[] {
  const blocs: Bloc[] = [];
  for (const ligne of texte.trim().split("\n")) {
    const dernier = blocs.at(-1);
    if (!ligne.trim()) {
      blocs.push({ genre: "paragraphe", lignes: [] });
    } else if (MOTIF_PUCE.test(ligne)) {
      const element = ligne.replace(MOTIF_PUCE, "");
      if (dernier?.genre === "liste") dernier.elements.push(element);
      else blocs.push({ genre: "liste", elements: [element] });
    } else if (dernier?.genre === "paragraphe") {
      dernier.lignes.push(ligne);
    } else {
      blocs.push({ genre: "paragraphe", lignes: [ligne] });
    }
  }
  return blocs.filter((bloc) => bloc.genre === "liste" || bloc.lignes.length > 0);
}

export function TexteRiche({ texte, nomAssistant }: { texte: string; nomAssistant: string }) {
  return (
    <div className="space-y-2">
      {decouperEnBlocs(texte).map((bloc, index) =>
        bloc.genre === "liste" ? (
          <ul key={index} className="space-y-1.5">
            {bloc.elements.map((element, rang) => (
              <li key={rang} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.7em] size-1 shrink-0 rounded-full bg-current opacity-60" />
                <span>{rendreEnLigne(element, nomAssistant)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-line">
            {rendreEnLigne(bloc.lignes.join("\n"), nomAssistant)}
          </p>
        ),
      )}
    </div>
  );
}
