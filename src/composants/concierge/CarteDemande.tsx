"use client";

import {
  BedDouble,
  CalendarDays,
  CarFront,
  Check,
  Clock3,
  ConciergeBell,
  Flower2,
  Loader2,
  MessageCircleQuestion,
  UtensilsCrossed,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formaterPrix, heureMessage } from "@/lib/format";
import type { TraduireClient } from "@/lib/i18n/client";
import { choisirTraduction, type LangueClient } from "@/lib/langues";
import type { DemandeVue } from "@/lib/types";
import { texteRefus } from "./textes-demande";

type Proprietes = {
  demande: DemandeVue;
  devise: string;
  langue: LangueClient;
  t: TraduireClient;
  onDecider: (decision: Decision) => Promise<boolean>;
};

type Decision = "confirmer" | "annuler";

// Durée de la confirmation d'annulation (même valeur que l'animation « decompte » de globals.css)
const DUREE_CONFIRMATION_MS = 6000;

// Icône selon le service qui traite la demande
const ICONES = {
  RECEPTION: ConciergeBell,
  ETAGES: BedDouble,
  RESTAURATION: UtensilsCrossed,
  TECHNIQUE: Wrench,
  CONCIERGERIE: CarFront,
  BIEN_ETRE: Flower2,
};
const TITRES = {
  COMMANDE: "votreCommande",
  SERVICE: "votreDemande",
  INCIDENT: "signalement",
} as const;

export function CarteDemande(proprietes: Proprietes) {
  return proprietes.demande.type === "QUESTION" ? <CarteQuestion {...proprietes} /> : <CarteAction {...proprietes} />;
}

/** Confirmation par le client d'une carte proposée ; une carte périmée ne peut plus être envoyée. */
function useDecision(onDecider: Proprietes["onDecider"]) {
  const [decisionEnCours, setDecisionEnCours] = useState<Decision | null>(null);
  const [expiree, setExpiree] = useState(false);
  async function decider(decision: Decision) {
    setDecisionEnCours(decision);
    const reussie = await onDecider(decision);
    if (!reussie) setExpiree(true);
    setDecisionEnCours(null);
  }
  return { decisionEnCours, expiree, decider };
}

