// Données de démonstration : un hôtel fictif créé à partir du MODÈLE PAR DÉFAUT,
// exactement comme le serait un nouvel hôtel client.
// Lancement : pnpm bdd:semer   (idempotent : l'hôtel de démo est recréé)
import { config as chargerDotenv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { creerHotelDepuisModele } from "../src/lib/modele/creer-hotel";

chargerDotenv({ path: ".env.local" });
chargerDotenv();

const bdd = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const SLUG_DEMO = "hotel-saly";
// Jeton fixe de la chambre de démonstration : /c/chambre304
const JETON_CHAMBRE_DEMO = "chambre304";

async function main() {
  console.info("→ Suppression de l'hôtel de démo existant…");
  await bdd.hotel.deleteMany({ where: { slug: SLUG_DEMO } });

  console.info("→ Création depuis le modèle par défaut (zone : Dakar)…");
  const hotel = await creerHotelDepuisModele(bdd, {
    nom: "Hôtel & Spa",
    slug: SLUG_DEMO,
    ville: "Dakar",
    zone: "DAKAR",
    couleurAccent: "#8c7349",
    numerosChambres: [1, 2, 3].flatMap((etage) => [1, 2, 3, 4, 5].map((n) => `${etage}0${n}`)),
    jetonsImposes: { "304": JETON_CHAMBRE_DEMO },
    fiche: {
      logoUrl: "/images/logos/logo-hotel.svg?v=2",
      telephoneReception: "+221 33 800 00 00",
      whatsappReception: "221770000000",
      whatsappDirection: "221770000001",
      lienAvisPublic: "https://www.tripadvisor.fr/",
      lienReservation: "https://hotel-saly.example/reserver",
      codeFidelite: "SEJOUR10",
      wifiReseau: "Hotel-Invites",
      wifiMotDePasse: "teranga2026",
    },
  });

  console.info("→ Séjours en cours…");
  const maintenant = Date.now();
  const jour = 24 * 3600 * 1000;
  const chambres = await bdd.chambre.findMany({ where: { hotelId: hotel.id, numero: { in: ["304", "201"] } } });
  const parNumero = Object.fromEntries(chambres.map((chambre) => [chambre.numero, chambre.id]));
  await bdd.sejour.createMany({
    data: [
      // Départ demain : la carte d'avis s'affiche à l'ouverture
      { hotelId: hotel.id, chambreId: parNumero["304"], nomClient: "M. et Mme Diallo", arrivee: new Date(maintenant - 3 * jour), depart: new Date(maintenant + jour) },
      { hotelId: hotel.id, chambreId: parNumero["201"], nomClient: "Mrs. Johnson", arrivee: new Date(maintenant - jour), depart: new Date(maintenant + 4 * jour) },
    ],
  });

  console.info("→ Personnel…");
  // En ligne, le mot de passe de démo public est refusé : SEMENCE_MOT_DE_PASSE (16+ caractères) l'impose
  const motDePasse = process.env.SEMENCE_MOT_DE_PASSE ?? "lalla2026";
  const enLigne = !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");
  if (enLigne && motDePasse.length < 16) throw new Error("Base en ligne : définissez SEMENCE_MOT_DE_PASSE (16 caractères ou plus).");
  const motDePasseHash = await bcrypt.hash(motDePasse, 10);
  await bdd.personnel.createMany({
    data: [
      { hotelId: hotel.id, nom: "Awa Ndiaye", email: "direction@hotel-saly.sn", motDePasseHash, role: "DIRECTION" },
      { hotelId: hotel.id, nom: "Moussa Fall", email: "reception@hotel-saly.sn", motDePasseHash, role: "RECEPTION" },
    ],
  });

  const url = process.env.URL_PUBLIQUE ?? "http://localhost:3000";
  console.info(`\n✓ Démo prête.
  Client (chambre 304) : ${url}/c/${JETON_CHAMBRE_DEMO}
  Espace hôtel        : ${url}/espace
    direction@hotel-saly.sn   (tout)
    reception@hotel-saly.sn   (opérationnel)
  Mot de passe : ${enLigne ? "celui de SEMENCE_MOT_DE_PASSE" : motDePasse}\n`);
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  })
  .finally(() => bdd.$disconnect());
