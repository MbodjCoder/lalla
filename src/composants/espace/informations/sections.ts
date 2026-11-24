// Les sections de « Informations », décrites une seule fois : le sommaire,
// la recherche et les formulaires en découlent. Ajouter un réglage = ajouter un champ ici
// (et sa colonne dans enregistrerInformations).
import {
  BookOpen,
  Building2,
  CircleHelp,
  Compass,
  FileText,
  Link2,
  Phone,
  ScrollText,
  Timer,
  UtensilsCrossed,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { SectionInformations } from "@/app/espace/actions";
import type { TypeDocument } from "@/generated/prisma/enums";
import { cleDepartement, type CleTexteEquipe, type TraduireEquipe } from "@/lib/i18n/equipe";

export type DefinitionChamp = {
  nom: string;
  libelle: (t: TraduireEquipe) => string;
  type?: "text" | "tel" | "url" | "time" | "number" | "langue";
  aide?: CleTexteEquipe;
  placeholder?: CleTexteEquipe;
};

export type DefinitionSection = {
  id: SectionInformations;
  icone: LucideIcon;
  titre: (t: TraduireEquipe) => string;
  description: CleTexteEquipe;
  champs: DefinitionChamp[];
};

const champ = (nom: string, libelle: CleTexteEquipe, options: Omit<DefinitionChamp, "nom" | "libelle"> = {}) => ({
  nom,
  libelle: (t: TraduireEquipe) => t(libelle),
  ...options,
});

// Services qui peuvent recevoir leurs demandes sur leur propre WhatsApp
const SERVICES = ["ETAGES", "RESTAURATION", "TECHNIQUE", "CONCIERGERIE", "BIEN_ETRE"] as const;

export const SECTIONS_HOTEL: DefinitionSection[] = [
  {
    id: "identite",
    icone: Building2,
    titre: (t) => t("identite"),
    description: "descIdentite",
    champs: [
      champ("nom", "nomHotel"),
      champ("sousTitre", "sousTitreHotel", { placeholder: "exempleSousTitre" }),
      champ("nomAssistant", "nomAssistant"),
      champ("langueEquipe", "langueEquipe", { type: "langue" }),
    ],
  },
  {
    id: "contacts",
    icone: Phone,
    titre: (t) => t("contacts"),
    description: "descContacts",
    champs: [
      champ("telephoneReception", "telephoneReception", { type: "tel" }),
      champ("whatsappReception", "whatsappReception", {
        type: "tel",
        aide: "formatNumero",
      }),
      champ("whatsappDirection", "whatsappDirection", {
        type: "tel",
        aide: "formatNumero",
      }),
      ...SERVICES.map((service) => ({
        nom: `whatsapp_${service}`,
        libelle: (t: TraduireEquipe) => t("whatsappService", { service: t(cleDepartement(service)) }),
        type: "tel" as const,
        placeholder: "siVideReception" as const,
      })),
    ],
  },
  {
    id: "sejour",
    icone: Wifi,
    titre: (t) => `${t("wifi")} · ${t("sejour")}`,
    description: "descSejour",
    champs: [
      champ("wifiReseau", "reseauWifi"),
      champ("wifiMotDePasse", "motDePasseWifi"),
      champ("heureCheckout", "heureCheckout", { type: "time" }),
    ],
  },
  {
    id: "delais",
    icone: Timer,
    titre: (t) => t("delais"),
    description: "descDelais",
    champs: [
      champ("delaiRestauration", "delaiRestauration", { type: "number" }),
      champ("delaiEtages", "delaiEtages", { type: "number" }),
      champ("delaiTechnique", "delaiTechnique", { type: "number" }),
    ],
  },
  {
    id: "liens",
    icone: Link2,
    titre: (t) => t("liens"),
    description: "descLiens",
    champs: [
      champ("lienAvisPublic", "lienAvis", { type: "url" }),
      champ("lienReservation", "lienReservation", { type: "url" }),
      champ("codeFidelite", "codeFidelite"),
    ],
  },
];

// Icône de chaque fiche de connaissance, selon sa nature
export const ICONES_DOCUMENT: Record<TypeDocument, LucideIcon> = {
  LIVRET_ACCUEIL: BookOpen,
  MENU: UtensilsCrossed,
  CONSIGNES: ScrollText,
  FAQ: CircleHelp,
  RECOMMANDATIONS: Compass,
  AUTRE: FileText,
};
