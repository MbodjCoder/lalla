// Voie rapide : les questions d'information les plus fréquentes (Wi-Fi, heure de départ,
// horaires d'un service, numéro de la réception), un simple bonjour ou un merci reçoivent
// une réponse instantanée, tirée des données de l'hôtel, sans attendre le modèle. Les demandes
// simples et sans ambiguïté (des serviettes, la climatisation en panne, « deux bissap ») sont
// reconnues ici et confiées au mode secours, qui affiche leur carte aussitôt.
//
// Règle d'or : ne répondre que lorsque la réponse est certaine. Une seule intention
// reconnue, un message court, aucune action (commande, demande, annulation, urgence…) ;
// au moindre doute, null : le modèle prend la main comme d'habitude.
// Fonction pure : aucune écriture, aucun appel réseau.
import "server-only";
import { heureLisible } from "@/composants/concierge/horaires";
import type { ContexteChambre } from "@/lib/contexte-chambre";
import { heureHotel } from "@/lib/horaires-service";
import { traducteurClient } from "@/lib/i18n/client";
import type { CategorieAvecArticles, DocumentPrompt } from "@/lib/ia/prompt-systeme";
import { articlesCites } from "@/lib/ia/secours/catalogue";
import {
  detecterLangue,
  estQuestion,
  mentionne,
  MOTS,
  normaliser,
  SERVICES,
  type MotsCles,
} from "@/lib/ia/secours/comprehension";
import { horaireCible } from "@/lib/ia/secours/livret";
import { REPONSES, type CleReponse } from "@/lib/ia/secours/textes";
import { estLangueClient, FICHES_LANGUES, type LangueClient } from "@/lib/langues";

// Au-delà, le message porte probablement plus qu'une question simple
const MOTS_MAX_QUESTION = 14;
const MOTS_MAX_REMERCIEMENT = 4;
const MOTS_MAX_SALUTATION = 4;

// Vraies formules de salut (« aide », « que peux-tu faire » restent au modèle)
// prettier-ignore
const MOTS_SALUT: MotsCles = ["bonjour", "bonsoir", "salut", "hello", "hi", "hey", "good morning", "good evening", "good afternoon", "salam", "salamalekum", "salamaleikum", "asalaa maalekum", "hola", "buenos dias", "buenas", "ciao", "buongiorno", "buonasera", "hallo", "guten tag", "guten morgen", "guten abend", "ola", "bom dia", "boa tarde", "boa noite", "مرحبا", "السلام عليكم", "اهلا", "أهلا"];

type Moment = "matin" | "apresMidi" | "soir";

// Salut selon le moment de la journée, à l'heure de l'hôtel
const SALUTS: Record<LangueClient, Record<Moment, string>> = {
  fr: { matin: "Bonjour", apresMidi: "Bonjour", soir: "Bonsoir" },
  en: { matin: "Good morning", apresMidi: "Good afternoon", soir: "Good evening" },
  wo: { matin: "Asalaa maalekum", apresMidi: "Asalaa maalekum", soir: "Asalaa maalekum" },
  es: { matin: "Buenos días", apresMidi: "Buenas tardes", soir: "Buenas noches" },
  it: { matin: "Buongiorno", apresMidi: "Buon pomeriggio", soir: "Buonasera" },
  de: { matin: "Guten Morgen", apresMidi: "Guten Tag", soir: "Guten Abend" },
  pt: { matin: "Bom dia", apresMidi: "Boa tarde", soir: "Boa noite" },
  ar: { matin: "صباح الخير", apresMidi: "مساء الخير", soir: "مساء الخير" },
};

// Suite de la salutation : la concierge se présente et propose son aide
const PRESENTATIONS: Record<LangueClient, string> = {
  fr: "Je suis {assistant}, votre concierge. Que puis-je faire pour vous ?",
  en: "I'm {assistant}, your concierge. How may I help you?",
  wo: "Maa ngi tudd {assistant}, sa concierge. Lan laa la mën a defal ?",
  es: "Soy {assistant}, su conserje. ¿En qué puedo ayudarle?",
  it: "Sono {assistant}, la sua concierge. Come posso aiutarla?",
  de: "Ich bin {assistant}, Ihre Concierge. Wie kann ich Ihnen helfen?",
  pt: "Sou a {assistant}, a sua concierge. Em que posso ajudar?",
  ar: "أنا {assistant}، مساعدتك في الفندق. كيف يمكنني مساعدتك؟",
};

function momentDeLaJournee(fuseau: string): Moment {
  const heure = Number(heureHotel(fuseau).slice(0, 2));
  return heure >= 5 && heure < 12 ? "matin" : heure >= 12 && heure < 18 ? "apresMidi" : "soir";
}

