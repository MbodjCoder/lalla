// Variables d'environnement validées au démarrage.
// Les intégrations externes sont optionnelles : sans clé, Lalla bascule
// sur un mode dégradé explicite (console WhatsApp, recherche plein texte).
import "server-only";
import { z } from "zod";

const schemaEnv = z.object({
  DATABASE_URL: z.string().min(1),
  // Connexions simultanées à PostgreSQL par instance du serveur
  BDD_CONNEXIONS_MAX: z.coerce.number().int().min(2).max(100).default(15),
  ANTHROPIC_API_KEY: z.string().optional(),
  LALLA_MODELE_IA: z.string().default("claude-sonnet-5-5"),
  // Gemini (Google AI Studio), utilisé quand aucune clé Anthropic n'est présente
  GEMINI_API_KEY: z.string().optional(),
  // Cascade, du meilleur au plus modeste : chaque modèle a son propre quota gratuit
  LALLA_MODELES_GEMINI: z
    .string()
    .default(
      "gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash,gemini-3-flash-preview,gemini-3.5-flash-lite,gemini-3.1-flash-lite",
    ),
  // Impose un fournisseur quand les deux clés sont présentes
  LALLA_FOURNISSEUR: z.enum(["anthropic", "gemini"]).optional(),
  VOYAGE_API_KEY: z.string().optional(),
  WHATSAPP_JETON: z.string().optional(),
  WHATSAPP_ID_NUMERO: z.string().optional(),
  WHATSAPP_MODELE_NOTIFICATION: z.string().default("lalla_nouvelle_demande"),
  URL_PUBLIQUE: z.string().default("http://localhost:3000"),
  SECRET_SESSION: z.string().min(32, "SECRET_SESSION doit faire au moins 32 caractères"),
});

// Chaînes vides du .env traitées comme absentes
const brut = Object.fromEntries(Object.entries(process.env).filter(([, valeur]) => valeur !== ""));

export const env = schemaEnv.parse(brut);
