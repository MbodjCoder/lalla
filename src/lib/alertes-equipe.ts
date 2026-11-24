// Ce qui attend une décision de l'équipe : demandes confirmées par un client, pas encore
// acceptées, et avis décevants pas encore traités. Une seule définition, partagée par la file
// « À traiter », la pastille de navigation et les alertes sonores : tous comptent la même chose.
import "server-only";
import { bdd } from "@/lib/bdd";
import { versVue } from "@/lib/demandes";
import { choisirTraduction, type LangueEquipe } from "@/lib/langues";
import type { Prisma } from "@/generated/prisma/client";

// Un avis à cette note ou en dessous appelle un geste de l'hôtel pendant le séjour
export const NOTE_AVIS_A_TRAITER = 3;
// Au-delà, une demande restée sans réponse sort de la file (rangée « Expirée » dans l'historique)
const DUREE_DANS_LA_FILE_MS = 24 * 3600 * 1000;
// Interrogé toutes les 5 s par chaque poste : réponse bornée, même un jour de grande affluence
const ALERTES_MAX = 50;

const EN_ATTENTE = {
  in: ["CONFIRMEE", "PRISE_EN_CHARGE"],
} satisfies Prisma.EnumStatutDemandeFilter;
const limite = (maintenant: Date) => new Date(maintenant.getTime() - DUREE_DANS_LA_FILE_MS);

/** Demandes qui attendent l'équipe maintenant : transmises depuis moins de 24 h, séjour en cours. */
export function filtreDemandesATraiter(hotelId: string, maintenant = new Date()) {
  return {
    hotelId,
    statut: EN_ATTENTE,
    confirmeeLe: { gte: limite(maintenant) },
    OR: [{ sejourId: null }, { sejour: { statut: "EN_COURS" } }],
  } satisfies Prisma.DemandeWhereInput;
}

/** Demandes restées sans réponse trop longtemps, ou dont le client est parti : plus rien à faire. */
export function filtreDemandesExpirees(hotelId: string, maintenant = new Date()) {
  return {
    hotelId,
    statut: EN_ATTENTE,
    OR: [{ confirmeeLe: { lt: limite(maintenant) } }, { sejour: { statut: "TERMINE" } }],
  } satisfies Prisma.DemandeWhereInput;
}

/** Avis décevants à traiter pendant le séjour (ou reçus il y a moins de 24 h). */
export function filtreAvisATraiter(hotelId: string, maintenant = new Date()) {
  return {
    hotelId,
    traite: false,
    note: { lte: NOTE_AVIS_A_TRAITER },
    OR: [{ creeLe: { gte: limite(maintenant) } }, { sejour: { statut: "EN_COURS" } }],
  } satisfies Prisma.AvisWhereInput;
}

export type AlerteEquipe = {
  id: string;
  genre: "demande" | "avis";
  nature: "COMMANDE" | "SERVICE" | "INCIDENT" | "QUESTION" | "AVIS";
  chambre: string;
  resume: string; // dans la langue de l'équipe
  urgent: boolean;
};

export async function alertesEquipe(hotelId: string, langue: LangueEquipe): Promise<AlerteEquipe[]> {
  const maintenant = new Date();
  const [demandes, avis] = await Promise.all([
    bdd.demande.findMany({
      where: filtreDemandesATraiter(hotelId, maintenant),
      include: { chambre: { select: { numero: true } } },
      orderBy: [{ urgent: "desc" }, { confirmeeLe: "asc" }],
      take: ALERTES_MAX,
    }),
    bdd.avis.findMany({
      where: filtreAvisATraiter(hotelId, maintenant),
      include: { chambre: { select: { numero: true } } },
      orderBy: { creeLe: "asc" },
      take: ALERTES_MAX,
    }),
  ]);

  return [
    ...demandes.map((demande) => {
      const vue = versVue({ ...demande, lignes: [] });
      return {
        id: demande.id,
        genre: "demande" as const,
        nature: demande.type,
        chambre: demande.chambre.numero,
        resume: choisirTraduction(vue.textes, langue, vue.textes.fr).resume,
        urgent: demande.urgent,
      };
    }),
    ...avis.map((unAvis) => ({
      id: unAvis.id,
      genre: "avis" as const,
      nature: "AVIS" as const,
      chambre: unAvis.chambre.numero,
      resume: `${"★".repeat(unAvis.note)}${"☆".repeat(5 - unAvis.note)}`,
      urgent: false,
    })),
  ];
}
