// Ajoute les photos du modèle par défaut aux articles qui n'en ont pas encore
// (hôtels créés avant l'arrivée des photos). Les photos choisies par l'hôtel
// ne sont jamais remplacées. Correspondance par nom d'article.
// Usage : pnpm carte:photos
import { config as chargerDotenv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ZoneTouristique } from "../src/generated/prisma/client";
import { catalogueModele } from "../src/lib/modele/catalogue";

chargerDotenv({ path: ".env.local" });
chargerDotenv();

const bdd = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const ZONES: ZoneTouristique[] = ["DAKAR", "PETITE_COTE", "SAINT_LOUIS", "SINE_SALOUM", "CASAMANCE", "AUTRE"];

async function main() {
  const photoParNom = new Map(
    ZONES.flatMap((zone) => catalogueModele(zone).flatMap((categorie) => categorie.articles)).map((article) => [
      article.nom,
      article.photo,
    ]),
  );

  const articles = await bdd.articleCatalogue.findMany({ where: { photo: null }, select: { id: true, nom: true } });
  let completes = 0;
  for (const article of articles) {
    const photo = photoParNom.get(article.nom);
    if (!photo) continue;
    await bdd.articleCatalogue.update({ where: { id: article.id }, data: { photo } });
    completes++;
  }
  console.info(`✓ ${completes} article(s) complété(s) sur ${articles.length} sans photo.`);
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  })
  .finally(() => bdd.$disconnect());
