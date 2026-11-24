"use client";

import { Clock3, Loader2, Minus, Plus, Search, SendHorizontal, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formaterPrix, sansAccents } from "@/lib/format";
import { etatOuverture } from "@/lib/horaires-service";
import type { TraduireClient } from "@/lib/i18n/client";
import { choisirTraduction, type LangueClient } from "@/lib/langues";
import type { ArticleVue, CategorieVue } from "@/lib/types";
import { FeuilleBas } from "./FeuilleBas";
import { horairesLisibles } from "./horaires";
import { textesEchec } from "./textes-demande";
import type { ResultatDemandeDirecte } from "./useConversation";
import { Vignette } from "./Vignette";

type Proprietes = {
  ouverte: boolean;
  categories: CategorieVue[]; // rubriques de restauration uniquement
  devise: string;
  fuseau: string; // fuseau de l'hôtel : un service fermé à cette heure ne se commande pas
  langue: LangueClient;
  t: TraduireClient;
  variablesTextes: Record<string, string>; // réglages de textes de cette fenêtre
  onFermer: () => void;
  onCommander: (lignes: { articleId: string; quantite: number }[]) => Promise<ResultatDemandeDirecte>;
};

// Marge laissée au-dessus d'une rubrique quand on y saute depuis les onglets
const MARGE_ANCRE_PX = 8;

