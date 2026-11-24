"use client";

import {
  AlarmClock,
  Bath,
  BedDouble,
  CarTaxiFront,
  ChevronRight,
  PenLine,
  SoapDispenserDroplet,
  SprayCan,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CleTexteClient, TraduireClient } from "@/lib/i18n/client";
import type { LangueClient } from "@/lib/langues";
import type { ServiceDirect } from "@/lib/services-directs";
import { FeuilleBas } from "./FeuilleBas";
import { EnteteFormulaire, FormulaireDemande, type ChampsFormulaire } from "./FormulaireDemande";
import type { DemandeDirecte, ResultatDemandeDirecte } from "./useConversation";

type Proprietes = {
  ouverte: boolean;
  fuseau: string;
  langue: LangueClient;
  t: TraduireClient;
  variablesTextes: Record<string, string>; // réglages de textes de cette fenêtre
  onFermer: () => void;
  onService: (service: ServiceDirect, message: string) => void; // un geste : la carte à confirmer
  onDemanderDirect: (demande: DemandeDirecte) => Promise<ResultatDemandeDirecte>; // formulaire envoyé
  onAutre: () => void; // le client écrit lui-même sa demande
};

type Service = { icone: LucideIcon; libelle: CleTexteClient; service: ServiceDirect } & (
  | { message: CleTexteClient; formulaire?: never } // un geste suffit
  | { formulaire: ChampsFormulaire; message?: never } // le moment se précise d'abord
);

// Demandes les plus fréquentes en chambre, sans attendre Lalla : un geste affiche la carte à
// confirmer ; le réveil et le taxi passent par un court formulaire (jour, heure, destination).
const SERVICES: Service[] = [
  { icone: Bath, libelle: "serviceServiettes", service: "serviettes", message: "serviceServiettesMessage" },
  { icone: SprayCan, libelle: "serviceMenage", service: "menage", message: "serviceMenageMessage" },
  { icone: BedDouble, libelle: "serviceLinge", service: "linge", message: "serviceLingeMessage" },
  { icone: SoapDispenserDroplet, libelle: "serviceProduits", service: "produits", message: "serviceProduitsMessage" },
  { icone: AlarmClock, libelle: "serviceReveil", service: "reveil", formulaire: { jour: "demain", heure: "07:00" } },
  {
    icone: CarTaxiFront,
    libelle: "serviceTaxi",
    service: "taxi",
    formulaire: { jour: "aujourdhui", heure: "bientot", precision: "destinationFacultative" },
  },
];

export function FeuilleServices({
  ouverte,
  fuseau,
  langue,
  t,
  variablesTextes,
  onFermer,
  onService,
  onDemanderDirect,
  onAutre,
}: Proprietes) {
  const [choisi, setChoisi] = useState<Service | null>(null);
  // À chaque ouverture, la liste d'abord
  useEffect(() => {
    if (!ouverte) setChoisi(null);
  }, [ouverte]);

  return (
    <FeuilleBas
      variablesTextes={variablesTextes}
      ouverte={ouverte}
      titre={t(choisi ? choisi.libelle : "tuileService")}
      libelleFermer={t("fermer")}
      onFermer={onFermer}
      hauteur={choisi ? "haute" : "contenu"}
    >
      {choisi?.formulaire ? (
        <FormulaireDemande
          key={choisi.service}
          champs={choisi.formulaire}
          entete={<EnteteFormulaire icone={choisi.icone} titre={t(choisi.libelle)} />}
          fuseau={fuseau}
          langue={langue}
          t={t}
          libelleEnvoyer={t("envoyerDemande")}
          onEnvoyer={({ jour, heure, precision }) =>
            onDemanderDirect({
              genre: "service",
              service: choisi.service,
              precisions: { jour, heure, ...(precision.trim() ? { texte: precision.trim() } : {}) },
            })
          }
          onRetour={() => setChoisi(null)}
        />
      ) : (
        <div className="marge-securite-bas overflow-y-auto overscroll-contain px-5 pb-4">
          <ul className="grid grid-cols-2 gap-3">
            {SERVICES.map((service) => {
              const { icone: Icone, libelle } = service;
              return (
                <li key={libelle}>
                  <button
                    type="button"
                    onClick={() =>
                      service.formulaire ? setChoisi(service) : onService(service.service, t(service.message))
                    }
                    className="flex h-full min-h-[6.75rem] w-full flex-col items-center justify-center gap-2.5 rounded-[20px] border border-ligne/80 bg-surface px-3 py-4 text-center shadow-carte transition duration-200 active:scale-[0.97]"
                  >
                    <span className="grid size-12 place-items-center rounded-2xl bg-bouton/10 text-bouton" aria-hidden>
                      <Icone className="size-6" strokeWidth={2.3} />
                    </span>
                    <span className="texte-intitules text-intitules">{t(libelle)}</span>
                  </button>
                </li>
              );
            })}

            {/* Toute autre demande : directement au champ de saisie */}
            <li className="col-span-2">
              <button
                type="button"
                onClick={onAutre}
                className="flex w-full items-center gap-3.5 rounded-[20px] border border-dashed border-bouton/30 bg-bouton/5 px-4 py-3.5 text-start transition duration-200 active:scale-[0.98]"
              >
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface text-bouton"
                  aria-hidden
                >
                  <PenLine className="size-[22px]" strokeWidth={2.3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="texte-intitules block text-intitules">{t("serviceAutre")}</span>
                  <span className="texte-secondaires block text-secondaires">{t("serviceAutreDetail")}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-encre-pale rtl:-scale-x-100" aria-hidden />
              </button>
            </li>
          </ul>
        </div>
      )}
    </FeuilleBas>
  );
}
