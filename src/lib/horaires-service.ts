// Horaires de service d'une rubrique (« 11h – 23h », « 18h-2h », « 24h/24 ») : est-elle ouverte
// à un instant donné, à l'heure de l'hôtel ? Partagé par le moteur IA, le mode secours et les
// commandes : une commande hors horaires est refusée côté serveur, quoi qu'ait dit le modèle.
const PLAGE = /^(\d{1,2})\s?h(\d{2})?\s?[–-]\s?(\d{1,2})\s?h(\d{2})?$/;

export type EtatOuverture = "ouvert" | "ferme" | "inconnu";

const MINUTES_PAR_JOUR = 24 * 60;

/** Minutes écoulées depuis minuit, à l'heure de l'hôtel. */
function minutesDansFuseau(instant: Date, fuseau: string): number {
  const parties = new Intl.DateTimeFormat("en-GB", {
    timeZone: fuseau,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const valeur = (type: string) => Number(parties.find((partie) => partie.type === type)?.value ?? 0);
  return valeur("hour") * 60 + valeur("minute");
}

/** « 08:30 » → 510 minutes ; null si l'heure est mal formée. */
export function minutesDepuisHeure(heure: string): number | null {
  const correspondance = /^(\d{1,2}):(\d{2})$/.exec(heure.trim());
  if (!correspondance) return null;
  const [heures, minutes] = [Number(correspondance[1]), Number(correspondance[2])];
  return heures < 24 && minutes < 60 ? heures * 60 + minutes : null;
}

/**
 * Ouverture d'une rubrique à un moment donné : maintenant, ou à `heureVoulue` (« 08:00 »)
 * pour une commande programmée. Un horaire en texte libre ne bloque jamais (« inconnu »).
 */
export function etatOuverture(
  horaires: string | null | undefined,
  fuseau: string,
  { instant = new Date(), heureVoulue }: { instant?: Date; heureVoulue?: string } = {},
): EtatOuverture {
  if (!horaires) return "inconnu";
  const principal = horaires.split(" — ")[0].trim(); // la précision après le tiret est libre
  if (/^24\s?h\s?\/\s?24$/i.test(principal)) return "ouvert";
  const plage = PLAGE.exec(principal);
  if (!plage) return "inconnu";

  const debut = Number(plage[1]) * 60 + Number(plage[2] ?? 0);
  const fin = Number(plage[3]) * 60 + Number(plage[4] ?? 0);
  const voulue = heureVoulue ? minutesDepuisHeure(heureVoulue) : null;
  const moment = voulue ?? minutesDansFuseau(instant, fuseau);
  // Une plage qui passe minuit (18h – 2h) est ouverte le soir ET au petit matin
  const ouverte = fin > debut ? moment >= debut && moment < fin : moment >= debut || moment < fin;
  return ouverte ? "ouvert" : "ferme";
}

/** Heure de l'hôtel lisible (« 02:14 »), pour expliquer un refus. */
export function heureHotel(fuseau: string, instant = new Date()): string {
  const minutes = minutesDansFuseau(instant, fuseau);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Prochain instant où il sera « HH:MM » à l'hôtel (maintenant compris) ; null si l'heure est illisible. */
export function prochainInstant(heure: string, fuseau: string, instant = new Date()): Date | null {
  const voulue = minutesDepuisHeure(heure);
  if (voulue === null) return null;
  const ecart = (voulue - minutesDansFuseau(instant, fuseau) + MINUTES_PAR_JOUR) % MINUTES_PAR_JOUR;
  const resultat = new Date(instant.getTime() + ecart * 60_000);
  resultat.setSeconds(0, 0);
  return resultat;
}

/** Instant correspondant à « AAAA-MM-JJ » et « HH:MM » à l'heure de l'hôtel. */
export function instantLocal(jour: string, heure: string, fuseau: string): Date {
  const [annee, mois, date] = jour.split("-").map(Number);
  const [heures, minutes] = heure.split(":").map(Number);
  const supposition = Date.UTC(annee, mois - 1, date, heures, minutes);
  // Même instant vu dans le fuseau : l'écart avec la supposition est le décalage horaire
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: fuseau,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(supposition)
      .map((partie) => [partie.type, Number(partie.value)]),
  );
  const vu = Date.UTC(parties.year, parties.month - 1, parties.day, parties.hour, parties.minute);
  return new Date(supposition - (vu - supposition));
}

/** Jour « AAAA-MM-JJ » d'un instant, à l'heure de l'hôtel. */
export function jourHotel(fuseau: string, instant = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuseau }).format(instant);
}
