// Documentation de l'hôtel pour le mode secours : recherche de la section qui
// répond, horaires des lieux, recommandations de visite.
import { heureLisible, horairesLisibles, plageHoraire } from "@/composants/concierge/horaires";
import type { TraduireClient } from "@/lib/i18n/client";
import type { DocumentPrompt } from "@/lib/ia/prompt-systeme";
import type { LangueClient } from "@/lib/langues";
import { correspond, nomRubrique, rubriqueCitee, type Categorie } from "./catalogue";
import { normaliser } from "./comprehension";
import { LIEUX } from "./textes";

export type Section = { document: string; titre: string; corps: string };

export function sections(documents: DocumentPrompt[]): Section[] {
  return documents.flatMap((document) =>
    document.contenu
      .split(/^#{1,6}\s+/m)
      .map((morceau) => morceau.trim())
      .filter(Boolean)
      .map((morceau) => {
        const [titre, ...lignes] = morceau.split("\n");
        return { document: document.titre, titre: titre.trim(), corps: lignes.join("\n").trim() };
      })
      .filter((section) => section.corps),
  );
}

// Mots sans valeur pour la recherche, toutes langues confondues
const MOTS_OUTILS = new Set(
  (
    "les des une est sont pour avec dans sur par pas que qui quoi quel quelle quels quelles comment est-ce avez vous " +
    "votre vos nous notre mon mes ton tes son ses leur peut peux pouvez puis faire fait ici cela cette ces chez " +
    "the and for with you your are can could would there have has what where when how which this that from about " +
    "tiene hay para como donde una los las del che sono per con una gli ich sie der die das ist wie gibt und nicht " +
    "uma com voce onde tem nga ndax lan"
  ).split(" "),
);

// Termes de la question → termes des documents (rédigés en français)
// prettier-ignore
const SYNONYMES: Record<string, string[]> = {
  visiter: ["decouvrir"], visite: ["decouvrir"], voir: ["decouvrir"], adapter: ["adaptateur"], adaptor: ["adaptateur"],
  plug: ["prise", "adaptateur"], socket: ["prise"], enchufe: ["prise", "adaptateur"], presa: ["prise"],
  steckdose: ["prise", "adaptateur"], tomada: ["prise"], electricite: ["courant", "prise"], electricity: ["courant"],
  safe: ["coffre"], cofre: ["coffre"], cassaforte: ["coffre"], laundry: ["blanchisserie", "linge"],
  lavanderia: ["blanchisserie"], wasche: ["blanchisserie"], pressing: ["blanchisserie"], luggage: ["bagages"],
  bags: ["bagages"], equipaje: ["bagages"], bagagli: ["bagages"], gepack: ["bagages"], bagagem: ["bagages"],
  valise: ["bagages"], smoke: ["fumer"], smoking: ["fumer", "fumeurs"], fumar: ["fumer"], fumare: ["fumer"],
  rauchen: ["fumer"], cigarette: ["fumer"], pet: ["animaux"], pets: ["animaux"], dog: ["animaux"], chien: ["animaux"],
  chat: ["animaux"], mascota: ["animaux"], animali: ["animaux"], haustier: ["animaux"], animais: ["animaux"],
  noise: ["calme"], quiet: ["calme"], bruit: ["calme"], mosquito: ["moustiques"], mosquitoes: ["moustiques"],
  zanzara: ["moustiques"], mucke: ["moustiques"], moustiquaire: ["moustiques"], water: ["eau"], agua: ["eau"],
  acqua: ["eau"], wasser: ["eau"], money: ["argent", "fcfa"], cash: ["argent", "distributeur"], atm: ["distributeur"],
  cajero: ["distributeur"], bancomat: ["distributeur"], geldautomat: ["distributeur"], multibanco: ["distributeur"],
  exchange: ["change"], payer: ["paiements"], payment: ["paiements"], wave: ["paiements"], pharmacy: ["pharmacie"],
  farmacia: ["pharmacie"], apotheke: ["pharmacie"], mosque: ["mosquee"], mezquita: ["mosquee"], moschea: ["mosquee"],
  moschee: ["mosquee"], mesquita: ["mosquee"], priere: ["mosquee", "religieuse"], prier: ["mosquee"],
  church: ["eglise"], iglesia: ["eglise"], chiesa: ["eglise"], kirche: ["eglise"], igreja: ["eglise"],
  messe: ["eglise", "offices"], visitor: ["visiteurs"], visitors: ["visiteurs"], ami: ["visiteurs"],
  amis: ["visiteurs"], invite: ["visiteurs"], pool: ["piscine"], swimming: ["piscine"], nager: ["piscine"],
  enfant: ["enfants"], kids: ["enfants"], children: ["enfants"], clim: ["climatisation"], aircon: ["climatisation"],
  linge: ["blanchisserie"], repasser: ["blanchisserie"], ironing: ["blanchisserie"], ramadan: ["ramadan"],
  photo: ["photos"], photographier: ["photos"], negocier: ["taxi"], saluer: ["salutations"], wolof: ["salutations"],
  مسجد: ["mosquee"], صيدلية: ["pharmacie"], مسبح: ["piscine"], كنيسة: ["eglise"], تدخين: ["fumer"], ماء: ["eau"],
};

// Une section ne répond que si elle cite un mot rare de la question dans son titre,
// ou plusieurs dans son texte : « Tu es fort ? » ne mène pas au coffre-fort.
const SCORE_MIN = 2.2;
const PARAGRAPHES_MAX = 2;

/** Passage du livret qui répond le mieux à la question (les paragraphes utiles de la meilleure section), ou null. */
export function rechercherLivret(message: string, documents: DocumentPrompt[]): string | null {
  const mots = normaliser(message)
    .split(" ")
    .filter((mot) => mot.length >= 3 && !MOTS_OUTILS.has(mot));
  const synonymes = (mot: string) => SYNONYMES[mot] ?? SYNONYMES[mot.replace(/s$/, "")] ?? [];
  const requete = [...new Set(mots.flatMap((mot) => [mot, ...synonymes(mot)]))];
  if (requete.length === 0) return null;

  const toutes = sections(documents).map((section) => ({
    section,
    titre: normaliser(section.titre).split(" "),
    corps: normaliser(section.corps).split(" "),
  }));
  const present = (mots: string[], mot: string) => mots.some((m) => m.length >= 3 && correspond(m, mot));
  const idf = (mot: string) => {
    const frequence = toutes.filter((s) => present(s.titre, mot) || present(s.corps, mot)).length;
    return frequence === 0 ? 0 : Math.log(1 + toutes.length / frequence);
  };

  let meilleure: { section: Section; score: number; titreCite: boolean } | null = null;
  for (const candidate of toutes) {
    let score = 0;
    let titreCite = false;
    for (const mot of requete) {
      if (present(candidate.titre, mot)) {
        score += 2 * idf(mot);
        titreCite = true;
      } else if (present(candidate.corps, mot)) score += idf(mot);
    }
    if (!meilleure || score > meilleure.score) meilleure = { section: candidate.section, score, titreCite };
  }
  if (!meilleure || meilleure.score < SCORE_MIN) return null;

  // Seulement les paragraphes qui parlent de la question (« où fumer ? » : pas tout le règlement)
  const paragraphes = meilleure.section.corps
    .split(/\n+/)
    .map((paragraphe) => paragraphe.trim())
    .filter(Boolean);
  const notes = paragraphes.map((paragraphe) => {
    const motsParagraphe = normaliser(paragraphe).split(" ");
    return requete.reduce((score, mot) => score + (present(motsParagraphe, mot) ? idf(mot) : 0), 0);
  });
  const maximum = Math.max(...notes);
  // Section citée par son titre sans paragraphe plus précis : elle répond en entier
  if (maximum === 0) return meilleure.titreCite ? meilleure.section.corps : null;
  return paragraphes
    .filter((_, rang) => notes[rang] >= maximum * 0.6)
    .slice(0, PARAGRAPHES_MAX)
    .join("\n\n");
}

/** Lieux recommandés par la conciergerie : « Nom : description » dans la section des incontournables. */
export function lieuxRecommandes(documents: DocumentPrompt[]): { nom: string; resume: string }[] {
  const section = sections(documents).find((s) =>
    /decouvrir|incontournable|a voir|visiter/.test(normaliser(`${s.titre} ${s.document}`)),
  );
  if (!section) return [];
  return section.corps
    .split("\n")
    .map((ligne) => /^([^:]{2,60})\s:\s(.+)$/.exec(ligne.trim()))
    .filter((resultat): resultat is RegExpExecArray => resultat !== null)
    .map(([, nom, description]) => ({ nom: nom.trim(), resume: description.split(/(?<=\.)\s/)[0].trim() }));
}

// « de 8h à 19h », « 7h – 10h30 », « entre 9h et 15h », « 11h à minuit »
const PLAGES_DOCUMENT = /(\d{1,2})\s?h\s?(\d{2})?\s*(?:à|a|et|-|–)\s*(?:(\d{1,2})\s?h\s?(\d{2})?|(minuit))/gi;

/** Plages horaires d'une section (« de 12h à 15h, dîner de 19h à 22h30 » → « 12h – 15h, 19h – 22h30 »). */
function plagesDansSection(section: Section, langue: LangueClient): string | null {
  // Même écriture que les horaires de la carte : « 7h – 10h30 » en français
  const heure = (h: string, m = "00") =>
    langue === "fr" ? `${Number(h)}h${m === "00" ? "" : m}` : heureLisible(`${h}:${m}`, langue);
  const plages = [...section.corps.matchAll(PLAGES_DOCUMENT)].map(
    ([, h1, m1, h2, m2, minuit]) =>
      `${heure(h1, m1)} – ${minuit ? (langue === "fr" ? "minuit" : heure("0")) : heure(h2, m2)}`,
  );
  return plages.length > 0 ? plages.join(", ") : null;
}

/** Mise en forme des lignes d'horaires (rubrique de la carte, ou lieu décrit dans la documentation). */
function formateursHoraires(documents: DocumentPrompt[], langue: LangueClient, t: TraduireClient) {
  const separateur = langue === "fr" ? " : " : ": ";
  return {
    ligneRubrique: (categorie: Categorie, texteLibre = true) => {
      const plage = texteLibre
        ? horairesLisibles(categorie.horaires, langue, t)
        : plageHoraire(categorie.horaires, langue, t);
      return plage ? `- ${nomRubrique(categorie, langue)}${separateur}**${plage}**` : null;
    },
    ligneLieu: (lieu: (typeof LIEUX)[number]) => {
      const section = sections(documents).find((s) => normaliser(s.titre).includes(lieu.titre));
      const plage = section ? plagesDansSection(section, langue) : null;
      return plage ? `- ${lieu.noms[langue]}${separateur}**${plage}**` : null;
    },
  };
}

/** L'horaire d'une rubrique ou d'un lieu nommément cité (« la piscine »), sinon null. */
export function horaireCible(
  texte: string,
  categories: Categorie[],
  documents: DocumentPrompt[],
  langue: LangueClient,
  t: TraduireClient,
): string | null {
  const { ligneRubrique, ligneLieu } = formateursHoraires(documents, langue, t);
  const rubrique = rubriqueCitee(texte, categories);
  const lieu = LIEUX.find((l) => l.mots.some((mot) => ` ${texte} `.includes(` ${normaliser(mot.replace("*", ""))}`)));
  return (rubrique && ligneRubrique(rubrique)) ?? (lieu && ligneLieu(lieu)) ?? null;
}

/** Lignes « - Petit-déjeuner : 7h – 10h30 » pour une question d'horaire, ciblée si possible. */
export function lignesHoraires(
  texte: string,
  categories: Categorie[],
  documents: DocumentPrompt[],
  langue: LangueClient,
  t: TraduireClient,
): string[] {
  const cible = horaireCible(texte, categories, documents, langue, t);
  if (cible) return [cible];

  // Question générale : tous les horaires connus, sans doublon (le petit-déjeuner
  // de la documentation quand la carte a déjà sa rubrique) ni consigne en texte libre
  const { ligneRubrique, ligneLieu } = formateursHoraires(documents, langue, t);
  return [
    ...LIEUX.filter((l) => !rubriqueCitee(l.titre, categories)).map(ligneLieu),
    ...categories.filter((categorie) => categorie.type !== "TRANSPORT").map((c) => ligneRubrique(c, false)),
  ].filter((ligne): ligne is string => ligne !== null);
}
