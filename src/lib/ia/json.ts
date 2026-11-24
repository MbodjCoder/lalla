// Réponse structurée du modèle (JSON validé par un schéma), quel que soit le fournisseur.
import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";
import { clientAnthropic, fournisseurIA } from "@/lib/ia/client";
import { completerJsonGemini } from "@/lib/ia/gemini";

export async function completerJson<T>(
  systeme: string,
  demande: string,
  schema: z.ZodType<T>,
  jetonsMax = 4000,
): Promise<T> {
  if (fournisseurIA() === "gemini") return completerJsonGemini(systeme, demande, schema);

  const reponse = await clientAnthropic().messages.parse({
    model: env.LALLA_MODELE_IA,
    max_tokens: jetonsMax,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    system: systeme,
    messages: [{ role: "user", content: demande }],
  });
  if (!reponse.parsed_output) throw new Error("Réponse structurée illisible");
  return reponse.parsed_output as T;
}
