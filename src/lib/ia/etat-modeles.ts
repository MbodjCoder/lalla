// Santé des modèles d'IA, partagée entre toutes les instances du serveur.
//
// En production, chaque requête peut tomber sur une instance neuve : une mémoire locale
// oublierait qu'un modèle a épuisé son quota ou répond en 15 s, et chaque instance
// repaierait l'attente. L'état est donc gardé en base, avec une copie locale de
// quelques secondes pour ne pas l'interroger à chaque appel.
import "server-only";
import { enArrierePlan } from "@/lib/arriere-plan";
import { bdd } from "@/lib/bdd";

export type EtatModele = { indisponibleJusqua: number; lentJusqua: number };

// Copie locale : assez courte pour suivre l'état réel, assez longue pour épargner la base
const DUREE_COPIE_MS = 10_000;
// Un modèle redevenu « rapide » depuis moins longtemps est retenté en parallèle d'un modèle sûr
export const FENETRE_SONDE_MS = 6 * 60 * 60_000;
let copie: { lueLe: number; etats: Map<string, EtatModele> } | null = null;

/** État de chaque modèle connu (absent = disponible et rapide). */
export async function lireEtatsModeles(): Promise<Map<string, EtatModele>> {
  if (copie && Date.now() - copie.lueLe < DUREE_COPIE_MS) return copie.etats;
  try {
    const lignes = await bdd.etatModeleIA.findMany({
      where: {
        OR: [
          { indisponibleJusqua: { gt: new Date() } },
          { lentJusqua: { gt: new Date(Date.now() - FENETRE_SONDE_MS) } },
        ],
      },
    });
    const etats = new Map(
      lignes.map((ligne) => [
        ligne.modele,
        { indisponibleJusqua: ligne.indisponibleJusqua?.getTime() ?? 0, lentJusqua: ligne.lentJusqua?.getTime() ?? 0 },
      ]),
    );
    copie = { lueLe: Date.now(), etats };
    return etats;
  } catch {
    // Base indisponible : on continue avec la dernière copie (ou sans état), sans bloquer la réponse
    return copie?.etats ?? new Map();
  }
}

/** Met à jour l'état d'un modèle : tout de suite pour cette instance, en base pour les autres. */
export function noterEtatModele(
  modele: string,
  changement: { indisponibleJusqua?: number | null; lentJusqua?: number | null; latenceMs?: number },
) {
  const actuel = copie?.etats.get(modele) ?? { indisponibleJusqua: 0, lentJusqua: 0 };
  const suivant = {
    indisponibleJusqua:
      changement.indisponibleJusqua === undefined ? actuel.indisponibleJusqua : (changement.indisponibleJusqua ?? 0),
    lentJusqua: changement.lentJusqua === undefined ? actuel.lentJusqua : (changement.lentJusqua ?? 0),
  };
  copie ??= { lueLe: Date.now(), etats: new Map() };
  copie.etats.set(modele, suivant);

  const enDate = (instant: number | null | undefined) =>
    instant === undefined ? undefined : instant ? new Date(instant) : null;
  const donnees = {
    indisponibleJusqua: enDate(changement.indisponibleJusqua),
    lentJusqua: enDate(changement.lentJusqua),
    latenceMs: changement.latenceMs,
  };
  enArrierePlan("etat-modele", () =>
    bdd.etatModeleIA.upsert({ where: { modele }, create: { modele, ...donnees }, update: donnees }),
  );
}
