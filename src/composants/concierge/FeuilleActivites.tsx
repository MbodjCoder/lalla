"use client";

import { Clock3, Sailboat } from "lucide-react";
import { useEffect, useState } from "react";
import { formaterPrix } from "@/lib/format";
import type { TraduireClient } from "@/lib/i18n/client";
import { choisirTraduction, type LangueClient } from "@/lib/langues";
import type { ArticleVue, CategorieVue } from "@/lib/types";
import { FeuilleBas } from "./FeuilleBas";
import { EnteteFormulaire, FormulaireDemande } from "./FormulaireDemande";
import { horairesLisibles } from "./horaires";
import type { DemandeDirecte, ResultatDemandeDirecte } from "./useConversation";
import { Vignette } from "./Vignette";

type Proprietes = {
  ouverte: boolean;
  categories: CategorieVue[]; // excursions et bien-être
  ville: string;
  devise: string;
  fuseau: string;
  langue: LangueClient;
  t: TraduireClient;
  variablesTextes: Record<string, string>; // réglages de textes de cette fenêtre
  onFermer: () => void;
  onReserver: (demande: DemandeDirecte) => Promise<ResultatDemandeDirecte>;
};

type Choix = { article: ArticleVue; titre: string; soin: boolean };

// « Île de Gorée (demi-journée) » → titre « Île de Gorée », durée « demi-journée »
function separerDuree(nom: string): { titre: string; duree: string | null } {
  const correspondance = /^(.*\S)\s*\(([^)]+)\)$/.exec(nom);
  return correspondance ? { titre: correspondance[1], duree: correspondance[2] } : { titre: nom, duree: null };
}

// Catalogue des activités : une grande photo par expérience, l'essentiel en surimpression.
// « Réserver » ouvre l'étape de réservation (jour, heure pour un soin, personnes, total),
// envoyée directement à l'équipe sans passer par Lalla.
export function FeuilleActivites({
  ouverte,
  categories,
  ville,
  devise,
  fuseau,
  langue,
  t,
  variablesTextes,
  onFermer,
  onReserver,
}: Proprietes) {
  const [choix, setChoix] = useState<Choix | null>(null);
  // À chaque ouverture, le catalogue d'abord
  useEffect(() => {
    if (!ouverte) setChoix(null);
  }, [ouverte]);

  return (
    <FeuilleBas
      variablesTextes={variablesTextes}
      ouverte={ouverte}
      titre={choix ? t("reserver") : t("tuileActivites")}
      sousTitre={choix ? undefined : t("tuileActivitesDetail", { ville })}
      libelleFermer={t("fermer")}
      onFermer={onFermer}
      hauteur="haute"
    >
      {choix ? (
        <FormulaireDemande
          key={choix.article.id}
          // Un soin se réserve à une heure précise ; une excursion se réserve à la journée, la veille
          champs={
            choix.soin ? { jour: "aujourdhui", heure: "bientot", personnes: true } : { jour: "demain", personnes: true }
          }
          entete={
            <EnteteFormulaire
              photo={choix.article.photo}
              icone={Sailboat}
              titre={choix.titre}
              sousTitre={t("parPersonne", { prix: formaterPrix(choix.article.prix, devise, langue) })}
            />
          }
          fuseau={fuseau}
          langue={langue}
          t={t}
          libelleEnvoyer={t("envoyerReservation")}
          prixUnitaire={choix.article.prix}
          devise={devise}
          onEnvoyer={({ jour, heure, personnes }) =>
            onReserver({
              genre: "commande",
              lignes: [{ articleId: choix.article.id, quantite: personnes }],
              reservation: { jour: jour!, ...(heure ? { heure } : {}) },
            })
          }
          onRetour={() => setChoix(null)}
        />
      ) : (
        <div className="marge-securite-bas flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 pb-6">
          {categories.map((categorie) => {
            const horaires = horairesLisibles(categorie.horaires, langue, t);
            return (
              <section key={categorie.id}>
                <div className="flex items-center justify-between gap-3 pb-3">
                  <h3 className="texte-sections uppercase text-sections">
                    {
                      choisirTraduction(categorie.traductions, langue, {
                        nom: categorie.nom,
                      }).nom
                    }
                  </h3>
                  {horaires && (
                    <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-encre-pale">
                      <Clock3 className="size-3.5" strokeWidth={2} aria-hidden />
                      <span dir="ltr">{horaires}</span>
                    </span>
                  )}
                </div>

                <ul className="space-y-3.5">
                  {categorie.articles.map((article) => {
                    const traduction = choisirTraduction(article.traductions, langue, {
                      nom: article.nom,
                      description: article.description ?? undefined,
                    });
                    const { titre, duree } = separerDuree(traduction.nom);
                    const description = traduction.description ?? article.description;
                    return (
                      <li key={article.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setChoix({ article, titre: traduction.nom, soin: categorie.type === "BIEN_ETRE" })
                          }
                          aria-label={`${t("reserver")} : ${traduction.nom}`}
                          className="relative block aspect-[16/10] w-full overflow-hidden rounded-[24px] text-start shadow-carte transition duration-200 active:scale-[0.98]"
                        >
                          <Vignette photo={article.photo} icone={Sailboat} className="absolute inset-0 size-full" />
                          <span
                            className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/0"
                            aria-hidden
                          />
                          {duree && (
                            <span className="absolute start-3 top-3 rounded-full bg-black/40 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-md first-letter:uppercase">
                              {duree}
                            </span>
                          )}
                          <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                            <span className="min-w-0">
                              <span className="texte-titres-cartes block text-white">{titre}</span>
                              {description && (
                                <span className="texte-secondaires mt-1 line-clamp-1 block text-white/80">
                                  {description}
                                </span>
                              )}
                              <span className="texte-prix mt-1.5 block tabular-nums text-white/90">
                                {formaterPrix(article.prix, devise, langue)}
                              </span>
                            </span>
                            <span className="flex h-10 shrink-0 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-encre">
                              {t("reserver")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </FeuilleBas>
  );
}
