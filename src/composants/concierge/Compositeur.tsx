"use client";

import { LoaderCircle, Mic, SendHorizontal, Square } from "lucide-react";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CleTexteClient, TraduireClient } from "@/lib/i18n/client";
import type { LangueClient } from "@/lib/langues";
import { demarrerEnregistrement, enregistrementPossible, type Enregistrement } from "./enregistreur";

/** Commandes exposées au parent : « Autre demande » ouvre directement le champ. */
export type CommandesCompositeur = { ecrireDemande: () => void };

type Proprietes = {
  ref?: React.Ref<CommandesCompositeur>;
  jeton: string;
  t: TraduireClient;
  langue: LangueClient;
  desactive: boolean;
  onEnvoyer: (texte: string) => void;
  onSaisie?: () => void; // le client s'apprête à écrire : préchauffage du serveur
};

const HAUTEUR_MAX = 132; // ~5 lignes, au-delà le champ défile
const DUREE_VOCAL_MAX_MS = 45_000; // au-delà, l'enregistrement s'arrête de lui-même
const DUREE_ALERTE_MS = 5_000;

// Message vocal : enregistré puis transcrit par le serveur (tous les téléphones, toutes les
// langues). À défaut (micro inaccessible à l'enregistrement, serveur sans transcription),
// la dictée du navigateur prend le relais.
type ModeVocal = "serveur" | "navigateur";
type EtatVocal = "repos" | "ecoute" | "transcription";

// Langues reconnues par la dictée des navigateurs ; le wolof ne l'est pas encore
const LOCALES_DICTEE: Partial<Record<LangueClient, string>> = {
  fr: "fr-FR",
  en: "en-GB",
  es: "es-ES",
  it: "it-IT",
  de: "de-DE",
  pt: "pt-PT",
  ar: "ar-SA",
};

