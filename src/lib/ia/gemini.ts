// Connecteur Gemini, par l'interface compatible OpenAI de Google AI Studio.
//
// Même contrat que le moteur Claude : texte diffusé au fil de l'eau, outils
// exécutés côté serveur (cartes émises aussitôt), boucle d'outils bornée.
// L'historique est enregistré au format Anthropic, texte seul : une conversation
// commencée avec Gemini se poursuit telle quelle avec Claude, et inversement.
//
// Cascade de modèles : chaque modèle a son propre quota (20 requêtes par jour
// pour Gemini 3.8 Flash en offre gratuite). Quand le meilleur est épuisé,
// surchargé ou lent, le suivant prend le relais (relais anticipé, voir appeler()) ;
// l'état de chaque modèle est partagé entre les instances (lib/ia/etat-modeles.ts).
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/lib/env";
import { FENETRE_SONDE_MS, lireEtatsModeles, noterEtatModele } from "@/lib/ia/etat-modeles";
import { executerOutil, type EnvironnementOutils } from "@/lib/ia/outils";
import type { EvenementFlux } from "@/lib/types";
import type { RoleMessage } from "@/generated/prisma/client";

const URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const ITERATIONS_MAX = 5; // appels d'outils enchaînés par tour
// Conversation : la réactivité prime sur la réflexion approfondie
const EFFORT_REFLEXION = "low";

type MessageGemini =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: AppelOutil[] }
  | { role: "tool"; tool_call_id: string; content: string };

// extra_content porte la « signature de réflexion » que Gemini exige de retrouver telle quelle
type AppelOutil = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  extra_content?: unknown;
};

/** Consommation d'un appel : entrée (dont la part servie par le cache) et sortie. */
export type ConsommationIA = { entree: number; enCache: number; sortie: number };

type MorceauFlux = {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: (Partial<AppelOutil> & { index?: number })[];
    };
  }[];
};

export class ErreurGemini extends Error {
  constructor(
    readonly statut: number,
    detail: string,
  ) {
    super(`Gemini ${statut} : ${detail.slice(0, 300)}`);
  }
}

const PAUSE_SURCHARGE_MS = 60_000; // 500 / 503 : le modèle est saturé, on le laisse respirer
const PAUSE_QUOTA_PAR_DEFAUT_MS = 60 * 60_000;
// Relais anticipé : sans réponse du modèle en cours après ce délai, le suivant est lancé en
// parallèle et le premier qui répond l'emporte. Un modèle rapide répond en 0,8 à 2 s.
const DELAI_RELAIS_MS = 3_000;
// Le relais a déjà été nécessaire : les suivants partent plus vite
const DELAI_RELAIS_SUIVANT_MS = 1_500;
const RELAIS_SIMULTANES_MAX = 3;
// Au-delà, un modèle est abandonné quoi qu'il arrive
const DELAI_MAX_MS = 20_000;
// Un modèle plus lent que ce seuil passe en fin de file, pour tous, le temps de se remettre
const SEUIL_LENTEUR_MS = 6_000;
// Longueur maximale d'une réponse (réflexion comprise) : une réponse de concierge tient en
// quelques phrases ; au-delà, c'est un emballement qui coûterait du temps et de l'argent
const JETONS_SORTIE_MAX = 4_096;
// Flux muet au-delà de ce délai : le modèle s'est figé, on abandonne plutôt que d'attendre
const DELAI_SILENCE_MS = 25_000;
const DUREE_LENTEUR_MS = 20 * 60_000;

const modelesCandidats = () =>
  env.LALLA_MODELES_GEMINI.split(",")
    .map((modele) => modele.trim())
    .filter(Boolean);

/** Délai « retryDelay » renvoyé par Google (« 73703s »), en millisecondes. */
function delaiDeRetour(detail: string): number {
  const secondes = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(detail)?.[1];
  return secondes ? Number(secondes) * 1000 : PAUSE_QUOTA_PAR_DEFAUT_MS;
}

/**
 * File d'appel : ordre de préférence, modèles épuisés écartés, modèles lents en dernier.
 * `sonde` : le premier de la file était lent il y a peu ; il est retenté, mais en parallèle
 * du suivant, pour que le client ne paie jamais l'attente de cet essai.
 */
