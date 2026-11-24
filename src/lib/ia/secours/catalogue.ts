// Repérage des articles et rubriques de la carte cités par le client.
import type { CategorieAvecArticles } from "@/lib/ia/prompt-systeme";
import { choisirTraduction, type LangueClient } from "@/lib/langues";
import { mentionne, MOTS, NOMBRES, normaliser } from "./comprehension";

export type Categorie = CategorieAvecArticles;
export type Article = Categorie["articles"][number];
export type ArticleTrouve = { article: Article; quantite: number };
type TraductionsFiche = Partial<Record<string, { nom: string; description?: string }>>;

// Mots trop communs pour identifier un article (« petit », « frais », « du jour »…)
// prettier-ignore
const MOTS_VIDES = new Set([
  "de", "du", "des", "la", "le", "les", "au", "aux", "et", "en", "l", "d", "of", "the", "and", "with", "con", "di",
  "del", "della", "al", "mit", "und", "com", "do", "da", "ak", "bu", "wu", "ci", "petit", "grand", "small", "large",
  "frais", "fresh", "jour", "day", "piece", "pieces", "min", "choix", "choice", "locale", "local", "half", "full",
  "journee", "demi", "chambre", "room", "minerale", "mineral", "service", "bien", "etre", "in", "your", "votre",
]);

// Mots de liaison seulement : pour les noms de rubrique faits de mots communs (« Room service »)
const MOTS_LIAISON = new Set(["de", "du", "des", "la", "le", "les", "au", "aux", "et", "en", "of", "the", "and"]);

export function motsSignificatifs(texte: string, vides: Set<string> = MOTS_VIDES): string[] {
  return normaliser(texte)
    .split(" ")
    .filter((mot) => mot.length >= (vides === MOTS_LIAISON ? 2 : 3) && !vides.has(mot) && !/^\d+$/.test(mot));
}

const singulier = (mot: string) => (mot.length > 3 && mot.endsWith("s") ? mot.slice(0, -1) : mot);

/** Même mot au pluriel près (« beers »), ou flexion proche (« grillé » / « grillée ») ; jamais un simple air de famille. */
export function correspond(a: string, b: string): boolean {
  const [x, y] = [singulier(a), singulier(b)];
  if (x === y) return true;
  const [court, long] = x.length <= y.length ? [x, y] : [y, x];
  return court.length >= 5 && long.startsWith(court) && long.length - court.length <= 3;
}

/** Noms d'un article dans les langues utiles : français, anglais et celle du client. */
function nomsArticle(article: Article, langue: LangueClient): string[] {
  const traductions = article.traductions as TraductionsFiche;
  return [
    ...new Set([article.nom, traductions.en?.nom, traductions[langue]?.nom].filter((nom): nom is string => !!nom)),
  ];
}

export function nomArticle(article: Article, langue: LangueClient): string {
  return choisirTraduction(article.traductions as TraductionsFiche, langue, { nom: article.nom }).nom;
}

export function descriptionArticle(article: Article, langue: LangueClient): string | null {
  const source = { nom: article.nom, description: article.description ?? undefined };
  return choisirTraduction(article.traductions as TraductionsFiche, langue, source).description ?? null;
}

export function nomRubrique(categorie: Categorie, langue: LangueClient): string {
  return choisirTraduction(categorie.traductions as TraductionsFiche, langue, { nom: categorie.nom }).nom;
}

/** Article désigné par son nom exact, dans n'importe quelle langue (pour relire un message précédent). */
export function articleParNom(nom: string, categories: Categorie[]): Article | null {
  const cible = normaliser(nom);
  for (const article of categories.flatMap((categorie) => categorie.articles)) {
    const traductions = article.traductions as TraductionsFiche;
    const noms = [article.nom, ...Object.values(traductions).map((traduction) => traduction?.nom ?? "")];
    if (noms.some((n) => normaliser(n) === cible)) return article;
  }
  return null;
}

