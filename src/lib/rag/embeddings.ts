// Embeddings multilingues via Voyage AI (fournisseur recommandé par Anthropic).
// Un seul espace vectoriel pour toutes les langues : une question en anglais
// retrouve un passage rédigé en français.
const URL_VOYAGE = "https://api.voyageai.com/v1/embeddings";
export const MODELE_EMBEDDING = "voyage-3.5";
export const DIMENSION_EMBEDDING = 1024;

type TypeEntree = "document" | "query";

export function embeddingsDisponibles(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

export async function calculerEmbeddings(textes: string[], type: TypeEntree): Promise<number[][]> {
  const reponse = await fetch(URL_VOYAGE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20 * 1000),
    body: JSON.stringify({
      input: textes,
      model: MODELE_EMBEDDING,
      input_type: type,
      output_dimension: DIMENSION_EMBEDDING,
    }),
  });

  if (!reponse.ok) {
    throw new Error(`Voyage AI ${reponse.status} : ${await reponse.text()}`);
  }

  const { data } = (await reponse.json()) as { data: { embedding: number[]; index: number }[] };
  return data.sort((a, b) => a.index - b.index).map((ligne) => ligne.embedding);
}

/** Format littéral pgvector : « [0.12,-0.03,…] ». */
export function versLitteralVecteur(vecteur: number[]): string {
  return `[${vecteur.join(",")}]`;
}
