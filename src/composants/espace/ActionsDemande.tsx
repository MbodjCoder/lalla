"use client";

// Décisions de l'équipe, réduites à l'essentiel :
//
//   Commande ou demande : ✕ · Accepter      (Lalla explique l'annulation au client)
//   Question            : Répondre            (Lalla traduit la réponse et la transmet)
//
// L'annulation se confirme d'un second geste, le temps d'un compte à rebours : sans
// confirmation, elle se referme d'elle-même. Chaque bouton se verrouille pendant l'envoi.
// Utilisé dans la liste « Aujourd'hui » (« compact ») et sur la page du lien WhatsApp (« grand »).
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { TypeDemandeVue } from "@/lib/types";

export type LibellesActions = {
  accepter: string;
  annuler: string;
  repondre: string;
  envoyer: string;
  retour: string;
  confirmerAnnulation: string;
  questionAnnulation: string; // « Annuler cette demande ? Lalla en informera le client. »
  placeholderReponse: string;
  aideReponse: string; // « Lalla transmet votre réponse au client, traduite en anglais. »
};

type ActionServeur = (formulaire: FormData) => Promise<void>;

type Proprietes = {
  demandeId: string;
  type: TypeDemandeVue;
  libelles: LibellesActions;
  actionDecision: ActionServeur; // accepter, annuler
  actionReponse: ActionServeur; // répondre à une question
  taille?: "compact" | "grand";
  className?: string; // conteneur au repos
  classeOuvert?: string; // conteneur pendant la saisie d'une réponse
};

// Durée de la confirmation d'annulation (même valeur que l'animation « decompte » de globals.css)
const DUREE_CONFIRMATION_MS = 6000;

/** Bouton d'envoi d'un formulaire : indicateur de chargement, aucun double envoi. */
export function BoutonEnvoi({
  className,
  name,
  value,
  title,
  children,
}: {
  className: string;
  name?: string;
  value?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      title={title}
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ActionsDemande({
  demandeId,
  type,
  libelles,
  actionDecision,
  actionReponse,
  taille = "compact",
  className = "",
  classeOuvert = "",
}: Proprietes) {
  const [mode, setMode] = useState<"repos" | "repondre" | "annuler">("repos");
  const grand = taille === "grand";

  // Confirmation d'annulation temporaire : sans réponse, retour à l'état de repos
  useEffect(() => {
    if (mode !== "annuler") return;
    const minuterie = setTimeout(() => setMode("repos"), DUREE_CONFIRMATION_MS);
    return () => clearTimeout(minuterie);
  }, [mode]);

  const base = `flex items-center justify-center gap-2 whitespace-nowrap rounded-xl texte-boutons-equipe transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${
    grand ? "h-14 w-full" : "h-9 px-3.5"
  }`;
  const principal = `${base} bg-bouton text-texte-bouton hover:bg-bouton/90`;
  const secondaire = `${base} border border-ligne bg-surface text-encre hover:bg-creux`;
  const discret = `${base} text-encre-douce hover:bg-creux hover:text-encre`;
  const rangee = grand ? "flex flex-col gap-2.5" : "flex items-center justify-end gap-3";
  const champ = `w-full resize-none rounded-xl border border-ligne bg-fond px-3.5 py-2.5 leading-snug texte-champs-equipe text-champs-equipe outline-none transition placeholder:text-encre-pale focus:border-encre/40 focus:bg-surface`;

  // Question : une seule action, répondre
  if (type === "QUESTION") {
    if (mode !== "repondre") {
      return (
        <div className={`${rangee} ${className}`}>
          <button type="button" onClick={() => setMode("repondre")} className={principal}>
            {libelles.repondre}
          </button>
        </div>
      );
    }
    return (
      <form action={actionReponse} className={`space-y-2 ${className} ${classeOuvert}`}>
        <input type="hidden" name="demandeId" value={demandeId} />
        <textarea
          name="message"
          required
          maxLength={1000}
          rows={3}
          autoFocus
          placeholder={libelles.placeholderReponse}
          className={champ}
        />
        <div className="flex flex-wrap items-center gap-3">
          <p className="texte-details-equipe min-w-0 flex-1 leading-snug text-details-equipe">{libelles.aideReponse}</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMode("repos")} className={discret}>
              {libelles.retour}
            </button>
            <BoutonEnvoi className={principal}>{libelles.envoyer}</BoutonEnvoi>
          </div>
        </div>
      </form>
    );
  }

  // Commande ou demande : accepter, ou annuler (confirmé d'un second geste, le temps du compte à rebours)
  return (
    <form action={actionDecision} className={`relative ${grand ? "space-y-2" : ""} ${className}`}>
      <input type="hidden" name="demandeId" value={demandeId} />
      {mode === "annuler" && grand && (
        <p className="texte-courant-equipe  text-alerte">{libelles.questionAnnulation}</p>
      )}
      <div className={rangee}>
        {mode === "annuler" ? (
          // « Retour » prend la place de la croix : un double appui ne confirme jamais par erreur
          <>
            <button type="button" onClick={() => setMode("repos")} className={grand ? secondaire : discret}>
              {libelles.retour}
            </button>
            <BoutonEnvoi
              name="decision"
              value="annuler"
              title={libelles.questionAnnulation}
              className={`${base} bg-alerte text-white hover:bg-alerte/90`}
            >
              {libelles.confirmerAnnulation}
            </BoutonEnvoi>
          </>
        ) : grand ? (
          <>
            <BoutonEnvoi name="decision" value="accepter" className={principal}>
              {libelles.accepter}
            </BoutonEnvoi>
            <button type="button" onClick={() => setMode("annuler")} className={secondaire}>
              {libelles.annuler}
            </button>
          </>
        ) : (
          // Liste : la croix d'annulation d'abord, puis la décision principale
          <>
            <button
              type="button"
              onClick={() => setMode("annuler")}
              aria-label={libelles.annuler}
              title={libelles.annuler}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-ligne bg-surface text-encre-douce transition hover:border-alerte/40 hover:bg-alerte/[0.06] hover:text-alerte active:scale-95"
            >
              <X className="size-[17px]" strokeWidth={2.2} />
            </button>
            <BoutonEnvoi name="decision" value="accepter" className={principal}>
              {libelles.accepter}
            </BoutonEnvoi>
          </>
        )}
      </div>
      {mode === "annuler" && (
        <span
          aria-hidden
          className={`block h-0.5 origin-left animate-decompte rounded-full bg-alerte/45 rtl:origin-right ${
            grand ? "" : "absolute inset-x-0 -bottom-2"
          }`}
        />
      )}
    </form>
  );
}