async function fileDesModeles(): Promise<{ file: string[]; sonde: boolean }> {
  const candidats = modelesCandidats();
  const etats = await lireEtatsModeles();
  const maintenant = Date.now();
  const disponibles = candidats.filter((modele) => (etats.get(modele)?.indisponibleJusqua ?? 0) <= maintenant);
  const estLent = (modele: string) => (etats.get(modele)?.lentJusqua ?? 0) > maintenant;
  // Lent il y a peu, plus écarté : il est retenté, mais jamais seul
  const aSonder = (modele: string) => {
    const lentJusqua = etats.get(modele)?.lentJusqua ?? 0;
    return lentJusqua > maintenant - FENETRE_SONDE_MS && lentJusqua <= maintenant;
  };
  const prets = disponibles.filter((modele) => !estLent(modele));
  const sonde = prets.length > 1 && aSonder(prets[0]);
  // Le partenaire de course d'un modèle à sonder est le meilleur modèle sûr, pas un autre à sonder
  const suite = prets.slice(1);
  const file = [
    ...prets.slice(0, 1),
    ...(sonde ? [...suite.filter((modele) => !aSonder(modele)), ...suite.filter(aSonder)] : suite),
    ...disponibles.filter(estLent),
  ];
  // Tous écartés : on retente quand même le premier plutôt que d'abandonner
  return file.length > 0 ? { file, sonde } : { file: candidats.slice(0, 1), sonde: false };
}

/**
 * Appel au meilleur modèle disponible, avec relais anticipé : si le modèle en cours tarde,
 * le suivant part en parallèle et le premier à répondre l'emporte (l'autre est abandonné).
 * La qualité est celle du meilleur modèle quand il est rapide ; l'attente reste bornée
 * quand il est saturé. `corps` reçoit le modèle retenu : le tour peut ainsi adapter ses
 * messages s'il change de modèle en route.
 */
async function appeler(
  corps: (modele: string) => Record<string, unknown>,
): Promise<{ reponse: Response; modele: string }> {
  const { file, sonde } = await fileDesModeles();

  return new Promise((resoudre, rejeter) => {
    const enCours = new Map<string, { abandon: AbortController; rang: number; debut: number }>();
    let rang = 0;
    let tranche = false;
    let derniereErreur: ErreurGemini | null = null;
    let minuterieRelais: ReturnType<typeof setTimeout> | undefined;

    const lancerSuivant = () => {
      clearTimeout(minuterieRelais);
      if (tranche) return;
      if (rang >= file.length) {
        if (enCours.size === 0) rejeter(derniereErreur ?? new ErreurGemini(503, "aucun modèle configuré"));
        return;
      }
      void essayer(file[rang++]);
      if (rang < file.length && enCours.size < RELAIS_SIMULTANES_MAX) {
        // Sonde : le modèle sûr part avec elle, puis le relais normal reprend
        const delai =
          rang === 1 ? (sonde ? 0 : DELAI_RELAIS_MS) : rang === 2 && sonde ? DELAI_RELAIS_MS : DELAI_RELAIS_SUIVANT_MS;
        minuterieRelais = setTimeout(lancerSuivant, delai);
      }
    };

    const essayer = async (modele: string) => {
      const abandon = new AbortController();
      const debut = Date.now();
      const rangDansFile = file.indexOf(modele);
      enCours.set(modele, { abandon, rang: rangDansFile, debut });
      const plafond = setTimeout(() => abandon.abort(), DELAI_MAX_MS);
      try {
        const reponse = await fetch(URL_GEMINI, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modele,
            reasoning_effort: EFFORT_REFLEXION,
            ...corps(modele),
          }),
          signal: abandon.signal,
        });
        const latence = Date.now() - debut;
        if (tranche) return void abandon.abort();

        if (reponse.ok) {
          tranche = true;
          clearTimeout(minuterieRelais);
          // Les autres essais sont abandonnés ; un modèle préféré qui a vraiment tardé (ou le modèle
          // sondé, battu par le modèle sûr) est repoussé en fin de file
          for (const [autre, essai] of enCours) {
            if (autre === modele) continue;
            essai.abandon.abort();
            const aTarde = Date.now() - essai.debut >= DELAI_RELAIS_MS || (sonde && essai.rang === 0);
            if (essai.rang < rangDansFile && aTarde) {
              noterEtatModele(autre, { lentJusqua: Date.now() + DUREE_LENTEUR_MS });
            }
          }
          noterEtatModele(modele, {
            latenceMs: latence,
            lentJusqua: latence > SEUIL_LENTEUR_MS ? Date.now() + DUREE_LENTEUR_MS : null,
          });
          console.info(`[gemini] ${modele} répond (${latence} ms)`);
          resoudre({ reponse, modele });
          return;
        }

        const detail = await reponse.text();
        derniereErreur = new ErreurGemini(reponse.status, detail);
        // Quota épuisé, modèle saturé ou retiré : écarté pour tous ; requête refusée : un autre peut l'accepter
        if (reponse.status === 429) {
          noterEtatModele(modele, { indisponibleJusqua: Date.now() + delaiDeRetour(detail) });
        } else if (reponse.status >= 500 || reponse.status === 404) {
          noterEtatModele(modele, { indisponibleJusqua: Date.now() + PAUSE_SURCHARGE_MS });
        }
        console.warn(`[gemini] ${modele} indisponible (${reponse.status}), modèle suivant`);
      } catch (erreur) {
        if (tranche) return;
        const delaiDepasse = abandon.signal.aborted;
        derniereErreur = new ErreurGemini(
          delaiDepasse ? 504 : 502,
          delaiDepasse ? "délai de réponse dépassé" : String(erreur),
        );
        if (delaiDepasse) noterEtatModele(modele, { lentJusqua: Date.now() + DUREE_LENTEUR_MS });
        console.warn(`[gemini] ${modele} ${delaiDepasse ? "trop lent" : "injoignable"}, modèle suivant`);
      } finally {
        clearTimeout(plafond);
        enCours.delete(modele);
      }
      // Échec : le suivant part aussitôt, sans attendre le relais
      lancerSuivant();
    };

    lancerSuivant();
  });
}

