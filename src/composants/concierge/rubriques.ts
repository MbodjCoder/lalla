import { BedDouble, ConciergeBell, Info, TreePalm, type LucideIcon } from "lucide-react";
import type { CleTexteClient } from "@/lib/i18n/client";

export type IdRubrique = "roomService" | "services" | "activites" | "infos";

type Rubrique = {
  id: IdRubrique;
  icone: LucideIcon;
  titre: CleTexteClient;
  /** Nom plus court sous le rond de l'accueil, quand il diffère du titre */
  nomAccueil?: CleTexteClient;
  detail: CleTexteClient;
};

// Les quatre besoins les plus fréquents d'un client en chambre. Chacun ouvre
// sa propre feuille : rien n'est envoyé à Lalla tant que le client n'a pas choisi.
export const RUBRIQUES: Rubrique[] = [
  {
    id: "roomService",
    icone: ConciergeBell,
    titre: "tuileRoomService",
    nomAccueil: "tuileRepas",
    detail: "tuileRoomServiceDetail",
  },
  {
    id: "services",
    icone: BedDouble,
    titre: "tuileService",
    detail: "tuileServiceDetail",
  },
  {
    id: "activites",
    icone: TreePalm,
    titre: "tuileActivites",
    detail: "tuileActivitesDetail",
  },
  { id: "infos", icone: Info, titre: "tuileInfos", detail: "tuileInfosDetail" },
];
