// Services demandés depuis l'interface, sans passer par Lalla.
//  • Un geste suffit (serviettes, ménage…) : la carte à confirmer s'affiche aussitôt.
//  • Un court formulaire précise le moment (réveil, taxi, départ tardif) : l'envoi vaut confirmation,
//    la demande part directement à l'équipe.
import type { CleTexteClient } from "@/lib/i18n/client";

export const SERVICES_DIRECTS = [
  "serviettes",
  "menage",
  "linge",
  "produits",
  "wifi",
  "reveil",
  "taxi",
  "departTardif",
] as const;
export type ServiceDirect = (typeof SERVICES_DIRECTS)[number];

type DefinitionService = {
  categorie: "linge" | "menage" | "question" | "reveil" | "transport" | "autre";
  resume: CleTexteClient; // intitulé de la carte, traduit dans chaque langue de la demande
  formulaire?: { heurePrevue: boolean }; // précisé par un formulaire ; heurePrevue : l'heure choisie est annoncée
};

export const DEFINITIONS_SERVICES: Record<ServiceDirect, DefinitionService> = {
  serviettes: { categorie: "linge", resume: "resumeServiettes" },
  menage: { categorie: "menage", resume: "resumeMenage" },
  linge: { categorie: "linge", resume: "resumeLinge" },
  produits: { categorie: "linge", resume: "resumeProduits" },
  wifi: { categorie: "question", resume: "wifiMessage" },
  reveil: { categorie: "reveil", resume: "serviceReveil", formulaire: { heurePrevue: true } },
  taxi: { categorie: "transport", resume: "serviceTaxi", formulaire: { heurePrevue: true } },
  departTardif: { categorie: "autre", resume: "resumeDepartTardif", formulaire: { heurePrevue: false } },
};