/** Morceaux « data: {…} » d'une réponse en flux (SSE). */
async function* lireFlux(reponse: Response): AsyncGenerator<MorceauFlux> {
  const lecteur = reponse.body!.pipeThrough(new TextDecoderStream()).getReader();
  let tampon = "";
  try {
    for (;;) {
      // Un flux qui se tait trop longtemps est abandonné (le tour bascule alors en secours)
      let minuterie: ReturnType<typeof setTimeout> | undefined;
      const silence = new Promise<never>((_, rejeter) => {
        minuterie = setTimeout(() => rejeter(new ErreurGemini(504, "flux interrompu")), DELAI_SILENCE_MS);
      });
      const { value, done } = await Promise.race([lecteur.read(), silence]).finally(() => clearTimeout(minuterie));
      if (done) break;
      tampon += value;
      const lignes = tampon.split("\n");
      tampon = lignes.pop() ?? "";
      for (const ligne of lignes) {
        const donnees = ligne.trim();
        if (!donnees.startsWith("data:")) continue;
        const contenu = donnees.slice(5).trim();
        if (!contenu || contenu === "[DONE]") continue;
        try {
          yield JSON.parse(contenu) as MorceauFlux;
        } catch {
          console.warn("[gemini] morceau de flux illisible ignoré");
        }
      }
    }
  } finally {
    lecteur.cancel().catch(() => {});
  }
}

function versOutilsGemini(outils: Anthropic.Beta.BetaTool[]) {
  return outils.map((outil) => ({
    type: "function" as const,
    function: {
      name: outil.name,
      description: outil.description,
      parameters: outil.input_schema,
    },
  }));
}

type MessageHistorique = {
  role: RoleMessage;
  contenu: unknown;
  texte: string | null;
};

/** Texte des blocs « text » d'un contenu au format Anthropic, ou null. */
function texteDesBlocs(contenu: unknown): string | null {
  if (!Array.isArray(contenu)) return null;
  const texte = contenu
    .filter((bloc): bloc is { type: "text"; text: string } => bloc?.type === "text" && typeof bloc.text === "string")
    .map((bloc) => bloc.text)
    .join("\n\n")
    .trim();
  return texte || null;
}

const blocContexte = (contexte: string) => `\n\n<contexte_du_tour>\n${contexte}\n</contexte_du_tour>`;

// Mémoire envoyée au modèle : les derniers messages échangés (client et Lalla). Au-delà, la
// taille du prompt resterait croissante : chaque tour serait un peu plus lent et plus cher.
export const FENETRE_HISTORIQUE = 24;

/**
 * Historique au format Gemini : les textes échangés, dans une fenêtre glissante de taille
 * fixe (la vitesse ne dépend pas de la longueur de la conversation). Les contextes des tours
 * passés ne sont pas renvoyés : périmés, ils sont remplacés par celui du tour en cours (heure,
 * séjour, état à jour des demandes). Les appels d'outils passés ne sont pas rejoués non plus :
 * leur effet est dans le texte et dans l'état des demandes.
 */