// Wi-Fi : un vrai mot du Wi-Fi est exigé (« mot de passe » seul peut viser le coffre-fort)
// prettier-ignore
const MOTS_WIFI: MotsCles = ["wifi", "wi fi", "wlan", "internet", "واي فاي", "الواي", "للواي", "ويفي", "الويفي", "انترنت", "الانترنت", "الإنترنت", "للانترنت"];

// Numéro de la réception : la question doit porter sur le numéro (« demander à la réception
// si… » est une question à transmettre, pas une demande de numéro)
// prettier-ignore
const MOTS_NUMERO: MotsCles = ["numero", "numeros", "number", "telephone", "phone", "telefono", "telefonnummer", "nummer", "nimero", "رقم"];

// Tout ce qui demande une action ou du discernement revient au modèle
const MOTS_HORS_VOIE_RAPIDE: MotsCles[] = [
  MOTS.urgence,
  MOTS.incident,
  MOTS.annulation,
  MOTS.statut,
  MOTS.commander,
  MOTS.prolongation,
  MOTS.departTardif,
  MOTS.avis,
  MOTS.recommandations,
  MOTS.revenir,
  MOTS.incompris,
  MOTS.identite,
  MOTS.refus,
  ...SERVICES.map((service) => service.mots),
];

// Une action simple, mais une nuance que seul le modèle sait reporter sur la carte
// prettier-ignore
const MOTS_NUANCE: MotsCles = ["sans", "avec", "pas", "sauf", "plus", "moins", "peu", "bien", "tres", "extra", "sauce", "glace", "glacon*", "froid*", "chaud*", "epice*", "piment*", "cuisson", "saignant", "without", "with", "no", "less", "more", "ice", "cold", "hot", "spicy", "sin", "con", "senza", "ohne", "mit", "sem", "com", "dafa", "بدون", "مع"];

// Au-delà, le message porte probablement plus qu'une demande simple
const MOTS_MAX_ACTION = 10;
const MOTS_MAX_COMMANDE = 8;
// Prolonger ou partir plus tard se dit en phrases plus longues (« est-ce possible de partir plus tard… »)
const MOTS_MAX_SEJOUR = 16;

// Ce qui empêche de préparer d'office la demande de prolongation ou de départ tardif
const MOTS_HORS_SEJOUR_RAPIDE: MotsCles[] = [
  MOTS.urgence,
  MOTS.annulation,
  MOTS.statut,
  MOTS.refus,
  MOTS.incident,
  MOTS.avis,
  MOTS.revenir,
  ...SERVICES.map((service) => service.mots),
];

// Ce que seul le modèle sait traiter avec discernement (le taxi est vendu au catalogue : le modèle tranche)
const MOTS_HORS_ACTION_RAPIDE: MotsCles[] = [
  MOTS.urgence,
  MOTS.annulation,
  MOTS.statut,
  MOTS.prolongation,
  MOTS.departTardif,
  MOTS.depart,
  MOTS.horaire,
  MOTS.questionArticle,
  MOTS.avis,
  MOTS.recommandations,
  MOTS.revenir,
  MOTS.incompris,
  MOTS.identite,
  MOTS.navigation,
  MOTS.wifi,
  MOTS.reception,
  ...SERVICES.filter((service) => service.cle === "taxi").map((service) => service.mots),
];

type Parametres = {
  message: string;
  langueInterface: string;
  contexte: ContexteChambre;
  categories: CategorieAvecArticles[];
  documents: DocumentPrompt[];
};

