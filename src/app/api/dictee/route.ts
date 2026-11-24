// POST : un message vocal du client (WAV 16 kHz mono, en base64) → son texte.
// La transcription se fait sur le serveur : elle fonctionne sur tous les téléphones, dans
// toutes les langues des clients (wolof compris), là où la dictée des navigateurs échoue
// (navigateur intégré d'un lecteur de QR code, iPhone sans Siri, réseau filtré…).
import { z } from "zod";
import { bdd } from "@/lib/bdd";
import { resoudreChambre } from "@/lib/contexte-chambre";
import { env } from "@/lib/env";
import { transcrireGemini } from "@/lib/ia/gemini";
import { FICHES_LANGUES, LANGUES_CLIENT } from "@/lib/langues";
import { autoriser } from "@/lib/limiteur";

export const runtime = "nodejs";
export const maxDuration = 30;

// ~45 s de parole en WAV 16 kHz mono (32 ko/s), en base64
const TAILLE_AUDIO_MAX = 2_000_000;
// Noms de la carte rappelés au modèle : les plats sénégalais s'écrivent alors correctement
const NOMS_CARTE_MAX = 80;

const schemaRequete = z.object({
  jeton: z.string().min(8).max(32),
  langue: z.enum(LANGUES_CLIENT).default("fr"),
  audio: z
    .string()
    .min(100)
    .max(TAILLE_AUDIO_MAX)
    .regex(/^[A-Za-z0-9+/]+=*$/),
});

export async function POST(requete: Request) {
  // Sans clé Gemini, le navigateur garde sa propre dictée
  if (!env.GEMINI_API_KEY) return Response.json({ erreur: "Transcription indisponible" }, { status: 503 });

  const corps = schemaRequete.safeParse(await requete.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "Requête invalide" }, { status: 400 });
  const { jeton, langue, audio } = corps.data;

  // Même plafond que les messages écrits : large pour un client, bloquant pour un abus
  if (!autoriser(`dictee:${jeton}`, 20, 10 * 60 * 1000)) {
    return Response.json({ erreur: "Trop de messages, patientez un instant." }, { status: 429 });
  }
  const contexte = await resoudreChambre(jeton);
  if (!contexte) return Response.json({ erreur: "Chambre introuvable" }, { status: 404 });

  const articles = await bdd.articleCatalogue.findMany({
    where: { hotelId: contexte.hotel.id },
    select: { nom: true },
    take: NOMS_CARTE_MAX,
  });
  const consignes = `Tu transcris le message vocal qu'un client d'un hôtel au Sénégal adresse à la concierge numérique.
Écris exactement ce qu'il dit, dans la langue où il parle (sans doute ${FICHES_LANGUES[langue].nomFrancais}, mais il peut parler français, wolof, anglais, espagnol, italien, allemand, portugais ou arabe, ou les mêler). Le wolof s'écrit dans son orthographe courante.
Ponctue normalement, corrige les hésitations (« euh », répétitions), ne traduis rien, ne réponds pas au message, n'ajoute ni guillemets ni commentaire.
Noms qu'il peut citer : ${articles.map((article) => article.nom).join(", ")}.
Si l'enregistrement ne contient aucune parole intelligible, renvoie un texte vide.`;

  try {
    const texte = await transcrireGemini(consignes, audio);
    return Response.json({ texte: texte.slice(0, 1000) });
  } catch (erreur) {
    console.error("[dictee]", erreur instanceof Error ? erreur.message : erreur);
    return Response.json({ erreur: "Transcription indisponible" }, { status: 503 });
  }
}