export function historiqueGemini(historique: MessageHistorique[]): MessageGemini[] {
  const messages: MessageGemini[] = [];
  for (const message of historique) {
    const dernier = messages.at(-1);
    if (message.role === "CLIENT" && message.texte) {
      if (dernier?.role === "user")
        dernier.content += `

${message.texte}`;
      else messages.push({ role: "user", content: message.texte });
    } else if (message.role === "ASSISTANT" && message.texte) {
      // Le contenu enregistré peut préciser l'origine (« Réponse de la réception : … »)
      const texte = texteDesBlocs(message.contenu) ?? message.texte;
      if (dernier?.role === "assistant" && dernier.content)
        dernier.content += `

${texte}`;
      else messages.push({ role: "assistant", content: texte });
    }
  }
  const fenetre = messages.slice(-FENETRE_HISTORIQUE);
  // La fenêtre commence toujours par un message du client
  while (fenetre[0]?.role === "assistant") fenetre.shift();
  return fenetre;
}

type ParametresTour = {
  historique: MessageHistorique[];
  nouveauMessage: string;
  contexteTour: string;
  promptStable: string;
  outils: Anthropic.Beta.BetaTool[];
  environnementOutils: EnvironnementOutils;
  emettre: (evenement: EvenementFlux) => void;
  persister: (
    role: RoleMessage,
    contenu: unknown,
    texte: string | null,
    consommation?: ConsommationIA,
  ) => Promise<string>;
};

export async function deroulerTourGemini({
  historique,
  nouveauMessage,
  contexteTour,
  promptStable,
  outils,
  environnementOutils,
  emettre,
  persister,
}: ParametresTour) {
  await persister("CLIENT", [{ type: "text", text: nouveauMessage }], nouveauMessage);
  await persister("SYSTEME", contexteTour, null);

  const messageDuTour = nouveauMessage + blocContexte(contexteTour);
  const messages: MessageGemini[] = [
    { role: "system", content: promptStable },
    ...historiqueGemini(historique),
    { role: "user", content: messageDuTour },
  ];
  const outilsGemini = versOutilsGemini(outils);
  const debutDuTour = messages.length;
  // Ce que le tour a déjà fait, pour un modèle qui prendrait le relais en route
  const dejaEcrit: string[] = [];
  const dejaFait: string[] = [];
  let texteDejaEmis = false;
  let modeleDuTour: string | null = null;

  /**
   * Un modèle qui reprend le tour en cours de route refuse les appels d'outils
   * de son prédécesseur (signatures de réflexion) : il reçoit un résumé à la place.
   */
  const messagesPour = (candidat: string): MessageGemini[] => {
    if (!modeleDuTour || candidat === modeleDuTour) return messages;
    const debut = messages.slice(0, debutDuTour);
    const note = [
      dejaEcrit.length > 0 && `Tu as déjà écrit au client : « ${dejaEcrit.join(" ")} »`,
      dejaFait.length > 0 && `Actions déjà faites (ne pas les refaire) :\n${dejaFait.join("\n")}`,
      "Termine ta réponse au client sans répéter ce qui précède.",
    ]
      .filter(Boolean)
      .join("\n");
    return [
      ...debut.slice(0, -1),
      // Toujours à partir du message d'origine : les notes ne s'empilent pas d'un relais à l'autre
      {
        role: "user",
        content: `${messageDuTour}\n\n<suite_du_tour>\n${note}\n</suite_du_tour>`,
      },
    ];
  };

  for (let iteration = 0; iteration < ITERATIONS_MAX; iteration++) {
    const { reponse, modele } = await appeler((candidat) => ({
      messages: messagesPour(candidat),
      tools: outilsGemini,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: JETONS_SORTIE_MAX,
    }));
    if (modeleDuTour && modele !== modeleDuTour) {
      // Relais pris : la suite repart du résumé, sans les appels d'outils du modèle précédent
      messages.splice(0, messages.length, ...messagesPour(modele));
    }
    modeleDuTour = modele;

    let segment = "";
    const appels: AppelOutil[] = [];
    let consommation: ConsommationIA | undefined;
    for await (const morceau of lireFlux(reponse)) {
      // Dernier morceau du flux : la consommation de l'appel (entrée, part en cache, sortie)
      if (morceau.usage) {
        consommation = {
          entree: morceau.usage.prompt_tokens ?? 0,
          enCache: morceau.usage.prompt_tokens_details?.cached_tokens ?? 0,
          sortie: morceau.usage.completion_tokens ?? 0,
        };
      }
      const delta = morceau.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        // Deux réponses successives d'un même tour sont séparées d'un paragraphe
        if (!segment && texteDejaEmis) emettre({ type: "texte", delta: "\n\n" });
        segment += delta.content;
        texteDejaEmis = true;
        emettre({ type: "texte", delta: delta.content });
      }
      for (const partiel of delta.tool_calls ?? []) {
        const rang = partiel.index ?? appels.length;
        const existant = appels[rang];
        if (existant) {
          existant.function.arguments += partiel.function?.arguments ?? "";
          existant.extra_content ??= partiel.extra_content;
        } else {
          appels[rang] = {
            id: partiel.id ?? `appel-${iteration}-${rang}`,
            type: "function",
            function: {
              name: partiel.function?.name ?? "",
              arguments: partiel.function?.arguments ?? "",
            },
            ...(partiel.extra_content ? { extra_content: partiel.extra_content } : {}),
          };
        }
      }
    }

    if (consommation) {
      console.info(
        `[gemini] ${modele} · entrée ${consommation.entree} jetons (dont ${consommation.enCache} en cache) · sortie ${consommation.sortie}`,
      );
    }
    // Chaque passage de texte est enregistré avant les cartes qu'il annonce (ordre du fil)
    const texte = segment.trim();
    if (texte) {
      dejaEcrit.push(texte);
      emettre({
        type: "messageEnregistre",
        id: await persister("ASSISTANT", [{ type: "text", text: texte }], texte, consommation),
      });
    }
    const appelsValides = appels.filter(Boolean);
    if (appelsValides.length === 0) return;

    messages.push({
      role: "assistant",
      content: segment || null,
      tool_calls: appelsValides,
    });
    for (const appel of appelsValides) {
      let entree: unknown;
      try {
        entree = JSON.parse(appel.function.arguments || "{}");
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: appel.id,
          content: "Erreur : arguments JSON illisibles.",
        });
        continue;
      }
      const { contenu, erreur } = await executerOutil(
        {
          type: "tool_use",
          id: appel.id,
          name: appel.function.name,
          input: entree,
        } as Anthropic.Beta.BetaToolUseBlock,
        environnementOutils,
      );
      messages.push({
        role: "tool",
        tool_call_id: appel.id,
        content: erreur ? `Erreur : ${contenu}` : contenu,
      });
      dejaFait.push(`- ${appel.function.name} : ${erreur ? `échec (${contenu})` : contenu}`);
    }
    // Une carte se suffit à elle-même : pas de commentaire après
    if (environnementOutils.carteAffichee) return;
  }
}

