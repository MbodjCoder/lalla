// Fournisseur d'IA et client Anthropic partagé, créé à la première utilisation :
// sans clé configurée, le reste de l'application démarre normalement.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let instance: Anthropic | null = null;

// Un appel bloqué ne doit jamais retenir un tour au-delà de la durée maximale de la route (60 s)
const DELAI_MAX_APPEL_MS = 45 * 1000;

export function clientAnthropic(): Anthropic {
  instance ??= new Anthropic({ timeout: DELAI_MAX_APPEL_MS, maxRetries: 1 });
  return instance;
}

export type FournisseurIA = "anthropic" | "gemini";

/**
 * Fournisseur utilisé : celui imposé par LALLA_FOURNISSEUR, sinon le premier
 * dont la clé est présente (Claude, puis Gemini). null : mode secours seul.
 */
export function fournisseurIA(): FournisseurIA | null {
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const impose = process.env.LALLA_FOURNISSEUR;
  if (impose === "anthropic" && anthropic) return "anthropic";
  if (impose === "gemini" && gemini) return "gemini";
  if (anthropic) return "anthropic";
  if (gemini) return "gemini";
  return null;
}

export function iaConfiguree(): boolean {
  return fournisseurIA() !== null;
}
