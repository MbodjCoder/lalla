// Point d'entrée du client : URL encodée dans le QR code de la chambre.
// Rendu serveur complet (salutation, carte et ses traductions) : premier
// affichage instantané, en français par défaut ; le client change de langue
// d'un geste, sans rechargement.
import type { Metadata, Viewport } from "next";
import { Concierge } from "@/composants/concierge/Concierge";
import { QrInvalide } from "@/composants/concierge/QrInvalide";
import { bdd } from "@/lib/bdd";
import { avisAttendu, resoudreChambre } from "@/lib/contexte-chambre";
import type { CategorieVue } from "@/lib/types";
import { lireTypographie } from "@/lib/typographie";

export const dynamic = "force-dynamic";

// Barre du navigateur au blanc de l'en-tête dès le premier affichage
export const viewport: Viewport = { themeColor: "#ffffff" };

type Proprietes = { params: Promise<{ jeton: string }> };

export async function generateMetadata({ params }: Proprietes): Promise<Metadata> {
  const contexte = await resoudreChambre((await params).jeton);
  return { title: contexte ? `${contexte.hotel.nom} · Concierge` : "Lalla" };
}

export default async function PageChambre({ params }: Proprietes) {
  const { jeton } = await params;
  const contexte = await resoudreChambre(jeton);
  if (!contexte) return <QrInvalide />;

  const { hotel, chambre, sejour } = contexte;
  const categories = await bdd.categorieCatalogue.findMany({
    where: { hotelId: hotel.id },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
    include: {
      // Les articles indisponibles restent visibles côté client, sans pouvoir être ajoutés
      articles: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
    },
  });

  const carte: CategorieVue[] = categories
    .filter((categorie) => categorie.articles.length > 0)
    .map((categorie) => ({
      id: categorie.id,
      nom: categorie.nom,
      type: categorie.type === "BOISSONS" ? "RESTAURATION" : categorie.type,
      horaires: categorie.horaires,
      traductions: categorie.traductions as CategorieVue["traductions"],
      articles: categorie.articles.map((article) => ({
        id: article.id,
        nom: article.nom,
        description: article.description,
        prix: article.prix,
        photo: article.photo,
        disponible: article.disponible,
        traductions: article.traductions as CategorieVue["articles"][number]["traductions"],
      })),
    }));

  return (
    <Concierge
      jeton={jeton}
      hotel={{
        nom: hotel.nom,
        sousTitre: hotel.sousTitre,
        logoUrl: hotel.logoUrl,
        ville: hotel.ville,
        nomAssistant: hotel.nomAssistant,
        couleurAccent: hotel.couleurAccent,
        couleurMessages: hotel.couleurMessages,
        couleurFond: hotel.couleurFond,
        couleurHoraires: hotel.couleurHoraires,
        couleurIcones: hotel.couleurIcones,
        couleurMessagesClient: hotel.couleurMessagesClient,
        couleurBoutons: hotel.couleurBoutons,
        devise: hotel.devise,
        typographie: lireTypographie(hotel.typographie),
      }}
      infos={{
        wifiReseau: hotel.wifiReseau,
        wifiMotDePasse: hotel.wifiMotDePasse,
        heureCheckout: hotel.heureCheckout,
        depart: sejour?.depart.toISOString() ?? null,
        fuseauHoraire: hotel.fuseauHoraire,
        telephoneReception: hotel.telephoneReception,
      }}
      numeroChambre={chambre.numero}
      carte={carte}
      avisAttendu={avisAttendu(contexte)}
    />
  );
}
