"use client";

import { ArrowUpRight, Heart, Loader2, Star } from "lucide-react";
import { useState } from "react";
import type { TraduireClient } from "@/lib/i18n/client";
import type { LangueClient } from "@/lib/langues";

type Etape = "notation" | "commentaire" | "merciPositif" | "merciPrive" | "fermee";

type Proprietes = {
  jeton: string;
  langue: LangueClient;
  t: TraduireClient;
  departProche: boolean;
  // Version resserrée pour l'écran d'accueil (tout doit tenir sans défiler)
  compacte?: boolean;
};

// Note ≥ 4 : remerciement + invitation à l'avis public.
// Note ≤ 3 : message privé à la direction (alerte immédiate), l'avis public
// restant accessible discrètement — jamais masqué (pas de « review gating »).
export function CarteAvis({ jeton, langue, t, departProche, compacte = false }: Proprietes) {
  const [etape, setEtape] = useState<Etape>("notation");
  const [note, setNote] = useState(0);
  const [survol, setSurvol] = useState(0); // aperçu au survol (souris uniquement)
  const [commentaire, setCommentaire] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [avis, setAvis] = useState<{
    id: string;
    lienPublic: string | null;
  } | null>(null);

  async function enregistrer(noteChoisie: number, texte: string | null) {
    setEnvoiEnCours(true);
    try {
      const reponse = await fetch("/api/avis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "noter",
          jeton,
          note: noteChoisie,
          commentaire: texte,
          langue,
        }),
      });
      if (reponse.ok) setAvis(await reponse.json());
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function choisirNote(valeur: number) {
    setNote(valeur);
    if (valeur >= 4) {
      await enregistrer(valeur, null);
      setEtape("merciPositif");
    } else {
      setEtape("commentaire");
    }
  }

  function signalerOuverture() {
    if (!avis) return;
    navigator.sendBeacon?.(
      "/api/avis",
      new Blob([JSON.stringify({ action: "lienOuvert", jeton, avisId: avis.id })], { type: "application/json" }),
    );
  }

  if (etape === "fermee") return null;

  return (
    <article className="animate-montee overflow-hidden rounded-[26px] border border-ligne/80 bg-surface shadow-carte">
      {etape === "notation" && (
        <div className={compacte ? "px-4 pt-3.5 pb-2" : "px-5 py-6 text-center"}>
          <h3
            className={
              compacte ? "text-[15px] font-semibold leading-tight text-encre" : "texte-titres-cartes text-titres-cartes"
            }
          >
            {t("avisTitre")}
          </h3>
          {departProche && !compacte && (
            <p className="mx-auto mt-2 max-w-[30ch] text-[14px] text-encre-douce">{t("avisDepart")}</p>
          )}
          <div
            className={compacte ? "mt-1 flex justify-between" : "mt-5 flex justify-center gap-1.5"}
            role="radiogroup"
            aria-label={t("avisTitre")}
          >
            {[1, 2, 3, 4, 5].map((valeur) => (
              <button
                key={valeur}
                type="button"
                role="radio"
                aria-checked={note === valeur}
                aria-label={`${valeur}/5`}
                disabled={envoiEnCours}
                onClick={() => choisirNote(valeur)}
                onPointerEnter={(evenement) => evenement.pointerType === "mouse" && setSurvol(valeur)}
                onPointerLeave={() => setSurvol(0)}
                className={`grid place-items-center rounded-full transition active:scale-90 ${compacte ? "size-11" : "size-12"}`}
              >
                <Star
                  className={`transition-colors duration-150 ${compacte ? "size-[26px]" : "size-8"} ${
                    valeur <= (survol || note) ? "fill-accent text-accent" : "text-encre-pale/45"
                  }`}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {etape === "commentaire" && (
        <div className="px-5 py-5">
          <h3 className="texte-titres-cartes text-titres-cartes">{t("avisAmeliorer")}</h3>
          <textarea
            autoFocus
            value={commentaire}
            onChange={(evenement) => setCommentaire(evenement.target.value)}
            placeholder={t("avisPlaceholder")}
            rows={4}
            maxLength={2000}
            className="mt-4 w-full resize-none rounded-2xl border border-ligne bg-creux/60 px-4 py-3 text-[16px] leading-relaxed text-encre outline-none transition placeholder:text-encre-pale focus:border-accent focus:bg-surface"
          />
          <button
            type="button"
            disabled={envoiEnCours}
            onClick={async () => {
              await enregistrer(note, commentaire);
              setEtape("merciPrive");
            }}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl texte-boutons bg-bouton text-boutons transition active:scale-[0.98] disabled:opacity-70"
          >
            {envoiEnCours && <Loader2 className="size-5 animate-spin" />}
            {t("avisEnvoyer")}
          </button>
        </div>
      )}

      {etape === "merciPositif" && (
        <div className="px-5 py-6 text-center">
          <span className="mx-auto grid size-12 animate-coche place-items-center rounded-full bg-accent-pale text-accent">
            <Heart className="size-6 fill-current" />
          </span>
          <h3 className="texte-titres-cartes mt-4 text-titres-cartes">{t("avisMerci")}</h3>
          {avis?.lienPublic && (
            <>
              <p className="mx-auto mt-2 max-w-[32ch] text-[14px] leading-relaxed text-encre-douce">
                {t("avisPartagerDetail")}
              </p>
              <a
                href={avis.lienPublic}
                target="_blank"
                rel="noopener noreferrer"
                onClick={signalerOuverture}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl texte-boutons bg-bouton text-boutons transition active:scale-[0.98]"
              >
                {t("avisPartager")}
                <ArrowUpRight className="size-5" />
              </a>
            </>
          )}
          <button
            type="button"
            onClick={() => setEtape("fermee")}
            className="mt-1 h-11 w-full rounded-2xl text-[14.5px] font-medium text-encre-douce transition active:bg-creux"
          >
            {avis?.lienPublic ? t("avisPlusTard") : t("avisFermer")}
          </button>
        </div>
      )}

      {etape === "merciPrive" && (
        <div className="px-5 py-6">
          <p className="text-[15.5px] leading-relaxed text-encre">{t("avisRecu")}</p>
          {avis?.lienPublic && (
            <a
              href={avis.lienPublic}
              target="_blank"
              rel="noopener noreferrer"
              onClick={signalerOuverture}
              className="mt-4 inline-flex items-center gap-1 text-[13.5px] text-encre-pale underline decoration-ligne underline-offset-4"
            >
              {t("avisPublicDiscret")}
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>
      )}
    </article>
  );
}
