// Lignes de travail de l'équipe, communes à « À traiter » et aux avis : numéro de chambre,
// ce qu'il faut savoir, puis l'action à droite (dessous sur téléphone).
import {
  BedDouble,
  CarFront,
  ConciergeBell,
  Flower2,
  MessageCircleQuestion,
  Star,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { marquerAvisTraite } from "@/app/espace/actions";
import { BoutonEnvoi } from "@/composants/espace/ActionsDemande";
import type { Attente } from "@/lib/attente";
import type { DepartementVue } from "@/lib/types";
import type { TraduireEquipe } from "@/lib/i18n/equipe";
import type { LangueEquipe } from "@/lib/langues";

// Sur téléphone, le numéro s'aligne sur le titre (les actions passent dessous)
export const LIGNE =
  "flex flex-wrap items-start gap-x-4 gap-y-3.5 rounded-[22px] border border-ligne bg-surface px-4 py-4 shadow-carte sm:items-center sm:px-6";
// Urgence : trait rouge à gauche, en plus de l'ombre de la carte
export const LIGNE_URGENTE =
  "border-alerte/40 bg-[color-mix(in_oklab,var(--color-alerte)_4%,white)] shadow-[inset_3px_0_0_var(--color-alerte),0_1px_2px_rgb(26_27_23/0.04),0_8px_24px_-12px_rgb(26_27_23/0.12)]";
export const NUMERO = "texte-numeros w-12 shrink-0 pt-px text-numeros sm:pt-0";
export const TITRE = "texte-textes-equipe flex min-w-0 flex-1 items-start gap-2 text-textes-equipe";
export const META = "texte-details-equipe mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-details-equipe";

// Demandes (commandes, questions) : lignes compactes d'une même liste groupée, l'action à droite ;
// une réponse en cours d'écriture passe sous la ligne, sur toute la largeur
export const LISTE_DEMANDES =
  "divide-y divide-ligne overflow-hidden rounded-[20px] border border-ligne bg-surface shadow-carte";
export const LIGNE_DEMANDE = "flex flex-wrap items-center gap-x-3 gap-y-2.5 px-3.5 py-3 sm:px-5";
export const LIGNE_DEMANDE_URGENTE =
  "bg-[color-mix(in_oklab,var(--color-alerte)_4%,white)] shadow-[inset_3px_0_0_var(--color-alerte)]";

// Le service qui traite la demande, reconnaissable à son icône
const ICONES_SERVICE: Record<DepartementVue, LucideIcon> = {
  RECEPTION: ConciergeBell,
  ETAGES: BedDouble,
  RESTAURATION: UtensilsCrossed,
  TECHNIQUE: Wrench,
  CONCIERGERIE: CarFront,
  BIEN_ETRE: Flower2,
};

/** Icône du service (ou de la question), discrète : pour les lignes compactes. */
export function IconeService({ departement, question }: { departement: DepartementVue; question: boolean }) {
  const Icone = question ? MessageCircleQuestion : ICONES_SERVICE[departement];
  return <Icone className="size-3.5 shrink-0 text-bouton" strokeWidth={2.4} aria-hidden />;
}

/** Pastille du service (ou « Question ») : une icône franche et son nom. */
export function PastilleService({
  departement,
  question,
  libelle,
}: {
  departement: DepartementVue;
  question: boolean;
  libelle: string;
}) {
  const Icone = question ? MessageCircleQuestion : ICONES_SERVICE[departement];
  return (
    <span className="texte-services-equipe inline-flex items-center gap-1.5 rounded-full bg-bouton/8 px-2.5 py-1 text-services-equipe">
      <Icone className="size-4 shrink-0 text-bouton" strokeWidth={2.4} aria-hidden />
      {libelle}
    </span>
  );
}
export const PASTILLE_ROUGE =
  "texte-etiquettes-equipe mt-px shrink-0 rounded-full bg-alerte px-2 py-0.5 uppercase text-white";

/** Heure de réception : discrète tant que l'attente est raisonnable, rouge au-delà du seuil (durée en info-bulle). */
export function PastilleAttente({ attente: { heure, duree, enRetard }, t }: { attente: Attente; t: TraduireEquipe }) {
  return (
    <span
      title={t("enAttenteDepuis", { duree })}
      className={`texte-etiquettes-equipe inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 tabular-nums ${
        enRetard ? "bg-alerte/10 text-alerte" : "bg-creux text-encre-douce"
      }`}
    >
      {heure}
    </span>
  );
}

export type AvisAffiche = {
  id: string;
  note: number;
  commentaire: string | null;
  traductions: unknown;
  chambre: { numero: string };
  sejour: { nomClient: string | null } | null;
};

/** Un avis : la note, le commentaire dans la langue de l'équipe et, s'il est décevant, le geste à faire. */
export function LigneAvis({
  avis,
  attente,
  aTraiter,
  nouveau = false,
  langue,
  t,
}: {
  avis: AvisAffiche;
  attente: Attente;
  aTraiter: boolean; // note basse non traitée : un geste à faire pendant le séjour
  nouveau?: boolean;
  langue: LangueEquipe;
  t: TraduireEquipe;
}) {
  const commentaire = avis.commentaire
    ? ((avis.traductions as Record<string, string>)[langue] ?? avis.commentaire)
    : null;
  return (
    <li className={LIGNE}>
      <span className={NUMERO}>{avis.chambre.numero}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <p className={TITRE}>
            {nouveau && <span className={PASTILLE_ROUGE}>{t("nouveau")}</span>}
            <span className="line-clamp-2 min-w-0">
              {commentaire ? `« ${commentaire} »` : t("avisSansCommentaire")}
            </span>
          </p>
          <PastilleAttente attente={attente} t={t} />
        </div>
        {aTraiter && <p className="texte-courant-equipe mt-0.5 text-courant-equipe">{t("conseilAvis")}</p>}
        <p className={META}>
          <span className="flex" aria-label={`${avis.note}/5`}>
            {[1, 2, 3, 4, 5].map((valeur) => (
              <Star
                key={valeur}
                className={`size-4 ${
                  valeur > avis.note ? "text-ligne" : aTraiter ? "fill-alerte text-alerte" : "fill-accent text-accent"
                }`}
              />
            ))}
          </span>
          ·<span>{t("avisClient")}</span>
          {avis.sejour?.nomClient && (
            <>
              ·<span>{avis.sejour.nomClient}</span>
            </>
          )}
        </p>
      </div>
      {aTraiter && (
        <form action={marquerAvisTraite} className="flex w-full justify-end sm:w-auto">
          <input type="hidden" name="avisId" value={avis.id} />
          <BoutonEnvoi className="texte-boutons-equipe flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-ligne bg-surface px-4 text-encre transition hover:bg-creux active:scale-[0.98] disabled:opacity-60">
            {t("clientRecontacte")}
          </BoutonEnvoi>
        </form>
      )}
    </li>
  );
}