/** Réponse certaine et instantanée, ou null si la question mérite le modèle. */
export function reponseInstantanee({
  message,
  langueInterface,
  contexte,
  categories,
  documents,
}: Parametres): string | null {
  const { hotel, sejour } = contexte;
  const texte = normaliser(message);
  const mots = texte.split(" ").filter(Boolean);
  if (mots.length === 0 || mots.length > MOTS_MAX_QUESTION) return null;
  if (MOTS_HORS_VOIE_RAPIDE.some((liste) => mentionne(texte, liste))) return null;

  const langue: LangueClient = detecterLangue(message) ?? (estLangueClient(langueInterface) ? langueInterface : "fr");
  const repondre = (cle: CleReponse, variables: Record<string, string> = {}) =>
    REPONSES[cle][langue].replace(/\{(\w+)\}/g, (_, nom: string) => variables[nom] ?? "");

  // Un plat ou un article cité : renseignement ou commande, le modèle sait trancher
  if (articlesCites(mots, categories, langue, false).trouves.length > 0) return null;

  const question = estQuestion(message);
  const reponses: string[] = [];

  if (mentionne(texte, MOTS_WIFI) && hotel.wifiReseau) {
    reponses.push(repondre("wifi", { reseau: hotel.wifiReseau, motDePasse: hotel.wifiMotDePasse ?? "—" }));
  }

  const departCite = mentionne(texte, MOTS.depart);
  if (departCite && (question || mentionne(texte, MOTS.horaire))) {
    const heure = heureLisible(hotel.heureCheckout, langue);
    reponses.push(
      sejour
        ? repondre("departDate", {
            date: new Intl.DateTimeFormat(FICHES_LANGUES[langue].locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: hotel.fuseauHoraire,
            }).format(sejour.depart),
            heure,
          })
        : repondre("departHeure", { heure }),
    );
  }

  // Horaire d'un service nommément cité (« la piscine ferme à quelle heure ? »)
  if (!departCite && question && mentionne(texte, MOTS.horaire)) {
    const ligne = horaireCible(texte, categories, documents, langue, traducteurClient(langue));
    if (ligne) reponses.push(ligne.replace(/^- /, ""));
  }

  const numeroReception = mentionne(texte, MOTS.reception) && mentionne(texte, MOTS_NUMERO);
  if (question && numeroReception && hotel.telephoneReception && reponses.length === 0) {
    reponses.push(repondre("joindreReception", { telephone: hotel.telephoneReception }));
  }

  // Une seule intention, sans ambiguïté : sinon le modèle compose une réponse d'ensemble
  if (reponses.length === 1) return reponses[0];
  if (reponses.length > 1) return null;

  // Un simple merci, rien d'autre
  if (mots.length <= MOTS_MAX_REMERCIEMENT && !question && mentionne(texte, MOTS.merci)) {
    return repondre("remerciement");
  }

  // Un simple bonjour : salut selon l'heure de l'hôtel, par le nom du client s'il est connu
  // (nom complet : « Monsieur » ou « Madame » supposerait un genre que l'on ignore)
  const salutationSeule =
    mots.length <= MOTS_MAX_SALUTATION &&
    mentionne(texte, MOTS_SALUT) &&
    !mentionne(texte, MOTS.commentCaVa) &&
    !mentionne(texte, MOTS.merci);
  if (salutationSeule) {
    const nom = sejour?.nomClient ? ` ${sejour.nomClient}` : "";
    const presentation = PRESENTATIONS[langue].replace("{assistant}", hotel.nomAssistant);
    return `${SALUTS[langue][momentDeLaJournee(hotel.fuseauHoraire)]}${nom}. ${presentation}`;
  }
  return null;
}

/**
 * Demande simple et certaine, que le mode secours traite aussi bien que le modèle, en un instant :
 * un seul service (serviettes, ménage, réveil…), une panne seule, ou une commande d'articles de la
 * carte reconnus sans ambiguïté ni précision (« deux bissap et un yassa poulet »), une prolongation ou un
 * départ tardif. Au moindre doute
 * (question, nuance, plusieurs intentions, article incertain), false : le modèle répond.
 */
export function actionCertaine({
  message,
  langueInterface,
  categories,
}: Pick<Parametres, "message" | "langueInterface" | "categories">): boolean {
  const texte = normaliser(message);
  const mots = texte.split(" ").filter(Boolean);
  if (mots.length === 0) return false;

  // Prolonger le séjour ou partir plus tard : la réception décide, la demande se prépare d'office
  if (mentionne(texte, MOTS.prolongation) || mentionne(texte, MOTS.departTardif)) {
    return mots.length <= MOTS_MAX_SEJOUR && !MOTS_HORS_SEJOUR_RAPIDE.some((liste) => mentionne(texte, liste));
  }

  if (mots.length > MOTS_MAX_ACTION) return false;
  if (MOTS_HORS_ACTION_RAPIDE.some((liste) => mentionne(texte, liste))) return false;

  const langue: LangueClient = detecterLangue(message) ?? (estLangueClient(langueInterface) ? langueInterface : "fr");
  const services = SERVICES.filter((service) => mentionne(texte, service.mots));
  const panne = mentionne(texte, MOTS.incident);
  const { trouves, ambigus } = articlesCites(mots, categories, langue, true);

  const aucunArticle = trouves.length === 0 && ambigus.length === 0;
  // Une panne seule : la négation fait partie de la phrase (« la clim ne marche pas »). Un article cité
  // n'y est qu'un faux ami (« marche ») ou l'objet en panne (« le minibar ne marche plus »)
  if (panne) return services.length === 0 && !mentionne(texte, MOTS.commander);

  // Un refus (« pas besoin de ménage ») ou une nuance (« sans glace ») : le modèle
  if (mentionne(texte, MOTS.refus) || mentionne(texte, MOTS_NUANCE)) return false;

  // Un service seul, sans article cité
  if (aucunArticle) return services.length === 1;

  // Une commande : articles reconnus sans ambiguïté, sans service, en ordre et non en question
  const commande = !estQuestion(message) || mentionne(texte, MOTS.commander);
  return (
    commande && services.length === 0 && ambigus.length === 0 && trouves.length > 0 && mots.length <= MOTS_MAX_COMMANDE
  );
}
