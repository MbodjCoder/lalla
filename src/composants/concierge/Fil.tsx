"use client";

import { ConciergeBell, RotateCcw } from "lucide-react";
import { Fragment } from "react";
import { cleJour, heureMessage, libelleJour } from "@/lib/format";
import type { TraduireClient } from "@/lib/i18n/client";
import type { LangueClient } from "@/lib/langues";
import type { ElementFil } from "@/lib/types";
import { AvatarConcierge } from "./AvatarConcierge";
import { Bulle, PointsSaisie } from "./Bulle";
import { CarteAvis } from "./CarteAvis";
import { CarteDemande } from "./CarteDemande";
import { avecNomAssistant } from "./NomAssistant";
import { TexteRiche } from "./TexteRiche";

type Proprietes = {
  elements: ElementFil[];
  attenteReponse: boolean;
  traductionEnCours: boolean;
  jeton: string;
  devise: string;
  fuseau: string;
  telephoneReception: string | null;
  nomAssistant: string;
  departProche: boolean;
  carteSurlignee: string | null; // carte ouverte depuis les notifications, éclairée un instant
  langue: LangueClient;
  t: TraduireClient;
  onDeciderDemande: (id: string, decision: "confirmer" | "annuler") => Promise<boolean>;
  onReessayer: (idErreur: string, message: string) => void;
};

const TAILLE_AVATAR = 30;

const coteDe = (element: ElementFil) => (element.genre === "client" ? "client" : "assistant");

// Côté Lalla : son portrait ouvre chaque série de messages, les suivants s'alignent dessous.
// Les bulles laissent un retrait à droite ; les cartes (commande, avis) prennent toute la largeur.
function LigneAssistant({
  avatar,
  carte = false,
  children,
}: {
  avatar: boolean;
  carte?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-2 ${carte ? "" : "pe-[14%]"}`}>
      {avatar ? (
        <AvatarConcierge taille={TAILLE_AVATAR} />
      ) : (
        <span className="shrink-0" style={{ width: TAILLE_AVATAR }} />
      )}
      <div className="flex min-w-0 flex-1 flex-col items-start">{children}</div>
    </div>
  );
}

// Fil de discussion à la manière de WhatsApp : client à droite, Lalla à gauche,
// messages d'une même série resserrés, heure dans chaque bulle, séparateurs de jour.
export function Fil({
  elements,
  attenteReponse,
  traductionEnCours,
  jeton,
  devise,
  fuseau,
  telephoneReception,
  nomAssistant,
  departProche,
  carteSurlignee,
  langue,
  t,
  onDeciderDemande,
  onReessayer,
}: Proprietes) {
  let jourPrecedent: string | null = null;
  const derniereSerieAssistant = elements.length > 0 && coteDe(elements[elements.length - 1]) === "assistant";

  return (
    <ol className="pt-[clamp(2.75rem,8dvh,4.5rem)] pb-3" aria-live="polite">
      {elements.map((element, index) => {
        const instant = "envoyeLe" in element ? element.envoyeLe : null;
        const jour = instant ? cleJour(instant) : jourPrecedent;
        const nouveauJour = instant !== null && jour !== jourPrecedent;
        jourPrecedent = jour;

        const precedent = elements[index - 1];
        const nouvelleSerie = !precedent || nouveauJour || coteDe(precedent) !== coteDe(element);
        const espacement = index === 0 ? "" : nouvelleSerie ? "mt-3" : "mt-[3px]";
        const heure = instant ? heureMessage(instant, langue) : undefined;

        return (
          <Fragment key={element.id}>
            {nouveauJour && instant && (
              <li className={`flex justify-center ${index === 0 ? "mb-3" : "my-3"}`}>
                <span className="rounded-lg bg-surface px-3 py-1 text-[12px] font-medium text-encre-douce shadow-[0_1px_0.5px_rgb(26_27_23/0.08)]">
                  {libelleJour(instant, langue, t("aujourdhui"), t("hier"))}
                </span>
              </li>
            )}

            <li className={`animate-apparition ${nouveauJour ? "" : espacement}`}>
              {element.genre === "client" && (
                <div className="flex justify-end ps-[20%]">
                  <Bulle
                    cote="client"
                    queue={nouvelleSerie}
                    heure={heure}
                    // Lu dès que Lalla a commencé à répondre
                    statut={elements.slice(index + 1).some((suivant) => suivant.genre !== "client") ? "lu" : "envoye"}
                  >
                    <p className="whitespace-pre-wrap">{avecNomAssistant(element.texte, nomAssistant)}</p>
                  </Bulle>
                </div>
              )}

              {element.genre === "assistant" && (
                <LigneAssistant avatar={nouvelleSerie}>
                  <Bulle cote="assistant" queue={nouvelleSerie} heure={heure} attenue={traductionEnCours}>
                    {element.equipe && (
                      <p className="mb-1 flex items-center gap-1.5 text-[13.5px] font-extrabold text-succes">
                        <ConciergeBell className="size-4" strokeWidth={2.4} aria-hidden />
                        {t("reponseReception")}
                      </p>
                    )}
                    <TexteRiche texte={element.texte} nomAssistant={nomAssistant} />
                  </Bulle>
                </LigneAssistant>
              )}

              {element.genre === "demande" && (
                <LigneAssistant avatar={nouvelleSerie} carte>
                  <div
                    data-carte={element.demande.id}
                    className={`w-full scroll-my-24 rounded-[22px] transition-shadow duration-500 ${
                      carteSurlignee === element.demande.id ? "ring-[3px] ring-bouton" : ""
                    }`}
                  >
                    <CarteDemande
                      demande={element.demande}
                      devise={devise}
                      langue={langue}
                      t={t}
                      onDecider={(decision) => onDeciderDemande(element.demande.id, decision)}
                    />
                  </div>
                </LigneAssistant>
              )}

              {element.genre === "avis" && (
                <LigneAssistant avatar={nouvelleSerie} carte>
                  <div className="w-full">
                    <CarteAvis jeton={jeton} langue={langue} t={t} departProche={departProche} />
                  </div>
                </LigneAssistant>
              )}

              {element.genre === "erreur" && (
                <LigneAssistant avatar={nouvelleSerie}>
                  <Bulle cote="assistant" queue={nouvelleSerie}>
                    {/* Même couleur que les autres messages de l'assistant (noir pur, ou blanc sur fond foncé) */}
                    <p>{t(element.cle, { telephone: telephoneReception ?? "" })}</p>
                    <button
                      type="button"
                      onClick={() => onReessayer(element.id, element.messageARenvoyer)}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-[14px] font-semibold underline decoration-current/30 underline-offset-[3px]"
                    >
                      <RotateCcw className="size-3.5" strokeWidth={2.4} />
                      {t("reessayer")}
                    </button>
                  </Bulle>
                </LigneAssistant>
              )}
            </li>
          </Fragment>
        );
      })}

      {attenteReponse && (
        <li className={`animate-apparition ${derniereSerieAssistant ? "mt-[3px]" : "mt-3"}`} aria-label={t("ecrit")}>
          <LigneAssistant avatar={!derniereSerieAssistant}>
            <Bulle cote="assistant" queue={!derniereSerieAssistant}>
              <PointsSaisie />
            </Bulle>
          </LigneAssistant>
        </li>
      )}
    </ol>
  );
}