/** Commande, demande de service ou signalement, avec son suivi. */
function CarteAction({ demande, devise, langue, t, onDecider }: Proprietes) {
  const { decisionEnCours, expiree, decider } = useDecision(onDecider);
  const Icone = ICONES[demande.departement];
  const estCommande = demande.type === "COMMANDE";
  const annulee = demande.statut === "ANNULEE";
  const textes = choisirTraduction(demande.textes, langue, demande.textes.fr);
  // Transmise mais pas encore acceptée : le client peut encore l'annuler (une urgence reste transmise)
  const annulable = demande.statut === "CONFIRMEE" && !demande.urgent;
  const [confirmationAnnulation, setConfirmationAnnulation] = useState(false);

  // Confirmation temporaire : sans réponse, elle se referme d'elle-même (barre de compte à rebours)
  useEffect(() => {
    if (!confirmationAnnulation || decisionEnCours) return;
    const minuterie = setTimeout(() => setConfirmationAnnulation(false), DUREE_CONFIRMATION_MS);
    return () => clearTimeout(minuterie);
  }, [confirmationAnnulation, decisionEnCours]);

  async function annuler() {
    await decider("annuler");
    setConfirmationAnnulation(false);
  }

  // Carte annulée atténuée par ses enfants : l'animation d'apparition fige l'opacité de la carte elle-même
  return (
    <article
      className={`relative animate-montee overflow-hidden rounded-[22px] border bg-surface shadow-carte transition-opacity duration-300 ${
        demande.urgent ? "border-alerte/40" : "border-ligne/80"
      } ${annulee && !demande.declinee ? "[&>*]:opacity-55" : ""}`}
    >
      <header className={`flex items-center gap-2.5 ps-4 pt-3.5 ${annulable ? "pe-12" : "pe-4"}`}>
        <span className="grid size-8 place-items-center rounded-full bg-accent-pale text-accent-profond">
          <Icone className="size-4" strokeWidth={2.3} />
        </span>
        <h3 className="texte-titres-cartes flex-1 text-titres-cartes">
          {t(TITRES[demande.type as keyof typeof TITRES])}
        </h3>
        {demande.urgent && (
          <span className="rounded-full bg-alerte/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-alerte">
            {t("urgent")}
          </span>
        )}
        <time className="shrink-0 text-[11.5px] tabular-nums text-encre-pale">
          {heureMessage(demande.creeLe, langue)}
        </time>
      </header>

      {/* Annuler tant que la réception n'a pas accepté : dans le coin, bien visible sans s'imposer */}
      {annulable && !confirmationAnnulation && (
        <button
          type="button"
          onClick={() => setConfirmationAnnulation(true)}
          aria-label={t("annuler")}
          title={t("annuler")}
          className="absolute end-3 top-3 grid size-8 place-items-center rounded-full bg-creux text-encre-douce ring-1 ring-ligne transition hover:bg-alerte/10 hover:text-alerte hover:ring-alerte/25 active:scale-90"
        >
          <X className="size-4" strokeWidth={2.6} />
        </button>
      )}

      <div className="px-4 pt-3 pb-3.5">
        {estCommande ? (
          <ul className="divide-y divide-ligne/70">
            {demande.lignes.map((ligne, rang) => {
              const texteLigne = choisirTraduction(ligne.textes, langue, ligne.textes.fr);
              return (
                <li key={rang} className="flex items-baseline gap-3 py-2 first:pt-0">
                  <span className="w-7 shrink-0 text-[15px] font-bold tabular-nums text-accent-profond">
                    {ligne.quantite}×
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="texte-textes-cartes block leading-snug text-textes-cartes">
                      {texteLigne.libelle}
                    </span>
                    {texteLigne.remarque && (
                      <span className="mt-0.5 block text-[13.5px] italic text-encre-douce">{texteLigne.remarque}</span>
                    )}
                  </span>
                  <span className="texte-prix shrink-0 tabular-nums text-prix">
                    {formaterPrix(ligne.quantite * ligne.prixUnitaire, devise, langue)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div>
            <p className="texte-textes-cartes leading-snug text-textes-cartes">{textes.resume}</p>
            {textes.details && <p className="mt-1.5 text-[13.5px] leading-snug text-encre-pale">{textes.details}</p>}
          </div>
        )}

        {demande.refuses.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {demande.refuses.map((refuse, rang) => (
              <li
                key={rang}
                className="flex items-start gap-2 rounded-xl bg-attention-fond px-3 py-2.5 text-[14px] leading-snug text-attention"
              >
                <Clock3 className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
                {texteRefus(refuse, langue, t)}
              </li>
            ))}
          </ul>
        )}

        {/* Réservation ou commande programmée : le moment choisi, sous les articles */}
        {estCommande && textes.details && (
          <p className="mt-3 flex items-start gap-2 text-[14.5px] font-medium leading-snug text-encre">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-accent-profond" strokeWidth={2.2} aria-hidden />
            <span className="first-letter:uppercase">{textes.details}</span>
          </p>
        )}

        {estCommande && (
          <div className="mt-2 flex items-baseline justify-between border-t border-ligne pt-2.5">
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-encre-pale">{t("total")}</span>
            <span className="texte-prix texte-total tabular-nums text-prix">
              {formaterPrix(demande.montantTotal, devise, langue)}
            </span>
          </div>
        )}
      </div>

      {demande.statut === "PROPOSEE" && (
        <PiedProposition
          libelle={estCommande ? t("confirmerCommande") : t("confirmer")}
          decisionEnCours={decisionEnCours}
          expiree={expiree}
          decider={decider}
          t={t}
        />
      )}

      {/* Annulée par le client (avant ou après l'avoir transmise) : pas de suivi */}
      {annulee && !demande.declinee && (
        <p className="border-t border-ligne px-4 py-3 text-center text-[13.5px] text-encre-pale">
          {t("demandeAnnulee")}
        </p>
      )}

      {/* Annulation d'une demande transmise : confirmée d'un second geste, contre les erreurs de doigt */}
      {annulable && confirmationAnnulation ? (
        <footer className="relative flex items-center gap-2 border-t border-alerte/15 bg-alerte/[0.04] px-4 py-3">
          <p className="min-w-0 flex-1 text-[14.5px] font-semibold text-encre">{t("confirmerAnnulationDemande")}</p>
          <button
            type="button"
            disabled={decisionEnCours !== null}
            onClick={() => setConfirmationAnnulation(false)}
            className="h-10 shrink-0 rounded-xl px-3.5 text-[14px] font-semibold text-encre-douce transition hover:bg-creux disabled:opacity-50"
          >
            {t("garderDemande")}
          </button>
          <button
            type="button"
            disabled={decisionEnCours !== null}
            onClick={annuler}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-alerte px-4 text-[14px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-70"
          >
            {decisionEnCours === "annuler" && <Loader2 className="size-4 animate-spin" />}
            {t("annuler")}
          </button>
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[3px] origin-left animate-decompte bg-alerte/35 rtl:origin-right"
          />
        </footer>
      ) : (
        (["CONFIRMEE", "PRISE_EN_CHARGE", "TERMINEE"].includes(demande.statut) || demande.declinee) && (
          <SuiviDemande demande={demande} t={t} />
        )
      )}
    </article>
  );
}

/**
 * Question à la réception : un seul bloc, compact, qui réunit la question, son état
 * et, dès qu'elle arrive, la réponse de la réception, mise en avant.
 */
function CarteQuestion({ demande, langue, t, onDecider }: Proprietes) {
  const { decisionEnCours, expiree, decider } = useDecision(onDecider);
  const question = choisirTraduction(demande.textes, langue, demande.textes.fr).resume;
  const { reponse } = demande;
  const texteReponse = reponse
    ? (reponse.traductions[langue] ?? Object.values(reponse.traductions)[0] ?? reponse.original)
    : null;
  const enAttente = demande.statut === "CONFIRMEE" || demande.statut === "PRISE_EN_CHARGE";
  const annulee = demande.statut === "ANNULEE";

  return (
    <article
      className={`animate-montee overflow-hidden rounded-[22px] border border-ligne/80 bg-surface shadow-carte transition-opacity duration-300 ${
        annulee ? "[&>*]:opacity-55" : ""
      }`}
    >
      <div className="px-4 pt-3 pb-3.5">
        <header className="flex min-h-7 items-center gap-2">
          <MessageCircleQuestion className="size-4 shrink-0 text-accent-profond" strokeWidth={2} aria-hidden />
          <h3 className="flex-1 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-encre-douce">
            {t("votreQuestion")}
          </h3>
          {enAttente && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-pale px-2.5 py-1 text-[11.5px] font-semibold text-accent-profond">
              <span className="size-1.5 animate-pulsation rounded-full bg-accent" aria-hidden />
              {t("etapeTransmise")}
            </span>
          )}
          {texteReponse && (
            <span className="inline-flex items-center gap-1 rounded-full bg-succes/10 px-2.5 py-1 text-[11.5px] font-semibold text-succes">
              <Check className="icone-etat size-3 animate-coche" strokeWidth={3} aria-hidden />
              {t("etapeRepondue")}
            </span>
          )}
          {annulee && <span className="text-[11.5px] font-semibold text-encre-pale">{t("etapeAnnulee")}</span>}
          <time className="shrink-0 text-[11.5px] tabular-nums text-encre-pale">
            {heureMessage(demande.creeLe, langue)}
          </time>
        </header>
        <p className="texte-textes-cartes mt-1.5 leading-snug text-textes-cartes">{question}</p>
      </div>

      {texteReponse && (
        // Couleurs du titre et du fond : --color-reponse-titre et --color-reponse-fond (globals.css)
        <section className="border-t border-reponse-titre/15 bg-reponse-fond px-4 pt-3 pb-3.5">
          {/* Même typographie que le titre « Votre commande » des cartes */}
          <p className="flex items-center gap-2 text-reponse-titre">
            <ConciergeBell className="size-[19px] shrink-0" strokeWidth={2.3} aria-hidden />
            <span className="texte-titres-cartes flex-1">{t("reponseReception")}</span>
            {reponse?.le && (
              <time className="text-[11.5px] font-medium tabular-nums text-encre-pale">
                {heureMessage(reponse.le, langue)}
              </time>
            )}
          </p>
          <p className="texte-textes-cartes mt-2.5 whitespace-pre-wrap leading-snug text-textes-cartes">
            {texteReponse}
          </p>
        </section>
      )}

      {demande.statut === "PROPOSEE" && (
        <PiedProposition
          libelle={t("confirmer")}
          decisionEnCours={decisionEnCours}
          expiree={expiree}
          decider={decider}
          t={t}
          compact
        />
      )}
    </article>
  );
}

/** « Confirmer » / « Annuler » d'une carte proposée, ou son expiration. */
function PiedProposition({
  libelle,
  decisionEnCours,
  expiree,
  decider,
  t,
  compact = false,
}: {
  libelle: string;
  decisionEnCours: Decision | null;
  expiree: boolean;
  decider: (decision: Decision) => void;
  t: TraduireClient;
  compact?: boolean;
}) {
  if (expiree) {
    return (
      <p
        className={`border-t border-ligne bg-creux/60 py-3.5 text-[13.5px] text-encre-douce ${compact ? "px-4" : "px-5"}`}
      >
        {t("propositionExpiree")}
      </p>
    );
  }
  return (
    <footer className={compact ? "space-y-0.5 px-4 pb-3" : "space-y-1 px-5 pb-4"}>
      <button
        type="button"
        disabled={decisionEnCours !== null}
        onClick={() => decider("confirmer")}
        className={`flex w-full items-center justify-center gap-2 texte-boutons rounded-2xl bg-bouton text-boutons shadow-[0_8px_20px_-10px_var(--color-bouton)] transition duration-200 active:scale-[0.98] disabled:opacity-70 ${
          compact ? "h-12" : "h-14"
        }`}
      >
        {decisionEnCours === "confirmer" ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Check className="size-5" strokeWidth={2.4} />
        )}
        {libelle}
      </button>
      <button
        type="button"
        disabled={decisionEnCours !== null}
        onClick={() => decider("annuler")}
        className={`w-full rounded-2xl font-medium text-encre-douce transition active:bg-creux disabled:opacity-50 ${
          compact ? "h-10 text-[14px]" : "h-11 text-[14.5px]"
        }`}
      >
        {t("annuler")}
      </button>
    </footer>
  );
}

/**
 * Suivi en deux temps : « Transmise », puis « Traitement » qui devient, selon la
 * décision de la réception, « Acceptée » (vert) ou « Annulée » (rouge clair). Les étapes se suffisent.
 */
function SuiviDemande({ demande, t }: { demande: DemandeVue; t: TraduireClient }) {
  const issue = demande.statut === "TERMINEE" ? "acceptee" : demande.declinee ? "annulee" : null;

  const pastille =
    issue === "annulee"
      ? "bg-alerte/15 text-alerte"
      : issue
        ? "bg-succes text-white"
        : "bg-surface ring-2 ring-accent/50";
  const libelle =
    issue === "annulee" ? t("etapeAnnulee") : issue === "acceptee" ? t("etapeAcceptee") : t("etapeTraitement");

  return (
    <footer
      className={`border-t px-5 py-3 transition-colors duration-500 ${
        issue === "annulee"
          ? "border-alerte/15 bg-alerte/[0.04]"
          : issue
            ? "border-succes/15 bg-succes/[0.05]"
            : "border-ligne bg-accent-pale/50"
      }`}
    >
      <ol className="flex items-start">
        <li className="flex flex-col items-center gap-1.5">
          <span className="grid size-6 place-items-center rounded-full bg-accent text-white">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
          <span className="text-[12.5px] font-semibold text-accent-profond">{t("etapeTransmise")}</span>
        </li>
        <li className="mx-2 mt-3 h-[2px] flex-1 overflow-hidden rounded-full bg-ligne" aria-hidden>
          <span
            className={`block h-full origin-left transition-transform duration-700 ease-out rtl:origin-right ${
              issue === "annulee" ? "bg-alerte/40" : "bg-succes"
            }`}
            style={{ transform: `scaleX(${issue ? 1 : 0})` }}
          />
        </li>
        <li className="flex flex-col items-center gap-1.5">
          <span className={`grid size-6 place-items-center rounded-full transition-colors duration-500 ${pastille}`}>
            {issue === "annulee" ? (
              <X className="icone-etat size-3.5 animate-coche" strokeWidth={3} />
            ) : issue ? (
              <Check className="size-3.5 animate-coche" strokeWidth={3} />
            ) : (
              <span className="size-2 animate-pulsation rounded-full bg-accent" />
            )}
          </span>
          <span
            className={`text-[12.5px] font-semibold ${
              issue === "annulee" ? "text-alerte" : issue ? "text-succes" : "text-encre-douce"
            }`}
          >
            {libelle}
          </span>
        </li>
      </ol>
    </footer>
  );
}
