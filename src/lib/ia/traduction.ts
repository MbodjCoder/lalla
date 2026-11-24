// Traductions automatiques par le modèle, en sortie structurée (JSON validé).
//  • fil de conversation : quand le client change de langue, les réponses déjà
//    affichées sont traduites (résultat mis en cache sur chaque message) ;
//  • carte : un article créé ou modifié par le gérant est traduit dans les
//    7 autres langues des clients.
import "server-only";
import { z } from "zod";
import { completerJson } from "@/lib/ia/json";
import { FICHES_LANGUES, LANGUES_CLIENT, type LangueClient } from "@/lib/langues";

/** Traduit une liste de textes vers une langue, en conservant l'ordre et la mise en forme. */
export async function traduireTextes(textes: string[], langue: LangueClient): Promise<string[]> {
  if (textes.length === 0) return [];
  const schema = z.object({ traductions: z.array(z.string()).length(textes.length) });
  const systeme =
    "Tu traduis les messages d'un concierge d'hôtel au Sénégal. Conserve le ton chaleureux, la mise en forme (gras **…**, listes « - », retours à la ligne), les liens, les prix, les mots de passe et les noms propres. Ne traduis pas un texte déjà dans la langue cible : recopie-le.";
  const demande = `Traduis chacun de ces ${textes.length} textes en ${FICHES_LANGUES[langue].nomFrancais}, dans le même ordre.\n\n${JSON.stringify(textes)}`;

  return (await completerJson(systeme, demande, schema, 16000)).traductions;
}

const LANGUES_CIBLES = LANGUES_CLIENT.filter((langue) => langue !== "fr");

export type TraductionsFiche = Partial<Record<LangueClient, { nom: string; description?: string }>>;

/** Traduit le nom (et la description) d'un article ou d'une rubrique dans les 7 autres langues. */
export async function traduireFiche(nom: string, description?: string | null): Promise<TraductionsFiche> {
  const entree = z.object({ nom: z.string(), description: z.string().optional() });
  const schema = z.object(Object.fromEntries(LANGUES_CIBLES.map((langue) => [langue, entree])));
  const systeme =
    "Tu traduis la carte d'un hôtel au Sénégal pour ses clients. Garde les noms de plats sénégalais reconnaissables (thiéboudienne, yassa, mafé, bissap…), translittérés si besoin. Textes courts et appétissants. Langues : en (anglais), wo (wolof), es (espagnol), it (italien), de (allemand), pt (portugais), ar (arabe).";
  const demande = JSON.stringify(description ? { nom, description } : { nom });

  return (await completerJson(systeme, demande, schema)) as TraductionsFiche;
}
