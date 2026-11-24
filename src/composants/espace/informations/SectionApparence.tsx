"use client";

// Couleurs générales de l'interface client, avec un aperçu en direct de ce que verra le client.
import { Info, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { FOND_PAR_DEFAUT, FONDS_SUGGERES, fondAssezClair, lisibleSurBlanc, variablesCouleurs } from "@/lib/couleurs";
import type { TraduireEquipe } from "@/lib/i18n/equipe";
import { Surligne, useSection } from "./SectionFormulaire";

export type CouleursHotel = {
  couleurAccent: string;
  couleurMessages: string | null; // null : teinte automatique
  couleurFond: string | null; // null : blanc cassé par défaut
  couleurHoraires: string | null; // null : couleur de l'hôtel, assombrie
  couleurIcones: string | null; // null : anthracite
  couleurMessagesClient: string | null; // null : teinte claire dérivée de la couleur des boutons
  couleurBoutons: string | null; // null : couleur de l'hôtel assombrie (client), encre (espace)
};

const PASTILLE =
  "h-9 w-14 shrink-0 cursor-pointer rounded-lg border border-ligne bg-fond px-0.5 disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-alerte";

export function SectionApparence({ couleurs, t }: { couleurs: CouleursHotel; t: TraduireEquipe }) {
  const { refuses } = useSection();
  const [accent, setAccent] = useState(couleurs.couleurAccent);
  const messages = useCouleur(couleurs.couleurMessages, "#e9dcc6");
  const messagesClient = useCouleur(couleurs.couleurMessagesClient, "#dcf3d0");
  const boutons = useCouleur(couleurs.couleurBoutons, "#1d4e89");
  const horaires = useCouleur(couleurs.couleurHoraires, "#1d4e89");
  const icones = useCouleur(couleurs.couleurIcones, "#1c2529");
  const [fond, setFond] = useState(couleurs.couleurFond ?? FOND_PAR_DEFAUT);
  const fondValide = fondAssezClair(fond) && !refuses.includes("couleurFond");
  const horairesValides = horaires.auto || (lisibleSurBlanc(horaires.couleur) && !refuses.includes("couleurHoraires"));
  const iconesValides = icones.auto || (lisibleSurBlanc(icones.couleur) && !refuses.includes("couleurIcones"));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <ul className="h-fit divide-y divide-ligne rounded-xl bg-creux/60 px-3">
        <Ligne libelle={t("couleurAccent")}>
          <input
            name="couleurAccent"
            type="color"
            value={accent}
            onChange={(evenement) => setAccent(evenement.target.value)}
            aria-label={t("couleurAccent")}
            className={PASTILLE}
          />
        </Ligne>
        <Ligne libelle={t("couleurBoutons")}>
          <ChoixCouleur nom="couleurBoutons" libelle={t("couleurBoutons")} etat={boutons} t={t} />
        </Ligne>
        <Ligne libelle={t("couleurMessages")}>
          <ChoixCouleur nom="couleurMessages" libelle={t("couleurMessages")} etat={messages} t={t} />
        </Ligne>
        <Ligne libelle={t("couleurMessagesClient")}>
          <ChoixCouleur nom="couleurMessagesClient" libelle={t("couleurMessagesClient")} etat={messagesClient} t={t} />
        </Ligne>
        <Ligne libelle={t("couleurHoraires")} erreur={horairesValides ? undefined : t("horairesTropClair")}>
          <ChoixCouleur
            nom="couleurHoraires"
            libelle={t("couleurHoraires")}
            etat={horaires}
            invalide={!horairesValides}
            t={t}
          />
        </Ligne>
        <Ligne libelle={t("couleurIcones")} erreur={iconesValides ? undefined : t("iconesTropClair")}>
          <ChoixCouleur
            nom="couleurIcones"
            libelle={t("couleurIcones")}
            etat={icones}
            invalide={!iconesValides}
            t={t}
          />
        </Ligne>
        <Ligne libelle={t("couleurFond")} erreur={fondValide ? undefined : t("fondTropSombre")} empile>
          <input type="hidden" name="couleurFond" value={fond} />
          <div className="flex flex-wrap items-center gap-2">
            {FONDS_SUGGERES.map(({ couleur, nom }) => (
              <button
                key={couleur}
                type="button"
                onClick={() => setFond(couleur)}
                aria-pressed={fond === couleur}
                aria-label={t(`fond_${nom}` as const)}
                title={t(`fond_${nom}` as const)}
                style={{ backgroundColor: couleur }}
                className={`size-9 rounded-full border transition active:scale-95 ${
                  fond === couleur ? "border-encre ring-2 ring-encre ring-offset-2" : "border-ligne"
                }`}
              />
            ))}
            <label className="texte-libelles-equipe ms-1 flex cursor-pointer items-center gap-2 text-libelles-equipe">
              <input
                type="color"
                value={fond}
                onChange={(evenement) => setFond(evenement.target.value)}
                aria-invalid={!fondValide || undefined}
                className="h-9 w-12 cursor-pointer rounded-xl border border-ligne bg-fond px-1 aria-invalid:border-alerte"
              />
              {t("autreCouleur")}
            </label>
          </div>
        </Ligne>
      </ul>

      {/* Aperçu : ce que verra le client, avant même d'enregistrer */}
      <div
        aria-hidden
        style={variablesCouleurs({
          couleurAccent: accent,
          couleurMessages: messages.valeur,
          couleurMessagesClient: messagesClient.valeur,
          couleurFond: fond,
          couleurHoraires: horaires.valeur,
          couleurBoutons: boutons.valeur,
          couleurIcones: icones.valeur,
        })}
        className="order-first h-fit space-y-2 rounded-2xl border border-ligne bg-fond p-4 lg:sticky lg:top-40 lg:order-none"
      >
        <p className="texte-sections-equipe uppercase text-sections-equipe">{t("apercu")}</p>
        {/* Les rubriques de l'accueil, avec la couleur des icônes */}
        <div className="grid grid-cols-2 gap-2 pb-1">
          {(
            [
              ["apercuTuile1", UtensilsCrossed],
              ["apercuTuile2", Info],
            ] as const
          ).map(([cle, Icone]) => (
            <span key={cle} className="flex flex-col items-center gap-1.5">
              <span className="grid size-12 place-items-center rounded-[14px] border border-ligne/60 bg-surface text-[var(--icones-hotel,#000)] shadow-carte">
                <Icone className="size-5" strokeWidth={2.2} />
              </span>
              <span className="text-[12px] font-bold text-encre">{t(cle)}</span>
            </span>
          ))}
        </div>
        <p className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-[13px] font-semibold text-black shadow-carte">
          {t("apercuTuile1")}
          <span className="font-extrabold tabular-nums text-horaires">11h – 23h</span>
        </p>
        <p className="w-fit max-w-[85%] rounded-[18px] rounded-ss-[4px] bg-bulle px-3 py-2 text-[14px] text-texte-bulle">
          {t("apercuMessageLalla")}
        </p>
        <p className="ms-auto w-fit max-w-[85%] rounded-[18px] rounded-se-[4px] bg-bulle-client px-3 py-2 text-[14px] text-texte-bulle-client shadow-[0_1px_0.5px_rgb(26_27_23/0.1)]">
          {t("apercuMessageClient")}
        </p>
        <span className="mt-1 flex h-10 items-center justify-center rounded-xl bg-bouton text-[14px] font-semibold text-texte-bouton">
          {t("apercuBouton")}
        </span>
      </div>
    </div>
  );
}