// API Web Speech : absente des types DOM standards, préfixée sur Safari et Chrome
type ResultatDictee = { 0: { transcript: string }; isFinal: boolean };
type ReconnaissanceVocale = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((evenement: { results: ArrayLike<ResultatDictee> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((evenement: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
type ConstructeurReconnaissance = new () => ReconnaissanceVocale;

function constructeurDictee(): ConstructeurReconnaissance | null {
  const fenetre = window as unknown as {
    SpeechRecognition?: ConstructeurReconnaissance;
    webkitSpeechRecognition?: ConstructeurReconnaissance;
  };
  return fenetre.SpeechRecognition ?? fenetre.webkitSpeechRecognition ?? null;
}

export function Compositeur({ ref, jeton, t, langue, desactive, onEnvoyer, onSaisie }: Proprietes) {
  const [texte, setTexte] = useState("");
  const [demandeLibre, setDemandeLibre] = useState(false); // invite « Décrivez votre demande »
  const [modeVocal, setModeVocal] = useState<ModeVocal | null>(null);
  const [etatVocal, setEtatVocal] = useState<EtatVocal>("repos");
  const [alerte, setAlerte] = useState<CleTexteClient | null>(null);
  const [toucheEntreeEnvoie, setToucheEntreeEnvoie] = useState(true);
  const champ = useRef<HTMLTextAreaElement>(null);
  const reconnaissance = useRef<ReconnaissanceVocale | null>(null);
  const enregistrement = useRef<Enregistrement | null>(null);
  const minuterieVocal = useRef<ReturnType<typeof setTimeout>>(undefined);
  const envoyable = texte.trim().length > 0 && !desactive && etatVocal === "repos";
  const localeDictee = LOCALES_DICTEE[langue];
  const dicteeNavigateur = () => Boolean(localeDictee && constructeurDictee());

  // Détection côté client uniquement : évite un écart avec le rendu serveur
  useEffect(() => {
    setModeVocal(enregistrementPossible() ? "serveur" : localeDictee && constructeurDictee() ? "navigateur" : null);
  }, [localeDictee]);

  // Sur écran tactile, Entrée sert à aller à la ligne ; on envoie avec le bouton
  useEffect(() => {
    setToucheEntreeEnvoie(!window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Une alerte s'efface d'elle-même
  useEffect(() => {
    if (!alerte) return;
    const minuterie = setTimeout(() => setAlerte(null), DUREE_ALERTE_MS);
    return () => clearTimeout(minuterie);
  }, [alerte]);

  // Appelé pendant le geste du client : le clavier s'ouvre aussi sur iPhone
  useImperativeHandle(ref, () => ({
    ecrireDemande() {
      setDemandeLibre(true);
      champ.current?.focus();
    },
  }));

  // Changer de langue ou quitter l'écran coupe le vocal en cours
  useEffect(
    () => () => {
      reconnaissance.current?.stop();
      enregistrement.current?.annuler();
      enregistrement.current = null;
      clearTimeout(minuterieVocal.current);
    },
    [langue],
  );

  // Hauteur ajustée au contenu
  useLayoutEffect(() => {
    const element = champ.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, HAUTEUR_MAX)}px`;
  }, [texte]);

  // Le texte dicté complète ce qui est déjà écrit, sans l'effacer
  const completer = (ajout: string) => setTexte((actuel) => (actuel.trim() ? `${actuel.trim()} ${ajout}` : ajout));

  function basculerVocal() {
    if (etatVocal === "transcription") return;
    if (modeVocal === "serveur") void basculerEnregistrement();
    else basculerDictee();
  }

  async function basculerEnregistrement() {
    if (etatVocal === "ecoute") return void terminerEnregistrement();
    setAlerte(null);
    try {
      enregistrement.current = await demarrerEnregistrement();
    } catch {
      // Micro refusé ou occupé : la dictée du navigateur si elle existe, sinon l'écrit
      if (dicteeNavigateur()) {
        setModeVocal("navigateur");
        basculerDictee();
      } else setAlerte("microIndisponible");
      return;
    }
    setEtatVocal("ecoute");
    minuterieVocal.current = setTimeout(() => void terminerEnregistrement(), DUREE_VOCAL_MAX_MS);
  }

  async function terminerEnregistrement() {
    clearTimeout(minuterieVocal.current);
    const enCours = enregistrement.current;
    enregistrement.current = null;
    if (!enCours) return;
    setEtatVocal("transcription");
    try {
      const audio = await enCours.arreter();
      if (!audio) return; // appui trop bref
      const reponse = await fetch("/api/dictee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, langue, audio }),
      });
      // Transcription indisponible côté serveur : la dictée du navigateur, la prochaine fois
      if (reponse.status === 503 && dicteeNavigateur()) setModeVocal("navigateur");
      const { texte: transcription } = reponse.ok ? ((await reponse.json()) as { texte?: string }) : {};
      if (transcription?.trim()) completer(transcription.trim());
      else setAlerte("dicteeIncomprise");
    } catch {
      setAlerte("dicteeIncomprise");
    } finally {
      setEtatVocal("repos");
    }
  }

  function basculerDictee() {
    if (etatVocal === "ecoute") {
      reconnaissance.current?.stop();
      return;
    }
    const Constructeur = constructeurDictee();
    if (!Constructeur || !localeDictee) return;

    // La dictée complète ce qui est déjà écrit, sans l'effacer
    const debut = texte.trim() ? `${texte.trim()} ` : "";
    const session = new Constructeur();
    session.lang = localeDictee;
    session.interimResults = true;
    session.continuous = false;
    session.onresult = ({ results }) => {
      const transcription = Array.from(results, (resultat) => resultat[0].transcript).join("");
      setTexte(debut + transcription);
    };
    session.onend = () => setEtatVocal("repos");
    session.onerror = ({ error }) => {
      setEtatVocal("repos");
      if (error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture") {
        setAlerte("microIndisponible");
      } else if (error !== "aborted") setAlerte("dicteeIncomprise");
    };
    reconnaissance.current = session;
    try {
      session.start();
      setEtatVocal("ecoute");
    } catch {
      setAlerte("microIndisponible");
    }
  }

  function soumettre() {
    if (!envoyable) return;
    reconnaissance.current?.stop();
    onEnvoyer(texte.trim());
    setTexte("");
    setDemandeLibre(false);
  }

  // Comme WhatsApp : micro tant que le champ est vide, envoi dès qu'il y a du texte.
  // Pendant l'écoute et la transcription, le bouton du vocal reste en place.
  const modeDictee = modeVocal !== null && (!texte.trim() || etatVocal !== "repos");
  const ecoute = etatVocal === "ecoute";

  // Fondu vers le haut. Il s'arrête sur le fond à 1 % d'opacité, pas à 0 % :
  // Safari convertit 0 % en noir transparent et dessine alors une bande grise.
  return (
    <div className="marge-saisie sticky bottom-0 z-10 bg-linear-to-t from-fond via-fond to-fond/1 pt-3">
      <form
        onSubmit={(evenement) => {
          evenement.preventDefault();
          soumettre();
        }}
        className="mx-auto max-w-xl px-4"
      >
        {alerte && (
          <p
            role="status"
            className="mb-2 rounded-2xl bg-surface px-4 py-2 text-[13px] leading-snug text-encre shadow-carte"
          >
            {t(alerte)}
          </p>
        )}
        <div className="flex min-h-[52px] items-end rounded-[26px] bg-surface shadow-[0_1px_3px_rgb(26_27_23/0.1),0_0_0_1px_rgb(26_27_23/0.03)]">
          <textarea
            ref={champ}
            rows={1}
            value={texte}
            onFocus={onSaisie}
            onChange={(evenement) => {
              setTexte(evenement.target.value);
              onSaisie?.();
            }}
            onKeyDown={(evenement) => {
              // Entrée envoie sur ordinateur, va à la ligne sur téléphone
              if (
                toucheEntreeEnvoie &&
                evenement.key === "Enter" &&
                !evenement.shiftKey &&
                !evenement.nativeEvent.isComposing
              ) {
                evenement.preventDefault();
                soumettre();
              }
            }}
            onBlur={() => !texte.trim() && setDemandeLibre(false)}
            placeholder={t(
              etatVocal === "transcription"
                ? "transcriptionEnCours"
                : demandeLibre
                  ? "placeholderDemande"
                  : "placeholder",
            )}
            maxLength={1000}
            aria-label={t("placeholder")}
            className="block max-h-[132px] min-w-0 flex-1 resize-none bg-transparent py-[14px] ps-5 pe-1 text-[16px] leading-[1.5] text-black outline-none placeholder:text-encre-pale"
          />

          {modeDictee ? (
            <button
              type="button"
              onClick={basculerVocal}
              disabled={etatVocal === "transcription"}
              aria-label={t(
                etatVocal === "transcription" ? "transcriptionEnCours" : ecoute ? "arreterDictee" : "dicter",
              )}
              aria-pressed={ecoute}
              className={`relative me-1 mb-1 grid size-11 shrink-0 place-items-center rounded-full transition active:scale-90 ${
                ecoute ? "bg-alerte text-white" : "text-encre hover:bg-creux"
              }`}
            >
              {ecoute && <span className="absolute inset-0 animate-ping rounded-full bg-alerte/30" aria-hidden />}
              {etatVocal === "transcription" ? (
                <LoaderCircle className="size-[22px] animate-spin" strokeWidth={2} />
              ) : ecoute ? (
                <Square className="relative size-4 fill-current" strokeWidth={0} />
              ) : (
                <Mic className="size-[22px]" strokeWidth={2} />
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!envoyable}
              aria-label={t("envoyer")}
              className="me-1 mb-1 grid size-11 shrink-0 place-items-center rounded-full text-accent-profond transition active:scale-90 disabled:text-encre-pale"
            >
              <SendHorizontal className="size-[22px] rtl:-scale-x-100" strokeWidth={2} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