/** Repère les articles cités dans le message ; un mot qui en désigne plusieurs à égalité est ambigu. */
export function articlesCites(
  motsMessage: string[],
  categories: Categorie[],
  langue: LangueClient,
  exclureTransport: boolean,
): { trouves: ArticleTrouve[]; ambigus: Article[] } {
  const candidats: { article: Article; positions: number[]; score: number }[] = [];
  for (const categorie of categories) {
    if (exclureTransport && categorie.type === "TRANSPORT") continue;
    for (const article of categorie.articles) {
      let meilleur: number[] = [];
      for (const nom of nomsArticle(article, langue)) {
        const motsNom = motsSignificatifs(nom);
        const positions = motsMessage.flatMap((mot, position) =>
          motsNom.some((m) => correspond(m, mot)) ? [position] : [],
        );
        if (positions.length > meilleur.length) meilleur = positions;
      }
      if (meilleur.length > 0) candidats.push({ article, positions: meilleur, score: meilleur.length });
    }
  }

  const trouves = new Map<string, ArticleTrouve>();
  const ambigus = new Map<string, Article>();
  const positionsTraitees = new Set<number>();
  for (const candidat of [...candidats].sort((a, b) => b.score - a.score)) {
    if (candidat.positions.every((position) => positionsTraitees.has(position))) continue;
    const rivaux = candidats.filter(
      (autre) => autre.score === candidat.score && autre.positions.some((p) => candidat.positions.includes(p)),
    );
    if (rivaux.length > 1) {
      rivaux.forEach((rival) => ambigus.set(rival.article.id, rival.article));
    } else {
      trouves.set(candidat.article.id, {
        article: candidat.article,
        quantite: quantiteAvant(motsMessage, candidat.positions[0]),
      });
    }
    rivaux.forEach((rival) => rival.positions.forEach((p) => positionsTraitees.add(p)));
  }
  return { trouves: [...trouves.values()], ambigus: [...ambigus.values()] };
}

/** Quantité écrite juste avant l'article (« 2 bissap », « deux bissap ») ; 1 par défaut. */
function quantiteAvant(motsMessage: string[], position: number): number {
  for (const mot of motsMessage.slice(Math.max(0, position - 2), position).reverse()) {
    const valeur = /^\d{1,2}$/.test(mot) ? Number(mot) : NOMBRES[mot];
    if (valeur && valeur >= 1 && valeur <= 20) return valeur;
  }
  return 1;
}

/** Rubrique de la carte désignée par son nom dans le message (« room service », « spa »…). */
export function rubriqueCitee(texte: string, categories: Categorie[]): Categorie | null {
  const mots = texte.split(" ");
  for (const categorie of categories) {
    const traductions = categorie.traductions as TraductionsFiche;
    const noms = [categorie.nom, ...Object.values(traductions).map((traduction) => traduction?.nom ?? "")];
    const citee = noms.some((nom) => {
      // « Spa & bien-être » → « spa » suffit ; « Room service » → les deux mots
      const distinctifs = motsSignificatifs(nom);
      const motsNom = distinctifs.length > 0 ? distinctifs : motsSignificatifs(nom, MOTS_LIAISON);
      return motsNom.length > 0 && motsNom.every((motNom) => mots.some((mot) => correspond(motNom, mot)));
    });
    if (citee) return categorie;
  }
  return null;
}

/** Rubrique à présenter : citée par son nom, sinon déduite de l'envie (faim, soif, spa, excursion). */
export function rubriqueAPresenter(texte: string, categories: Categorie[]): Categorie | null {
  const parType = (type: string) =>
    categories.find((categorie) => categorie.type === type && categorie.articles.some((a) => a.disponible)) ?? null;
  const citee = rubriqueCitee(texte, categories);
  if (citee) return citee;
  if (mentionne(texte, MOTS.soif)) return parType("BOISSONS");
  if (mentionne(texte, MOTS.bienEtre)) return parType("BIEN_ETRE");
  if (mentionne(texte, MOTS.excursion)) return parType("EXPERIENCE");
  if (mentionne(texte, MOTS.faim)) {
    // La rubrique de restauration la plus fournie : la carte principale plutôt que le petit-déjeuner
    const restauration = categories.filter((categorie) => categorie.type === "RESTAURATION");
    return restauration.sort((a, b) => b.articles.length - a.articles.length)[0] ?? null;
  }
  return null;
}