/** Une ligne de réglage : le libellé à gauche, la commande à droite (ou dessous). */
function Ligne({
  libelle,
  erreur,
  empile,
  children,
}: {
  libelle: string;
  erreur?: string;
  empile?: boolean;
  children: React.ReactNode;
}) {
  const { requete } = useSection();
  return (
    <li className="py-2.5">
      <div className={`flex gap-x-3 gap-y-2.5 ${empile ? "flex-col" : "items-center"}`}>
        <span className="texte-courant-equipe min-w-0 flex-1 text-courant-equipe">
          <Surligne texte={libelle} requete={requete} />
        </span>
        {children}
      </div>
      {erreur && <p className="texte-courant-equipe mt-1.5 text-alerte">{erreur}</p>}
    </li>
  );
}

/** Couleur choisie, ou « Automatique » (null : couleur par défaut). */
function useCouleur(initiale: string | null, suggestion: string) {
  const [auto, setAuto] = useState(initiale === null);
  const [couleur, setCouleur] = useState(initiale ?? suggestion);
  return { auto, setAuto, couleur, setCouleur, valeur: auto ? null : couleur };
}

function ChoixCouleur({
  nom,
  libelle,
  etat,
  invalide,
  t,
}: {
  nom: string;
  libelle: string;
  etat: ReturnType<typeof useCouleur>;
  invalide?: boolean;
  t: TraduireEquipe;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[13px] text-encre-douce">
        <input
          name={`${nom}Auto`}
          type="checkbox"
          checked={etat.auto}
          onChange={(evenement) => etat.setAuto(evenement.target.checked)}
          className="size-4 accent-encre"
        />
        {t("automatique")}
      </label>
      <input
        name={nom}
        type="color"
        value={etat.couleur}
        disabled={etat.auto}
        onChange={(evenement) => etat.setCouleur(evenement.target.value)}
        aria-label={libelle}
        aria-invalid={invalide || undefined}
        className={PASTILLE}
      />
    </div>
  );
}
