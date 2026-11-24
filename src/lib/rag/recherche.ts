// Recherche dans la base de connaissance d'UN hôtel.
// Le filtre hotelId est appliqué dans la requête SQL elle-même :
// aucun fragment d'un autre locataire ne peut remonter.
import "server-only";
import { bdd } from "@/lib/bdd";
import { calculerEmbeddings, embeddingsDisponibles, versLitteralVecteur } from "@/lib/rag/embeddings";

export type ResultatRecherche = { contenu: string; score: number };

const NOMBRE_RESULTATS = 4;
// En dessous de ce score cosinus, le passage est jugé hors sujet :
// mieux vaut « je ne sais pas » qu'une réponse bâtie sur du bruit.
const SCORE_MINIMUM = 0.35;

export async function rechercherConnaissance(hotelId: string, requete: string): Promise<ResultatRecherche[]> {
  if (embeddingsDisponibles()) {
    try {
      return await rechercheVectorielle(hotelId, requete);
    } catch (erreur) {
      console.error("[rag] recherche vectorielle indisponible, repli plein texte", erreur);
    }
  }
  return rechercheTexte(hotelId, requete);
}

async function rechercheVectorielle(hotelId: string, requete: string): Promise<ResultatRecherche[]> {
  const [vecteur] = await calculerEmbeddings([requete], "query");
  const litteral = versLitteralVecteur(vecteur);

  const lignes = await bdd.$queryRaw<ResultatRecherche[]>`
    SELECT contenu, 1 - (embedding <=> ${litteral}::vector) AS score
    FROM "FragmentDocument"
    WHERE "hotelId" = ${hotelId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${litteral}::vector
    LIMIT ${NOMBRE_RESULTATS}
  `;
  return lignes.filter((ligne) => ligne.score >= SCORE_MINIMUM);
}

// Repli sans fournisseur d'embeddings : plein texte PostgreSQL (OU logique
// entre les mots significatifs). L'IA formule ses requêtes en français,
// langue des documents, ce qui rend ce repli exploitable.
async function rechercheTexte(hotelId: string, requete: string): Promise<ResultatRecherche[]> {
  const mots = requete
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 2);
  if (mots.length === 0) return [];

  const expression = mots.join(" | ");
  const lignes = await bdd.$queryRaw<ResultatRecherche[]>`
    SELECT contenu,
           ts_rank(to_tsvector('french', contenu), to_tsquery('french', ${expression}))::float AS score
    FROM "FragmentDocument"
    WHERE "hotelId" = ${hotelId}
      AND to_tsvector('french', contenu) @@ to_tsquery('french', ${expression})
    ORDER BY score DESC
    LIMIT ${NOMBRE_RESULTATS}
  `;
  return lignes;
}