/** Réponse structurée validée par un schéma Zod (traductions). */
export async function completerJsonGemini<T>(systeme: string, utilisateur: string, schema: z.ZodType<T>): Promise<T> {
  const { reponse } = await appeler(() => ({
    messages: [
      { role: "system", content: systeme },
      { role: "user", content: utilisateur },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "reponse", schema: schemaPourGemini(schema) },
    },
  }));
  const donnees = (await reponse.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const texte = donnees.choices?.[0]?.message?.content ?? "";
  return schema.parse(JSON.parse(texte));
}

/** Schéma JSON sans les mots-clés que Gemini refuse ($schema, additionalProperties). */
function schemaPourGemini(schema: z.ZodType): unknown {
  const nettoyer = (valeur: unknown): unknown => {
    if (Array.isArray(valeur)) return valeur.map(nettoyer);
    if (valeur && typeof valeur === "object") {
      return Object.fromEntries(
        Object.entries(valeur)
          .filter(([cle]) => cle !== "$schema" && cle !== "additionalProperties")
          .map(([cle, contenu]) => [cle, nettoyer(contenu)]),
      );
    }
    return valeur;
  };
  return nettoyer(z.toJSONSchema(schema));
}

/** Transcription d'un message vocal (WAV en base64) : le texte prononcé, rien d'autre. */
export async function transcrireGemini(consignes: string, audioWavBase64: string): Promise<string> {
  const { reponse } = await appeler(() => ({
    messages: [
      { role: "system", content: consignes },
      { role: "user", content: [{ type: "input_audio", input_audio: { data: audioWavBase64, format: "wav" } }] },
    ],
  }));
  const donnees = (await reponse.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  return donnees.choices?.[0]?.message?.content?.trim() ?? "";
}
