"use client";

// « Informations » : réglages et connaissances de l'assistant réunis sur une page.
// Une seule section à la fois, choisie dans le sommaire (colonne sur ordinateur, onglets sur
// téléphone) : la page reste courte. La recherche montre tout ce qui correspond, et aucune
// saisie en cours n'est perdue en changeant de section.
import { Search, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { enregistrerDocument, enregistrerInformations } from "@/app/espace/actions";
import type { TypeDocument } from "@/generated/prisma/enums";
import { sansAccents } from "@/lib/format";
import { traducteurEquipe, type TraduireEquipe } from "@/lib/i18n/equipe";
import type { LangueEquipe } from "@/lib/langues";
import { Champ, SectionFormulaire } from "./SectionFormulaire";
import { ICONES_DOCUMENT, SECTIONS_HOTEL } from "./sections";

export type FicheConnaissance = {
  id: string;
  titre: string;
  type: TypeDocument;
  contenu: string;
  aVerifier: boolean;
};

type EntreeSommaire = {
  id: string;
  titre: string;
  icone: React.ElementType;
  aValider?: boolean;
};

const idFiche = (id: string) => `fiche-${id}`;

export function InformationsHotel({
  langue,
  nomAssistant,
  valeurs,
  fiches,
}: {
  langue: LangueEquipe;
  nomAssistant: string;
  valeurs: Record<string, string>;
  fiches: FicheConnaissance[];
}) {
  const t = traducteurEquipe(langue);
  const [recherche, setRecherche] = useState("");
  const requete = sansAccents(recherche.trim());
  const correspond = (...textes: (string | undefined)[]) =>
    !requete || textes.some((texte) => texte && sansAccents(texte).includes(requete));

  // Ce que la recherche garde : une section dont le titre correspond garde tous ses champs
  const sectionsHotel = SECTIONS_HOTEL.map((section) => {
    const titre = section.titre(t);
    const titreCorrespond = correspond(titre, t(section.description));
    const champsVisibles = new Set(
      section.champs
        .filter(
          (champ) =>
            titreCorrespond ||
            correspond(champ.libelle(t), champ.aide && t(champ.aide), champ.placeholder && t(champ.placeholder)),
        )
        .map((champ) => champ.nom),
    );
    const visible = champsVisibles.size > 0;
    return { ...section, titre, champsVisibles, visible };
  });
  const fichesVues = fiches.map((fiche) => ({
    ...fiche,
    visible: correspond(fiche.titre, fiche.contenu),
    occurrences: requete ? sansAccents(fiche.contenu).split(requete).length - 1 : 0,
  }));

  const groupes: { titre: string; entrees: EntreeSommaire[] }[] = [
    {
      titre: t("groupeHotel"),
      entrees: sectionsHotel.filter((s) => s.visible).map((s) => ({ id: s.id, titre: s.titre, icone: s.icone })),
    },
    {
      titre: t("groupeConnaissances", { assistant: nomAssistant }),
      entrees: fichesVues
        .filter((f) => f.visible)
        .map((f) => ({
          id: idFiche(f.id),
          titre: f.titre,
          icone: ICONES_DOCUMENT[f.type],
          aValider: f.aVerifier,
        })),
    },
  ];
  const entrees = groupes.flatMap((groupe) => groupe.entrees);

  // Section affichée : celle de l'adresse (#contacts…), sinon la première
  const [choisie, setChoisie] = useState(entrees[0]?.id ?? "");
  useEffect(() => {
    const ancre = decodeURIComponent(location.hash.slice(1));
    if (ancre) setChoisie(ancre);
  }, []);
  const actif = entrees.some((entree) => entree.id === choisie) ? choisie : (entrees[0]?.id ?? "");
  const choisir = (id: string) => {
    setChoisie(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Pendant une recherche, tout ce qui correspond est visible ; sinon, la seule section choisie
  const affichee = (id: string, visible: boolean) => visible && (Boolean(requete) || id === actif);

  return (
    <>
      {/* Le titre est dans l'en-tête de la page ; ici, la recherche, centrée dessous */}
      <div className="mt-6 flex justify-center">
        <label className="relative block w-full md:w-[400px]">
          <span className="sr-only">{t("rechercher")}</span>
          <Search className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-encre-pale" />
          <input
            type="search"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            onKeyDown={(evenement) => evenement.key === "Escape" && setRecherche("")}
            placeholder={t("rechercherInformations")}
            className="texte-champs-equipe h-12 w-full rounded-2xl border border-ligne bg-surface ps-11 pe-11 shadow-carte outline-none transition placeholder:text-encre-pale focus:border-encre [&::-webkit-search-cancel-button]:hidden text-champs-equipe"
          />
          {recherche && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              aria-label={t("fermerRecherche")}
              className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-encre-pale transition hover:bg-creux hover:text-encre"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      <div className="mt-8 md:grid md:grid-cols-[230px_minmax(0,1fr)] md:gap-10">
        <Sommaire groupes={groupes} actif={requete ? "" : actif} libelle={t("sommaire")} onChoisir={choisir} />

        <div className="min-w-0">
          {entrees.length === 0 && (
            <p className="texte-details-equipe rounded-[24px] border border-ligne bg-surface px-5 py-10 text-center text-details-equipe">
              {t("aucunResultat", { q: recherche.trim() })}
            </p>
          )}

          {/* L'hôtel : chaque section s'enregistre seule */}
          <div className="space-y-6">
            {sectionsHotel.map((section) => (
              <SectionFormulaire
                key={section.id}
                id={section.id}
                icone={section.icone}
                titre={section.titre}
                description={t(section.description)}
                action={enregistrerInformations}
                cachees={{ section: section.id }}
                requete={requete}
                masquee={!affichee(section.id, section.visible)}
                t={t}
              >
                <div className="divide-y divide-ligne">
                  {section.champs.map((champ) => (
                    <Champ
                      key={champ.nom}
                      definition={champ}
                      valeur={valeurs[champ.nom] ?? ""}
                      masque={!section.champsVisibles.has(champ.nom)}
                      t={t}
                    />
                  ))}
                </div>
              </SectionFormulaire>
            ))}
          </div>

          {/* Connaissances de l'assistant : il ne répond qu'à partir de ces fiches */}
          <div
            hidden={!fichesVues.some((fiche) => affichee(idFiche(fiche.id), fiche.visible))}
            className={sectionsHotel.some((section) => affichee(section.id, section.visible)) ? "mt-12" : ""}
          >
            <h2 className="texte-sous-titres-equipe leading-tight text-sous-titres-equipe">
              {t("groupeConnaissances", { assistant: nomAssistant })}
            </h2>
            <p className="texte-details-equipe mt-1 max-w-[70ch] text-details-equipe">{t("informationsExplication")}</p>
            <div className="mt-6 space-y-6">
              {fichesVues.map((fiche) => (
                <FicheDocument
                  key={fiche.id}
                  fiche={fiche}
                  requete={requete}
                  masquee={!affichee(idFiche(fiche.id), fiche.visible)}
                  nomAssistant={nomAssistant}
                  t={t}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FicheDocument({
  fiche,
  requete,
  masquee,
  nomAssistant,
  t,
}: {
  fiche: FicheConnaissance & { occurrences: number };
  requete: string;
  masquee: boolean;
  nomAssistant: string;
  t: TraduireEquipe;
}) {
  const lignes = fiche.contenu.split("\n").length;
  return (
    <SectionFormulaire
      id={idFiche(fiche.id)}
      icone={ICONES_DOCUMENT[fiche.type]}
      titre={fiche.titre}
      description={
        fiche.occurrences > 0 ? (
          <span className="font-medium text-encre">{t("occurrencesFiche", { n: fiche.occurrences })}</span>
        ) : undefined
      }
      badge={
        fiche.aVerifier && (
          <span className="texte-etiquettes-equipe rounded-full bg-accent-pale px-2.5 py-0.5 uppercase text-accent-profond">
            {t("aVerifier")}
          </span>
        )
      }
      action={enregistrerDocument}
      cachees={{ documentId: fiche.id }}
      requete={requete}
      masquee={masquee}
      aValider={fiche.aVerifier}
      t={t}
    >
      {fiche.aVerifier && (
        <p className="texte-courant-equipe mb-4 flex items-start gap-2.5 rounded-2xl bg-accent-pale px-4 py-3 text-accent-profond">
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("aideFicheAVerifier", { assistant: nomAssistant })}
        </p>
      )}
      <textarea
        name="contenu"
        defaultValue={fiche.contenu}
        aria-label={fiche.titre}
        rows={Math.min(26, Math.max(6, lignes + 1))}
        className="texte-champs-equipe w-full resize-y rounded-2xl border border-ligne bg-fond px-4 py-3 leading-relaxed outline-none transition focus:border-encre aria-invalid:border-alerte text-champs-equipe"
      />
    </SectionFormulaire>
  );
}

/** Sommaire : colonne collante sur ordinateur, onglets défilants collés sous l'en-tête sur téléphone. */
function Sommaire({
  groupes,
  actif,
  libelle,
  onChoisir,
}: {
  groupes: { titre: string; entrees: EntreeSommaire[] }[];
  actif: string;
  libelle: string;
  onChoisir: (id: string) => void;
}) {
  const bandeau = useRef<HTMLDivElement>(null);

  // Sur téléphone, l'onglet actif reste visible dans le bandeau (sans faire défiler la page)
  useEffect(() => {
    const conteneur = bandeau.current;
    const onglet = conteneur?.querySelector<HTMLElement>(`[data-cible="${actif}"]`);
    if (!conteneur || !onglet) return;
    const gauche = onglet.offsetLeft - (conteneur.clientWidth - onglet.offsetWidth) / 2;
    conteneur.scrollTo({ left: gauche, behavior: "smooth" });
  }, [actif]);

  const aller = (id: string) => (evenement: React.MouseEvent) => {
    evenement.preventDefault();
    onChoisir(id);
  };

  return (
    <>
      {/* Téléphone */}
      <nav
        aria-label={libelle}
        className="sticky top-[68px] z-10 -mx-5 mb-6 border-b border-ligne bg-fond/90 backdrop-blur-xl md:hidden"
      >
        <div ref={bandeau} className="flex gap-2 overflow-x-auto px-5 py-2.5 [scrollbar-width:none]">
          {groupes
            .flatMap((groupe) => groupe.entrees)
            .map((entree) => (
              <a
                key={entree.id}
                href={`#${entree.id}`}
                data-cible={entree.id}
                onClick={aller(entree.id)}
                className={`texte-boutons-equipe relative flex h-9 shrink-0 items-center rounded-full px-3.5 transition ${
                  actif === entree.id
                    ? "bg-selection text-texte-selection"
                    : "border border-ligne bg-surface text-encre-douce"
                }`}
              >
                {entree.titre}
                {entree.aValider && <PointAValider />}
              </a>
            ))}
        </div>
      </nav>

      {/* Ordinateur */}
      <nav aria-label={libelle} className="hidden md:block">
        <div className="sticky top-24 space-y-6">
          {groupes
            .filter((groupe) => groupe.entrees.length > 0)
            .map((groupe) => (
              <div key={groupe.titre}>
                <p className="texte-sections-equipe px-3 uppercase text-sections-equipe">{groupe.titre}</p>
                <ul className="mt-2 space-y-0.5">
                  {groupe.entrees.map(({ id, titre, icone: Icone, aValider }) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        onClick={aller(id)}
                        aria-current={actif === id ? "location" : undefined}
                        className={`texte-libelles-equipe flex items-center gap-2.5 rounded-xl px-3 py-2 transition ${
                          actif === id
                            ? "bg-nav-actif text-texte-nav-actif"
                            : "text-encre-douce hover:bg-creux/70 hover:text-encre"
                        }`}
                      >
                        <Icone className="size-4 shrink-0" strokeWidth={2.3} aria-hidden />
                        <span className="min-w-0 flex-1 truncate" title={titre}>
                          {titre}
                        </span>
                        {aValider && <PointAValider />}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </nav>
    </>
  );
}

const PointAValider = () => <span className="ms-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />;
