// Utilitaires de formatage partagés (serveur et client).
import { estLangueClient, FICHES_LANGUES } from "@/lib/langues";

/** 4500 → « 4 500 FCFA » (le franc CFA n'a pas de décimales). */
export function formaterPrix(montant: number, devise = "XOF", langue = "fr"): string {
  const locale = estLangueClient(langue) ? FICHES_LANGUES[langue].locale : "fr-FR";
  const nombre = new Intl.NumberFormat(locale).format(montant);
  return devise === "XOF" ? `${nombre} FCFA` : `${nombre} ${devise}`;
}

/** Date et heure lisibles dans le fuseau de l'hôtel, pour le contexte de l'IA. */
export function dateHeureLisible(fuseauHoraire: string, date = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fuseauHoraire,
  }).format(date);
}

/** Heure d'un message, à la manière d'une messagerie : « 21:04 ». */
export function heureMessage(instant: string, langue: string): string {
  const locale = estLangueClient(langue) ? FICHES_LANGUES[langue].locale : "fr-FR";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(instant));
}

/** Clé de jour locale (AAAA-MM-JJ), pour séparer le fil par journée. */
export function cleJour(instant: string): string {
  const date = new Date(instant);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Jour d'un message : « aujourd'hui », « hier » ou la date. */
export function libelleJour(instant: string, langue: string, aujourdhui: string, hier: string): string {
  const veille = new Date();
  veille.setDate(veille.getDate() - 1);
  if (cleJour(instant) === cleJour(new Date().toISOString())) return aujourdhui;
  if (cleJour(instant) === cleJour(veille.toISOString())) return hier;
  const locale = estLangueClient(langue) ? FICHES_LANGUES[langue].locale : "fr-FR";
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(instant));
}

/** Texte comparable pour la recherche : sans accents ni majuscules (« Réception » → « reception »). */
export const sansAccents = (texte: string) => texte.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Version des photos de la carte livrées avec l'application : à augmenter quand elles changent,
// pour que les téléphones les rechargent aussitôt malgré leur mise en cache (un jour)
const VERSION_PHOTOS = 2;

/** Adresse d'une photo : les photos de l'application portent leur version ; un lien de l'hôtel reste tel quel. */
export const adressePhoto = (photo: string) => (photo.startsWith("/images/") ? `${photo}?v=${VERSION_PHOTOS}` : photo);
