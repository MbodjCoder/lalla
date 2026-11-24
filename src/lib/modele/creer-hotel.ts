// Création d'un hôtel à partir du modèle par défaut.
// Utilisé par la semence de démonstration et, demain, par l'inscription d'un hôtel.
import { customAlphabet } from "nanoid";
import type { Departement, Prisma, PrismaClient, ZoneTouristique } from "@/generated/prisma/client";
import { indexerDocument } from "@/lib/rag/indexation";
import { catalogueModele } from "./catalogue";
import { documentsModele } from "./documents";

const genererJetonQr = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 12);

export const DEPARTEMENTS: Departement[] = [
  "RECEPTION",
  "ETAGES",
  "RESTAURATION",
  "TECHNIQUE",
  "CONCIERGERIE",
  "BIEN_ETRE",
];

export type ParametresNouvelHotel = {
  nom: string;
  slug: string;
  ville: string;
  zone: ZoneTouristique;
  numerosChambres: string[];
  couleurAccent?: string;
  // Champs facultatifs de la fiche hôtel (téléphones, Wi-Fi, liens…)
  fiche?: Omit<Prisma.HotelCreateInput, "nom" | "slug" | "ville" | "zone">;
  // Jetons QR imposés (ex. chambre de démonstration) : { "304": "chambre304" }
  jetonsImposes?: Record<string, string>;
};

export async function creerHotelDepuisModele(bdd: PrismaClient, parametres: ParametresNouvelHotel) {
  const { nom, slug, ville, zone, numerosChambres, couleurAccent, fiche, jetonsImposes } = parametres;

  const hotel = await bdd.hotel.create({
    data: {
      ...fiche,
      nom,
      slug,
      ville,
      zone,
      ...(couleurAccent ? { couleurAccent } : {}),
      // Tous les services existent ; sans numéro dédié, ils notifient la réception
      services: { create: DEPARTEMENTS.map((departement) => ({ departement })) },
      chambres: {
        create: numerosChambres.map((numero) => ({
          numero,
          etage: /^\d/.test(numero) ? Number(numero[0]) : null,
          jetonQr: jetonsImposes?.[numero] ?? genererJetonQr(),
        })),
      },
    },
  });

  for (const [ordreCategorie, categorie] of catalogueModele(zone).entries()) {
    await bdd.categorieCatalogue.create({
      data: {
        hotelId: hotel.id,
        nom: categorie.nom,
        type: categorie.type,
        departement: categorie.departement,
        horaires: categorie.horaires,
        traductions: categorie.traductions,
        ordre: ordreCategorie,
        aVerifier: true,
        articles: {
          create: categorie.articles.map((article, ordre) => ({
            hotelId: hotel.id,
            nom: article.nom,
            description: article.description,
            prix: article.prix,
            photo: article.photo,
            traductions: article.traductions,
            ordre,
            aVerifier: true,
          })),
        },
      },
    });
  }

  for (const document of documentsModele(zone)) {
    const cree = await bdd.document.create({ data: { hotelId: hotel.id, ...document, aVerifier: true } });
    await indexerDocument(bdd, cree.id);
  }

  return hotel;
}
