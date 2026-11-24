// POST : un tour de conversation, réponse en flux NDJSON (un événement par ligne).
// GET  : fil d'une conversation existante (reprise après rechargement).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { resoudreChambre } from "@/lib/contexte-chambre";
import { construireFil } from "@/lib/historique";
import { executerTour } from "@/lib/ia/moteur";
import { LANGUES_CLIENT } from "@/lib/langues";
import { bdd } from "@/lib/bdd";
import { adresseClient, autoriser } from "@/lib/limiteur";
import { ConversationOccupee } from "@/lib/verrou-conversation";
import type { EvenementFlux } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const schemaRequete = z.object({
  jeton: z.string().min(8).max(32),
  conversationId: z.string().max(40).nullable(),
  message: z.string().trim().min(1).max(1000),
  langue: z.enum(LANGUES_CLIENT).default("fr"),
});

export async function POST(requete: Request) {
  const corps = schemaRequete.safeParse(await requete.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "Requête invalide" }, { status: 400 });

  const { jeton, conversationId, message, langue } = corps.data;

  // 20 messages / 10 min par chambre : large pour un client, bloquant pour un abus
  if (!autoriser(`conversation:${jeton}`, 20, 10 * 60 * 1000)) {
    return Response.json({ erreur: "Trop de messages, patientez un instant." }, { status: 429 });
  }

  const contexte = await resoudreChambre(jeton);
  if (!contexte) return Response.json({ erreur: "Chambre introuvable" }, { status: 404 });

  const encodeur = new TextEncoder();
  // Client parti en cours de réponse (onglet fermé, réseau coupé) : le tour va quand même
  // à son terme et s'enregistre, la réponse l'attendra au retour
  let ouvert = true;
  const flux = new ReadableStream<Uint8Array>({
    async start(controleur) {
      const emettre = (evenement: EvenementFlux) => {
        if (!ouvert) return;
        try {
          controleur.enqueue(encodeur.encode(`${JSON.stringify(evenement)}\n`));
        } catch {
          ouvert = false;
        }
      };

      try {
        await executerTour({ contexte, conversationId, message, langueClient: langue, emettre });
      } catch (erreur) {
        journaliserErreur(erreur);
        emettre({ type: "erreur", message: "indisponible" });
      } finally {
        if (ouvert) {
          try {
            controleur.close();
          } catch {
            // Flux déjà fermé par le client
          }
        }
      }
    },
    cancel() {
      ouvert = false;
    },
  });

  return new Response(flux, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no", // pas de mise en tampon par un proxy
    },
  });
}

export async function GET(requete: Request) {
  const parametres = new URL(requete.url).searchParams;

  // Préchauffage : le client ouvre la discussion ou commence à écrire. Cette même fonction
  // (celle qui traitera le message) et la base sortent de veille avant le premier message.
  if (parametres.has("prechauffer")) {
    if (autoriser(`prechauffer:${await adresseClient()}`, 30, 60 * 1000)) await bdd.$queryRaw`SELECT 1`;
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const jeton = parametres.get("jeton") ?? "";
  const conversationId = parametres.get("id") ?? "";

  const contexte = await resoudreChambre(jeton);
  if (!contexte || !conversationId) return Response.json({ fil: null }, { status: 404 });

  const fil = await construireFil(conversationId, contexte.chambre.id, contexte.sejour?.id ?? null);
  return Response.json({ fil }, { status: fil ? 200 : 404 });
}

function journaliserErreur(erreur: unknown) {
  if (erreur instanceof Anthropic.AuthenticationError) {
    console.error("[conversation] clé API Anthropic absente ou invalide");
  } else if (erreur instanceof Anthropic.RateLimitError) {
    console.error("[conversation] limite de débit Anthropic atteinte");
  } else if (erreur instanceof ConversationOccupee) {
    console.warn("[conversation] tour refusé : conversation occupée trop longtemps");
  } else if (erreur instanceof Anthropic.APIError) {
    console.error(`[conversation] erreur API ${erreur.status}`, erreur.message);
  } else {
    console.error("[conversation] erreur inattendue", erreur);
  }
}