// La carte du room service, illustrée : le client compose son panier sans écrire.
// « Commander » ouvre le récapitulatif (quantités, vider, ajouter d'autres articles) ;
// « Envoyer la commande » la transmet directement à l'équipe, sans passer par Lalla.
// Un article indisponible, ou d'un service fermé à cette heure, reste visible sans pouvoir être ajouté.
export function FeuilleRoomService({
  ouverte,
  categories,
  devise,
  fuseau,
  langue,
  t,
  variablesTextes,
  onFermer,
  onCommander,
}: Proprietes) {
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [etape, setEtape] = useState<"carte" | "recapitulatif">("carte");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [refus, setRefus] = useState<string[]>([]); // pourquoi l'envoi n'a pas abouti
  const [categorieActive, setCategorieActive] = useState(categories[0]?.id);
  const [recherche, setRecherche] = useState<string | null>(null); // null : recherche fermée
  const zone = useRef<HTMLDivElement>(null);

  // Services fermés en ce moment, à l'heure de l'hôtel (recalculé à chaque ouverture de la feuille)
  const fermees = useMemo(
    () =>
      ouverte
        ? new Set(categories.filter((c) => etatOuverture(c.horaires, fuseau) === "ferme").map((c) => c.id))
        : new Set<string>(),
    [ouverte, categories, fuseau],
  );

  const articles = useMemo(
    () => new Map(categories.flatMap((categorie) => categorie.articles).map((article) => [article.id, article])),
    [categories],
  );
  const lignes = Object.entries(panier).flatMap(([id, quantite]) => {
    const article = articles.get(id);
    return article && quantite > 0 ? [{ article, quantite }] : [];
  });
  const nombre = lignes.reduce((somme, { quantite }) => somme + quantite, 0);
  const total = lignes.reduce((somme, { article, quantite }) => somme + article.prix * quantite, 0);

  const nomCategorie = (categorie: CategorieVue) =>
    choisirTraduction(categorie.traductions, langue, { nom: categorie.nom }).nom;
  const texteArticle = (article: ArticleVue) =>
    choisirTraduction(article.traductions, langue, {
      nom: article.nom,
      description: article.description ?? undefined,
    });
  const nomArticle = (article: ArticleVue) => texteArticle(article).nom;
  const changerQuantite = (id: string, ecart: number) => {
    setRefus([]);
    setPanier((actuel) => ({
      ...actuel,
      [id]: Math.max(0, (actuel[id] ?? 0) + ecart),
    }));
  };

  // À chaque ouverture, la carte d'abord ; un récapitulatif vidé y ramène aussi
  useEffect(() => {
    if (!ouverte) {
      setEtape("carte");
      setRefus([]);
    }
  }, [ouverte]);
  useEffect(() => {
    if (nombre === 0) setEtape("carte");
  }, [nombre]);

  // Recherche dans la langue du client, en français (langue de la carte) et dans la rubrique
  const requete = sansAccents(recherche?.trim() ?? "");
  const categoriesAffichees = requete
    ? categories
        .map((categorie) => ({
          ...categorie,
          articles: categorie.articles.filter((article) => {
            const { nom, description } = texteArticle(article);
            return sansAccents(
              [nom, description, article.nom, article.description, nomCategorie(categorie)].filter(Boolean).join(" "),
            ).includes(requete);
          }),
        }))
        .filter((categorie) => categorie.articles.length > 0)
    : categories;

  function allerA(id: string) {
    const section = document.getElementById(`rubrique-${id}`);
    if (!zone.current || !section) return;
    setCategorieActive(id);
    zone.current.scrollTo({
      top: section.offsetTop - MARGE_ANCRE_PX,
      behavior: "smooth",
    });
  }

  // L'onglet suit la rubrique en cours de lecture
  function surDefilement() {
    const conteneur = zone.current;
    if (!conteneur || requete) return;
    const lue = categories.findLast((categorie) => {
      const section = document.getElementById(`rubrique-${categorie.id}`);
      return section !== null && section.offsetTop - MARGE_ANCRE_PX * 4 <= conteneur.scrollTop;
    });
    setCategorieActive((lue ?? categories[0])?.id);
  }

  async function envoyer() {
    if (envoiEnCours) return;
    setEnvoiEnCours(true);
    setRefus([]);
    const resultat = await onCommander(
      lignes.map(({ article, quantite }) => ({
        articleId: article.id,
        quantite,
      })),
    );
    setEnvoiEnCours(false);
    if (resultat.ok) return setPanier({});
    setRefus(textesEchec(resultat, langue, t));
  }

  const totalLisible = formaterPrix(total, devise, langue);
  const piedRecapitulatif = (
    <div className="marge-securite-bas shrink-0 space-y-1 border-t border-ligne/70 bg-fond px-5 pt-3">
      <button
        type="button"
        onClick={envoyer}
        disabled={envoiEnCours}
        className="flex h-14 w-full items-center justify-center gap-2.5 texte-boutons rounded-2xl bg-bouton px-5 text-boutons shadow-carte transition active:scale-[0.98] disabled:opacity-75"
      >
        {envoiEnCours ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <SendHorizontal className="size-5 rtl:-scale-x-100" strokeWidth={2.2} aria-hidden />
        )}
        <span>{t("envoyerCommande")}</span>
        <span className="tabular-nums opacity-90">· {totalLisible}</span>
      </button>
      <button
        type="button"
        onClick={() => setEtape("carte")}
        disabled={envoiEnCours}
        className="h-12 w-full rounded-2xl text-[15px] font-semibold text-encre-douce transition active:bg-creux disabled:opacity-50"
      >
        {t("ajouterArticles")}
      </button>
    </div>
  );

  const pied =
    etape === "recapitulatif" ? (
      piedRecapitulatif
    ) : nombre > 0 ? (
      <div className="marge-securite-bas shrink-0 border-t border-ligne/70 bg-fond px-5 pt-3">
        <button
          type="button"
          onClick={() => setEtape("recapitulatif")}
          className="flex h-14 w-full animate-apparition items-center gap-3 texte-boutons rounded-2xl bg-bouton ps-3 pe-5 text-boutons shadow-carte transition active:scale-[0.98]"
        >
          <span className="grid size-8 place-items-center rounded-xl bg-texte-bouton/20 text-[14px] font-bold tabular-nums">
            {nombre}
          </span>
          <span className="flex-1 text-start">{t("commander")}</span>
          <span className="tabular-nums">{totalLisible}</span>
        </button>
      </div>
    ) : null;

  return (
    <FeuilleBas
      variablesTextes={variablesTextes}
      ouverte={ouverte}
      titre={t(etape === "recapitulatif" ? "votreCommande" : "tuileRoomService")}
      libelleFermer={t("fermer")}
      onFermer={onFermer}
      hauteur="haute"
      pied={pied}
      actions={
        etape === "carte" &&
        recherche === null && (
          <button
            type="button"
            onClick={() => setRecherche("")}
            aria-label={t("rechercher")}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-creux text-encre-douce transition active:scale-90"
          >
            <Search className="size-[18px]" strokeWidth={2.2} />
          </button>
        )
      }
    >
      {etape === "recapitulatif" ? (
        <Recapitulatif
          lignes={lignes}
          nomArticle={nomArticle}
          devise={devise}
          langue={langue}
          totalLisible={totalLisible}
          refus={refus}
          t={t}
          onChanger={changerQuantite}
          onVider={() => setPanier({})}
        />
      ) : recherche !== null ? (
        // Recherche ouverte : le champ prend la place des rubriques
        <div className="shrink-0 px-5 pb-2">
          <label className="flex h-11 items-center gap-2 rounded-full border border-ligne bg-surface ps-4 pe-1.5 focus-within:border-bouton/50">
            <Search className="size-4 shrink-0 text-encre-pale" strokeWidth={2.2} aria-hidden />
            <input
              type="search"
              autoFocus
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              placeholder={t("placeholderRecherche")}
              aria-label={t("rechercher")}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-encre outline-none placeholder:text-encre-pale [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              onClick={() => setRecherche(null)}
              aria-label={t("fermerRecherche")}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-creux text-encre-douce transition active:scale-90"
            >
              <X className="size-4" strokeWidth={2.4} />
            </button>
          </label>
        </div>
      ) : (
        categories.length > 1 && (
          <nav className="defilement-discret flex shrink-0 gap-2 overflow-x-auto px-5 pb-2">
            {categories.map((categorie) => (
              <button
                key={categorie.id}
                type="button"
                onClick={() => allerA(categorie.id)}
                aria-current={categorieActive === categorie.id}
                className={`h-9 shrink-0 rounded-full px-4 text-[13.5px] font-semibold transition ${
                  // Rubrique active : une teinte claire dérivée de la couleur des boutons
                  categorieActive === categorie.id
                    ? "bg-bouton/15 text-bouton ring-1 ring-bouton/20"
                    : "border border-ligne bg-surface text-encre-douce"
                }`}
              >
                {nomCategorie(categorie)}
              </button>
            ))}
          </nav>
        )
      )}

      <div
        ref={zone}
        onScroll={surDefilement}
        hidden={etape === "recapitulatif"}
        className="relative flex-1 overflow-y-auto overscroll-contain px-5 pb-6"
      >
        {categoriesAffichees.length === 0 && (
          <p className="pt-10 text-center text-[14.5px] text-encre-pale">
            {t("aucunResultat", { q: recherche?.trim() ?? "" })}
          </p>
        )}
        {categoriesAffichees.map((categorie) => {
          const horaires = horairesLisibles(categorie.horaires, langue, t);
          const fermee = fermees.has(categorie.id);
          return (
            <section key={categorie.id} id={`rubrique-${categorie.id}`} className="pt-4">
              <div className="flex items-center justify-between gap-3 pb-1">
                <h3 className="texte-sections uppercase text-sections">{nomCategorie(categorie)}</h3>
                {(horaires || fermee) && (
                  <span
                    className={`flex shrink-0 items-center gap-1 text-[13px] ${
                      fermee ? "font-semibold text-attention" : "text-encre-douce"
                    }`}
                  >
                    <Clock3 className="size-3.5" strokeWidth={2} aria-hidden />
                    {fermee && t("serviceFerme")}
                    {fermee && horaires && " · "}
                    {horaires && <span dir="ltr">{horaires}</span>}
                  </span>
                )}
              </div>
              <ul className="divide-y divide-ligne/70">
                {categorie.articles.map((article) => {
                  const traduction = texteArticle(article);
                  const description = traduction.description ?? article.description;
                  const commandable = article.disponible && !fermee;
                  return (
                    <li key={article.id} className="flex gap-3.5 py-3.5">
                      <Vignette
                        photo={article.photo}
                        icone={UtensilsCrossed}
                        className={`size-[92px] shrink-0 rounded-2xl ${article.disponible ? "" : "opacity-45 grayscale"}`}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className={`texte-intitules ${article.disponible ? "text-intitules" : "text-encre-pale"}`}>
                          {traduction.nom}
                        </p>
                        {description && (
                          <p className="texte-secondaires mt-0.5 line-clamp-2 leading-snug text-secondaires">
                            {description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                          <span
                            className={`texte-prix tabular-nums ${
                              article.disponible ? "text-prix" : "text-encre-pale"
                            }`}
                          >
                            {formaterPrix(article.prix, devise, langue)}
                          </span>
                          {commandable ? (
                            <Quantite
                              quantite={panier[article.id] ?? 0}
                              libelleAjouter={`${t("ajouter")} : ${traduction.nom}`}
                              libelleRetirer={`${t("retirer")} : ${traduction.nom}`}
                              onChanger={(ecart) => changerQuantite(article.id, ecart)}
                            />
                          ) : (
                            // Indisponible ou service fermé : le bouton d'ajout est là, mais désactivé
                            <span className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-encre-pale">
                                {t(article.disponible ? "serviceFerme" : "articleIndisponible")}
                              </span>
                              <button
                                type="button"
                                disabled
                                aria-label={`${t(article.disponible ? "serviceFerme" : "articleIndisponible")} : ${traduction.nom}`}
                                className="grid size-9 cursor-not-allowed place-items-center rounded-full bg-creux text-encre-pale"
                              >
                                <Plus className="size-[18px]" strokeWidth={2.4} />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </FeuilleBas>
  );
}

/** Récapitulatif avant l'envoi : chaque article avec sa quantité, le total, et de quoi tout vider. */
function Recapitulatif({
  lignes,
  nomArticle,
  devise,
  langue,
  totalLisible,
  refus,
  t,
  onChanger,
  onVider,
}: {
  lignes: { article: ArticleVue; quantite: number }[];
  nomArticle: (article: ArticleVue) => string;
  devise: string;
  langue: LangueClient;
  totalLisible: string;
  refus: string[];
  t: TraduireClient;
  onChanger: (id: string, ecart: number) => void;
  onVider: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
      <ul className="divide-y divide-ligne/70 rounded-[22px] border border-ligne/80 bg-surface px-4 shadow-carte">
        {lignes.map(({ article, quantite }) => {
          const nom = nomArticle(article);
          return (
            <li key={article.id} className="flex items-center gap-3 py-3">
              <Vignette photo={article.photo} icone={UtensilsCrossed} className="size-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="texte-intitules text-intitules">{nom}</p>
                <p className="texte-prix mt-0.5 tabular-nums text-prix">
                  {formaterPrix(article.prix * quantite, devise, langue)}
                </p>
              </div>
              <Quantite
                quantite={quantite}
                libelleAjouter={`${t("ajouter")} : ${nom}`}
                libelleRetirer={`${t("retirer")} : ${nom}`}
                onChanger={(ecart) => onChanger(article.id, ecart)}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3 ps-1">
        <button
          type="button"
          onClick={onVider}
          className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold text-alerte transition active:bg-alerte/10"
        >
          <Trash2 className="size-4" strokeWidth={2.2} aria-hidden />
          {t("viderPanier")}
        </button>
        <p className="flex items-baseline gap-2.5">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-encre-pale">{t("total")}</span>
          <span className="texte-prix texte-total tabular-nums text-prix">{totalLisible}</span>
        </p>
      </div>

      {refus.length > 0 && (
        <ul role="alert" className="mt-4 space-y-1.5">
          {refus.map((texte) => (
            <li
              key={texte}
              className="flex items-start gap-2 rounded-xl bg-attention-fond px-3.5 py-3 text-[14.5px] leading-snug text-attention"
            >
              <Clock3 className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
              {texte}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Quantite({
  quantite,
  libelleAjouter,
  libelleRetirer,
  onChanger,
}: {
  quantite: number;
  libelleAjouter: string;
  libelleRetirer: string;
  onChanger: (ecart: number) => void;
}) {
  const boutonAjouter = (
    <button
      type="button"
      onClick={() => onChanger(1)}
      aria-label={libelleAjouter}
      className="grid size-9 place-items-center rounded-full bg-bouton text-texte-bouton shadow-carte transition active:scale-90"
    >
      <Plus className="size-[18px]" strokeWidth={2.4} />
    </button>
  );
  if (quantite === 0) return boutonAjouter;

  return (
    <div className="flex items-center gap-1 rounded-full bg-accent-pale p-0.5">
      <button
        type="button"
        onClick={() => onChanger(-1)}
        aria-label={libelleRetirer}
        className="grid size-8 place-items-center rounded-full text-accent-profond transition active:scale-90 active:bg-accent-doux"
      >
        <Minus className="size-4" strokeWidth={2.4} />
      </button>
      <span aria-live="polite" className="min-w-5 text-center text-[15px] font-bold tabular-nums text-accent-profond">
        {quantite}
      </span>
      {boutonAjouter}
    </div>
  );
}
