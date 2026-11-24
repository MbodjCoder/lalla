// Ce qui attend l'équipe, compté une seule fois pour l'accueil, la page « Notifications » et
// ses onglets : commandes et demandes, questions et avis (Notifications), départs à
// enregistrer (Chambres), carte préparée par Lalla (Carte), fiches à relire (Paramètres).
import "server-only";
import { cache } from "react";
import { filtreAvisATraiter, filtreDemandesATraiter, NOTE_AVIS_A_TRAITER } from "@/lib/alertes-equipe";
import { bdd } from "@/lib/bdd";
import { lireHotel } from "@/lib/hotel-courant";
import type { SessionPersonnel } from "@/lib/session-personnel";

export type NotificationsHotel = {
  commandes: number; // commandes, demandes de service et signalements en attente
  questions: number; // questions transmises à l'équipe, sans réponse
  avis: number; // avis décevants à traiter, et nouveaux avis depuis la dernière visite
  notifications: number; // commandes + questions + avis
  chambres: number; // départs du jour ou dépassés, pas encore enregistrés
  carte: number; // articles préparés par Lalla, à vérifier (direction)
  parametres: number; // fiches de connaissances préparées par Lalla, à relire (direction)
};

// Sans visite enregistrée, un avis reste « nouveau » pendant 24 h
const DUREE_NOUVEAUTE_MS = 24 * 3600 * 1000;

/** Avis reçus depuis la dernière visite des avis : ils restent nouveaux jusqu'à cette visite. */
export const depuisDerniereVisite = (avisConsultesLe: Date | null) =>
  avisConsultesLe ?? new Date(Date.now() - DUREE_NOUVEAUTE_MS);

/** Les compteurs de l'hôtel, calculés une seule fois par affichage (barre du haut, accueil, page ouverte). */
export const notificationsHotel = ({ hotelId, role }: Pick<SessionPersonnel, "hotelId" | "role">) =>
  compter(hotelId, role);

const compter = cache(async (hotelId: string, role: SessionPersonnel["role"]): Promise<NotificationsHotel> => {
  const direction = role === "DIRECTION";
  const maintenant = new Date();
  const hotel = await lireHotel(hotelId);
  // Départs selon le calendrier de l'hôtel (dates « AAAA-MM-JJ », comparables comme du texte)
  const jourHotel = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: hotel.fuseauHoraire }).format(date);
  const aujourdhui = jourHotel(maintenant);

  const [questions, demandes, avisATraiter, nouveauxBonsAvis, sejours, carte, parametres] = await Promise.all([
    bdd.demande.count({ where: { ...filtreDemandesATraiter(hotelId, maintenant), type: "QUESTION" } }),
    bdd.demande.count({ where: filtreDemandesATraiter(hotelId, maintenant) }),
    bdd.avis.count({ where: filtreAvisATraiter(hotelId, maintenant) }),
    // Les avis décevants sont déjà comptés « à traiter » : ici, les autres nouveaux avis
    bdd.avis.count({
      where: {
        hotelId,
        note: { gt: NOTE_AVIS_A_TRAITER },
        creeLe: { gt: depuisDerniereVisite(hotel.avisConsultesLe) },
      },
    }),
    bdd.sejour.findMany({ where: { hotelId, statut: "EN_COURS" }, select: { depart: true } }),
    direction ? bdd.articleCatalogue.count({ where: { hotelId, aVerifier: true } }) : 0,
    direction ? bdd.document.count({ where: { hotelId, aVerifier: true } }) : 0,
  ]);
  const commandes = demandes - questions;
  const avis = avisATraiter + nouveauxBonsAvis;

  return {
    commandes,
    questions,
    avis,
    notifications: commandes + questions + avis,
    chambres: sejours.filter((sejour) => jourHotel(sejour.depart) <= aujourdhui).length,
    carte,
    parametres,
  };
});
