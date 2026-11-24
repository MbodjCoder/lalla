// Résolution du jeton QR → hôtel, chambre et séjour en cours.
// Point d'entrée unique côté client : aucune donnée n'est accessible
// sans un jeton de chambre valide et actif.
import "server-only";
import { cache } from "react";
import { bdd } from "@/lib/bdd";

// Une seule lecture par requête (métadonnées et page la partagent)
export const resoudreChambre = cache(async (jetonQr: string) => {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(jetonQr)) return null;

  const chambre = await bdd.chambre.findUnique({
    where: { jetonQr },
    include: {
      hotel: true,
      sejours: {
        where: { statut: "EN_COURS" },
        orderBy: { arrivee: "desc" },
        take: 1,
      },
    },
  });

  if (!chambre || !chambre.actif || !chambre.hotel.actif) return null;

  const { sejours, hotel, ...infosChambre } = chambre;
  return { hotel, chambre: infosChambre, sejour: sejours[0] ?? null };
});

export type ContexteChambre = NonNullable<Awaited<ReturnType<typeof resoudreChambre>>>;

/** Le client peut-il passer commande depuis cette chambre ? */
export function peutCommander({ hotel, sejour }: ContexteChambre): boolean {
  return !hotel.exigerSejourActif || sejour !== null;
}

/** Faut-il proposer l'avis de séjour (veille ou jour du départ) ? */
export function avisAttendu({ hotel, sejour }: ContexteChambre, maintenant = new Date()): boolean {
  if (!sejour || sejour.avisSollicite) return false;
  const jour = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: hotel.fuseauHoraire }).format(d);
  const demain = new Date(maintenant.getTime() + 24 * 3600 * 1000);
  const depart = jour(sejour.depart);
  return depart === jour(maintenant) || depart === jour(demain);
}
