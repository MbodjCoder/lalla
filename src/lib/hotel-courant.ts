// L'hôtel de l'équipe, lu une seule fois par affichage : la barre du haut, l'accueil et la page
// temporaire ouverte partagent la même lecture (cache de la requête, jamais d'une requête à l'autre).
import "server-only";
import { cache } from "react";
import { bdd } from "@/lib/bdd";

export const lireHotel = cache((hotelId: string) => bdd.hotel.findUniqueOrThrow({ where: { id: hotelId } }));
