"use client";

import { CalendarDays, Clock3, Loader2, Minus, Plus, SendHorizontal, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { formaterPrix } from "@/lib/format";
import { heureHotel, jourHotel } from "@/lib/horaires-service";
import type { CleTexteClient, TraduireClient } from "@/lib/i18n/client";
import type { LangueClient } from "@/lib/langues";
import { textesEchec } from "./textes-demande";
import type { ResultatDemandeDirecte } from "./useConversation";
import { Vignette } from "./Vignette";

/** Ce que le formulaire demande ; un champ absent n'est pas affiché. */
export type ChampsFormulaire = {
  jour?: "aujourdhui" | "demain"; // jour proposé par défaut
  heure?: string; // heure proposée (« 07:00 »), ou « bientot » : dans une demi-heure au moins
  personnes?: boolean;
  precision?: CleTexteClient; // champ libre facultatif (destination, numéro de vol…)
};

export type ValeursFormulaire = { jour?: string; heure?: string; personnes: number; precision: string };

const JOUR_MS = 24 * 3600 * 1000;
const PERSONNES_MAX = 20;
const deuxChiffres = (n: number) => String(n).padStart(2, "0");

/** Prochaine demi-heure, au moins trente minutes après maintenant (demain matin si la nuit est avancée). */
function bientot(fuseau: string): { jour: string; heure: string } {
  const [heures, minutes] = heureHotel(fuseau).split(":").map(Number);
  const total = Math.ceil((heures * 60 + minutes + 30) / 30) * 30;
  if (total >= 24 * 60) return { jour: jourHotel(fuseau, new Date(Date.now() + JOUR_MS)), heure: "08:00" };
  return { jour: jourHotel(fuseau), heure: `${deuxChiffres(Math.floor(total / 60))}:${deuxChiffres(total % 60)}` };
}

type Proprietes = {
  champs: ChampsFormulaire;
  entete: React.ReactNode;
  fuseau: string;
  langue: LangueClient;
  t: TraduireClient;
  libelleEnvoyer: string;
  prixUnitaire?: number; // réservation payante : le total suit le nombre de personnes
  devise?: string;
  onEnvoyer: (valeurs: ValeursFormulaire) => Promise<ResultatDemandeDirecte>;
  onRetour: () => void;
};

// Étape intermédiaire d'une réservation ou d'un service précisé : le jour, l'heure, le nombre de
// personnes, puis un seul bouton qui envoie directement à l'équipe (sans passer par Lalla).
// Des valeurs sont proposées d'emblée : le plus souvent, il suffit d'appuyer sur « Envoyer ».
export function FormulaireDemande({
  champs,
  entete,
  fuseau,
  langue,
  t,
  libelleEnvoyer,
  prixUnitaire,
  devise,
  onEnvoyer,
  onRetour,
}: Proprietes) {
  const aujourdhui = jourHotel(fuseau);
  const demain = jourHotel(fuseau, new Date(Date.now() + JOUR_MS));
  const [valeurs, setValeurs] = useState<ValeursFormulaire>(() => {
    const prochaine = bientot(fuseau);
    const heure = champs.heure === "bientot" ? prochaine.heure : champs.heure;
    const jour = !champs.jour
      ? undefined
      : champs.jour === "demain"
        ? demain
        : champs.heure === "bientot"
          ? prochaine.jour
          : aujourdhui;
    return { jour, heure, personnes: 1, precision: "" };
  });
  const [autreDate, setAutreDate] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);

  const changer = (modification: Partial<ValeursFormulaire>) => {
    setErreurs([]);
    setValeurs((actuelles) => ({ ...actuelles, ...modification }));
  };
  const complet = (!champs.jour || Boolean(valeurs.jour)) && (!champs.heure || Boolean(valeurs.heure));
  const total =
    prixUnitaire !== undefined && devise ? formaterPrix(prixUnitaire * valeurs.personnes, devise, langue) : null;

  async function envoyer() {
    if (envoiEnCours || !complet) return;
    setEnvoiEnCours(true);
    setErreurs([]);
    const resultat = await onEnvoyer(valeurs);
    setEnvoiEnCours(false);
    if (!resultat.ok) setErreurs(textesEchec(resultat, langue, t));
  }

  const puce = (actif: boolean) =>
    `h-11 rounded-full px-4 text-[15px] transition active:scale-95 ${
      actif
        ? "bg-bouton font-bold text-texte-bouton shadow-carte"
        : "border border-ligne bg-surface font-semibold text-encre-douce"
    }`;

  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pt-1 pb-6">
        {entete}

        {champs.jour && (
          <Champ icone={CalendarDays} titre={t("jour")}>
            <div className="flex flex-wrap gap-2">
              {[
                { jour: aujourdhui, libelle: t("aujourdhui") },
                { jour: demain, libelle: t("demain") },
              ].map(({ jour, libelle }) => (
                <button
                  key={jour}
                  type="button"
                  aria-pressed={!autreDate && valeurs.jour === jour}
                  onClick={() => {
                    setAutreDate(false);
                    changer({ jour });
                  }}
                  className={puce(!autreDate && valeurs.jour === jour)}
                >
                  {libelle}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={autreDate}
                onClick={() => setAutreDate(true)}
                className={puce(autreDate)}
              >
                {t("autreDate")}
              </button>
            </div>
            {autreDate && (
              <input
                type="date"
                min={aujourdhui}
                value={valeurs.jour ?? ""}
                onChange={(evenement) => changer({ jour: evenement.target.value || undefined })}
                aria-label={t("autreDate")}
                className="mt-3 h-14 w-full rounded-2xl border border-ligne bg-surface px-4 text-[17px] font-semibold text-encre outline-none focus:border-bouton/50"
              />
            )}
          </Champ>
        )}

        {champs.heure && (
          <Champ icone={Clock3} titre={t("heure")}>
            <input
              type="time"
              step={300}
              value={valeurs.heure ?? ""}
              onChange={(evenement) => changer({ heure: evenement.target.value || undefined })}
              aria-label={t("heure")}
              className="h-14 w-full rounded-2xl border border-ligne bg-surface px-4 text-[20px] font-semibold tabular-nums text-encre outline-none focus:border-bouton/50"
            />
          </Champ>
        )}

        {champs.personnes && (
          <Champ icone={Users} titre={t("personnes")}>
            <div className="flex h-14 items-center justify-between rounded-2xl border border-ligne bg-surface px-2">
              <button
                type="button"
                onClick={() => changer({ personnes: Math.max(1, valeurs.personnes - 1) })}
                disabled={valeurs.personnes <= 1}
                aria-label={t("retirer")}
                className="grid size-10 place-items-center rounded-full text-encre transition active:scale-90 disabled:text-encre-pale"
              >
                <Minus className="size-5" strokeWidth={2.4} />
              </button>
              <span aria-live="polite" className="text-[20px] font-bold tabular-nums text-encre">
                {valeurs.personnes}
              </span>
              <button
                type="button"
                onClick={() => changer({ personnes: Math.min(PERSONNES_MAX, valeurs.personnes + 1) })}
                aria-label={t("ajouter")}
                className="grid size-10 place-items-center rounded-full bg-bouton text-texte-bouton transition active:scale-90"
              >
                <Plus className="size-5" strokeWidth={2.4} />
              </button>
            </div>
          </Champ>
        )}

        {champs.precision && (
          <input
            type="text"
            maxLength={200}
            value={valeurs.precision}
            onChange={(evenement) => changer({ precision: evenement.target.value })}
            placeholder={t(champs.precision)}
            aria-label={t(champs.precision)}
            className="h-14 w-full rounded-2xl border border-ligne bg-surface px-4 text-[16px] text-encre outline-none placeholder:text-encre-pale focus:border-bouton/50"
          />
        )}

        {erreurs.length > 0 && (
          <ul role="alert" className="space-y-1.5">
            {erreurs.map((texte) => (
              <li
                key={texte}
                className="rounded-xl bg-attention-fond px-3.5 py-3 text-[14.5px] leading-snug text-attention"
              >
                {texte}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="marge-securite-bas shrink-0 space-y-1 border-t border-ligne/70 bg-fond px-5 pt-3">
        {/* Réservation payante : le total, sur sa propre ligne, au-dessus du bouton */}
        {total && (
          <p className="flex items-baseline justify-between px-1 pb-2">
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-encre-pale">{t("total")}</span>
            <span className="texte-prix texte-total tabular-nums text-prix">{total}</span>
          </p>
        )}
        <button
          type="button"
          onClick={envoyer}
          disabled={envoiEnCours || !complet}
          className="flex h-14 w-full items-center justify-center gap-2.5 texte-boutons rounded-2xl bg-bouton px-5 text-boutons shadow-carte transition active:scale-[0.98] disabled:opacity-60"
        >
          {envoiEnCours ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <SendHorizontal className="size-5 rtl:-scale-x-100" strokeWidth={2.2} aria-hidden />
          )}
          <span className="truncate">{libelleEnvoyer}</span>
        </button>
        <button
          type="button"
          onClick={onRetour}
          disabled={envoiEnCours}
          className="h-12 w-full rounded-2xl text-[15px] font-semibold text-encre-douce transition active:bg-creux disabled:opacity-50"
        >
          {t("retour")}
        </button>
      </div>
    </>
  );
}

function Champ({ icone: Icone, titre, children }: { icone: LucideIcon; titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="texte-sections mb-2.5 flex items-center gap-2 uppercase text-sections">
        <Icone className="size-4" strokeWidth={2.2} aria-hidden />
        {titre}
      </h4>
      {children}
    </section>
  );
}

/** En-tête du formulaire : la photo de l'activité, ou l'icône du service, et ce qui est demandé. */
export function EnteteFormulaire({
  titre,
  sousTitre,
  photo,
  icone: Icone,
}: {
  titre: string;
  sousTitre?: string | null;
  photo?: string | null;
  icone: LucideIcon;
}) {
  if (photo !== undefined) {
    return (
      <div>
        <Vignette photo={photo} icone={Icone} className="aspect-[2/1] w-full rounded-[22px]" />
        <p className="texte-titres mt-4 text-titres">{titre}</p>
        {sousTitre && <p className="texte-secondaires mt-1 text-secondaires">{sousTitre}</p>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 rounded-[22px] border border-ligne/80 bg-surface p-4 shadow-carte">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-bouton/10 text-bouton" aria-hidden>
        <Icone className="size-6" strokeWidth={2.3} />
      </span>
      <div className="min-w-0">
        <p className="texte-intitules text-intitules">{titre}</p>
        {sousTitre && <p className="texte-secondaires mt-0.5 text-secondaires">{sousTitre}</p>}
      </div>
    </div>
  );
}
