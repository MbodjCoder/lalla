// Réindexation RAG des documents.
// Usage : pnpm rag:indexer [slug-hotel]   (sans argument : tous les hôtels)
// À relancer après modification d'un document ou ajout de VOYAGE_API_KEY.
import { config as chargerDotenv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { indexerDocument } from "../src/lib/rag/indexation";
import { embeddingsDisponibles } from "../src/lib/rag/embeddings";

chargerDotenv({ path: ".env.local" });
chargerDotenv();

const bdd = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const slug = process.argv[2];
  const documents = await bdd.document.findMany({
    where: slug ? { hotel: { slug } } : undefined,
    include: { hotel: { select: { nom: true } } },
  });

  console.info(
    `→ ${documents.length} document(s) — ${embeddingsDisponibles() ? "embeddings Voyage AI" : "sans embeddings (recherche plein texte)"}`,
  );
  for (const document of documents) {
    const fragments = await indexerDocument(bdd, document.id);
    console.info(`   ${document.hotel.nom} · ${document.titre} : ${fragments} fragments`);
  }
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  })
  .finally(() => bdd.$disconnect());
