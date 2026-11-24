"use client";

import { Check, Clock3, Copy, MessageCircle, Wifi, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { TraduireClient } from "@/lib/i18n/client";
import { choisirTraduction, type LangueClient } from "@/lib/langues";
import { copierTexte } from "@/lib/presse-papiers";
import type { ServiceDirect } from "@/lib/services-directs";
import type { CategorieVue, InfosPratiquesVue } from "@/lib/types";
import { FeuilleBas } from "./FeuilleBas";
import { heureLisible, plageHoraire } from "./horaires";

export type OngletInfos = "wifi" | "horaires";

type Proprietes = {
  ouverte: boolean;
  infos: InfosPratiquesVue;
  categories: CategorieVue[]; // toute la carte : horaires de chaque rubrique
  nomAssistant: string;
  langue: LangueClient;
  t: TraduireClient;
  variablesTextes: Record<string, string>; // réglages de textes de cette fenêtre
  onFermer: () => void;
  onService: (service: ServiceDirect, message: string) => void; // un geste : la carte à confirmer
};

const ONGLETS: {
  id: OngletInfos;
  icone: LucideIcon;
  cle: "infosWifi" | "infosHoraires";
}[] = [
  { id: "wifi", icone: Wifi, cle: "infosWifi" },
  { id: "horaires", icone: Clock3, cle: "infosHoraires" },
];

// Durée d'affichage de la confirmation « Copié » (ou du conseil si la copie échoue)
const DUREE_COPIE_MS = 2500;
const DUREE_ECHEC_COPIE_MS = 6000;

// Les informations pratiques, consultables en un geste et sans attendre de réponse.
export function FeuilleInfos({
  ouverte,
  infos,
  categories,
  nomAssistant,
  langue,
  t,
  variablesTextes,
  onFermer,
  onService,
}: Proprietes) {
  const [onglet, setOnglet] = useState<OngletInfos>("wifi");
  return (
    <FeuilleBas
      variablesTextes={variablesTextes}
      ouverte={ouverte}
      titre={t("tuileInfos")}
      libelleFermer={t("fermer")}
      onFermer={onFermer}
    >
      <div
        role="tablist"
        aria-label={t("tuileInfos")}
        className="mx-5 mb-4 grid shrink-0 grid-cols-2 rounded-full bg-creux p-1"
      >
        {ONGLETS.map(({ id, icone: Icone, cle }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={onglet === id}
            onClick={() => setOnglet(id)}
            className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-[13.5px] font-semibold transition duration-200 ${
              onglet === id ? "bg-surface text-encre shadow-carte" : "text-encre-douce"
            }`}
          >
            <Icone className="size-4 shrink-0" strokeWidth={2.3} aria-hidden />
            <span className="truncate">{t(cle)}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="marge-securite-bas min-h-[17rem] overflow-y-auto overscroll-contain px-5 pb-4">
        {onglet === "wifi" && (
          <OngletWifi infos={infos} t={t} onDemanderCode={() => onService("wifi", t("wifiMessage"))} />
        )}
        {onglet === "horaires" && (
          <OngletHoraires infos={infos} categories={categories} nomAssistant={nomAssistant} langue={langue} t={t} />
        )}
      </div>
    </FeuilleBas>
  );
}

function OngletWifi({ infos, t, onDemanderCode }: Pick<Proprietes, "infos" | "t"> & { onDemanderCode: () => void }) {
  const [copie, setCopie] = useState<"repos" | "reussie" | "impossible">("repos");

  useEffect(() => {
    if (copie === "repos") return;
    const minuteur = setTimeout(() => setCopie("repos"), copie === "reussie" ? DUREE_COPIE_MS : DUREE_ECHEC_COPIE_MS);
    return () => clearTimeout(minuteur);
  }, [copie]);

  if (!infos.wifiReseau) {
    return (
      <div className="animate-apparition rounded-[24px] border border-ligne/80 bg-surface p-5 text-center shadow-carte">
        <p className="text-[15px] text-encre-douce">{t("wifiInconnu")}</p>
        <button
          type="button"
          onClick={onDemanderCode}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-bouton px-5 text-[14.5px] font-semibold text-texte-bouton transition active:scale-95"
        >
          <MessageCircle className="size-4" strokeWidth={2.2} /> {t("demanderLalla")}
        </button>
      </div>
    );
  }

  async function copier() {
    setCopie((await copierTexte(infos.wifiMotDePasse ?? "")) ? "reussie" : "impossible");
  }

  return (
    <div className="animate-apparition">
      <div className="rounded-[24px] border border-ligne/80 bg-surface p-5 shadow-carte">
        <p className="texte-sections uppercase text-sections">{t("reseau")}</p>
        <p dir="ltr" className="texte-wifi-reseau mt-1 break-all text-start text-wifi-reseau rtl:text-right">
          {infos.wifiReseau}
        </p>

        {infos.wifiMotDePasse && (
          <>
            <div className="my-4 h-px bg-ligne/80" />
            <p className="texte-sections uppercase text-sections">{t("motDePasse")}</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              {/* Un toucher sélectionne tout le mot de passe : copie manuelle possible en dernier recours */}
              <p dir="ltr" className="texte-wifi-mot-de-passe min-w-0 break-all text-wifi-mot-de-passe select-all">
                {infos.wifiMotDePasse}
              </p>
              <button
                type="button"
                onClick={copier}
                aria-live="polite"
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition active:scale-95 ${
                  copie === "reussie" ? "bg-succes text-white" : "bg-bouton text-texte-bouton"
                }`}
              >
                {copie === "reussie" ? (
                  <Check className="size-4" strokeWidth={2.8} />
                ) : (
                  <Copy className="size-4" strokeWidth={2.2} />
                )}
                {t(copie === "reussie" ? "copie" : "copier")}
              </button>
            </div>
            {copie === "impossible" && (
              <p aria-live="polite" className="mt-3 animate-apparition text-[13px] font-semibold text-alerte">
                {t("copieImpossible")}
              </p>
            )}
          </>
        )}
      </div>
      <p className="mt-3 px-1 text-[13px] leading-snug text-encre-pale">{t("wifiAide")}</p>
    </div>
  );
}

function OngletHoraires({
  infos,
  categories,
  nomAssistant,
  langue,
  t,
}: Pick<Proprietes, "infos" | "categories" | "nomAssistant" | "langue" | "t">) {
  const lignes: { libelle: string; valeur: string }[] = [
    { libelle: nomAssistant, valeur: t("toujours") },
    // Les rubriques sans plage horaire (ex. « réserver la veille ») gardent leur consigne dans leur feuille
    ...categories.flatMap((categorie) => {
      const valeur = plageHoraire(categorie.horaires, langue, t);
      return valeur
        ? [
            {
              libelle: choisirTraduction(categorie.traductions, langue, {
                nom: categorie.nom,
              }).nom,
              valeur,
            },
          ]
        : [];
    }),
    {
      libelle: t("liberationChambre"),
      valeur: t("avantHeure", {
        heure: heureLisible(infos.heureCheckout, langue),
      }),
    },
  ];

  return (
    <ul className="animate-apparition divide-y divide-ligne/70 rounded-[24px] border border-ligne/80 bg-surface px-5 shadow-carte">
      {lignes.map(({ libelle, valeur }) => (
        <li key={libelle} className="flex items-center justify-between gap-4 py-3.5">
          <span className="texte-intitules min-w-0 text-intitules">{libelle}</span>
          <span dir="ltr" className="texte-valeurs-horaires shrink-0 tabular-nums text-valeurs-horaires">
            {valeur}
          </span>
        </li>
      ))}
    </ul>
  );
}
