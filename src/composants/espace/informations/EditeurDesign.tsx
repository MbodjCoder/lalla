"use client";

// « Design », rangé par endroit : on choisit l'interface (clients ou équipe), puis l'endroit
// (Accueil, Notifications, Menu…). Chaque endroit montre son aperçu en direct, ses couleurs
// (fond, icône, texte de chaque composant) et ses textes (police, taille, espacement, couleur).
// Tout s'enregistre d'un seul geste : les valeurs de tous les endroits partent ensemble.
import {
  BedDouble,
  Bell,
  BookOpenText,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ConciergeBell,
  House,
  Info,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MessageCircleQuestion,
  Mountain,
  Palette,
  PanelTop,
  Settings,
  Star,
  Type,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { couleursCercle, type CleCercle } from "@/composants/espace/CerclesNavigation";
import { couleursBouton } from "@/composants/espace/TableauNotifications";
import {
  PALETTES_ACCUEIL,
  SECTIONS_COULEURS_EQUIPE,
  variablesComposantsEquipe,
  variablesPage,
  type CouleursEquipe,
  type EntreeCouleurEquipe,
  type PageEquipe,
} from "@/lib/couleurs";
import type { CleTexteEquipe, TraduireEquipe } from "@/lib/i18n/equipe";
import {
  POLICES,
  ROLES_PAR_INTERFACE,
  rolesDuGroupe,
  variablesTypographie,
  type GroupeTexte,
  type Interface,
  type RoleTexte,
  type StyleTexte,
  type Typographie,
} from "@/lib/typographie";
import { ApercuTextes, EditeurStyle, exempleTexte, libelleRole, REPERE } from "./outils-textes";
import { SectionApparence, type CouleursHotel } from "./SectionApparence";
import { useSection } from "./SectionFormulaire";

type Endroit = {
  id: string;
  libelle: CleTexteEquipe;
  icone: LucideIcon;
  couleurs?: string; // section de SECTIONS_COULEURS_EQUIPE
  textes?: GroupeTexte;
  page?: PageEquipe;
  generales?: boolean; // couleurs générales des clients (accent, boutons, messages…)
};

/** Les endroits de chaque interface, dans l'ordre où on les rencontre. */
const ENDROITS: Record<Interface, Endroit[]> = {
  client: [
    { id: "generales", libelle: "couleursGenerales", icone: Palette, generales: true },
    { id: "accueil", libelle: "groupe_accueil", icone: House, textes: "accueil" },
    { id: "menu", libelle: "groupe_menu", icone: Menu, textes: "menu" },
    { id: "conversation", libelle: "groupe_conversation", icone: MessageCircle, textes: "conversation" },
    { id: "repas", libelle: "groupe_repas", icone: UtensilsCrossed, textes: "repas" },
    { id: "services", libelle: "groupe_services", icone: ConciergeBell, textes: "services" },
    { id: "activites", libelle: "groupe_activites", icone: Mountain, textes: "activites" },
    { id: "infos", libelle: "groupe_infos", icone: Info, textes: "infos" },
  ],
  equipe: [
    {
      id: "accueilEquipe",
      libelle: "navAccueil",
      icone: LayoutDashboard,
      couleurs: "navAccueil",
      textes: "tableauEquipe",
    },
    { id: "hotel", libelle: "navHotel", icone: Building2, couleurs: "navHotel", textes: "cerclesEquipe" },
    {
      id: "notifications",
      libelle: "notifications",
      icone: Bell,
      couleurs: "notifications",
      textes: "demandes",
      page: "notifications",
    },
    { id: "chambres", libelle: "navChambres", icone: BedDouble, couleurs: "navChambres", page: "chambres" },
    { id: "carte", libelle: "carteTitre", icone: BookOpenText, couleurs: "carteTitre", page: "carte" },
    {
      id: "parametres",
      libelle: "parametres",
      icone: Settings,
      couleurs: "parametres",
      textes: "formulaires",
      page: "parametres",
    },
    { id: "pages", libelle: "groupe_pages", icone: Type, textes: "pages" },
    {
      id: "navigation",
      libelle: "navigationEquipe",
      icone: PanelTop,
      couleurs: "navigationEquipe",
      textes: "navigation",
    },
  ],
};

const ENTREES = SECTIONS_COULEURS_EQUIPE.flatMap(({ entrees }) => entrees);

// Couleur proposée quand on quitte l'origine : proche de celle que la partie a sans réglage
const depart = ({ cle, partie }: EntreeCouleurEquipe) =>
  cle === "pastilles"
    ? "#b5483b"
    : cle === "tableau"
      ? "#1a1b17"
      : partie === "partie_fond" || partie === "composant_ongletActif"
        ? "#ffffff"
        : "#1a1b17";

type EtatCouleur = { auto: boolean; couleur: string };

export function EditeurDesign({
  typographie,
  couleurs,
  couleursEquipe,
  nomAssistant,
  nomHotel,
  t,
}: {
  typographie: Typographie;
  couleurs: CouleursHotel;
  couleursEquipe: CouleursEquipe;
  nomAssistant: string;
  nomHotel: string;
  t: TraduireEquipe;
}) {
  const { refuses } = useSection();
  const [styles, setStyles] = useState(typographie);
  const [etats, setEtats] = useState<Record<string, EtatCouleur>>(() =>
    Object.fromEntries(
      ENTREES.map((entree) => [
        entree.cle,
        { auto: couleursEquipe[entree.cle] === null, couleur: couleursEquipe[entree.cle] ?? depart(entree) },
      ]),
    ),
  );
  const [interfaceActive, setInterfaceActive] = useState<Interface>("equipe");
  const [idEndroit, setIdEndroit] = useState<string | null>(null);
  const [roleOuvert, setRoleOuvert] = useState<RoleTexte | null>(null);

  const endroit = ENDROITS[interfaceActive].find(({ id }) => id === idEndroit) ?? null;
  const valeurs: CouleursEquipe = Object.fromEntries(
    ENTREES.map(({ cle }) => [cle, etats[cle].auto ? null : etats[cle].couleur]),
  );
  const exemple = (role: RoleTexte) => exempleTexte(role, { nomAssistant, nomHotel, t });
  const reperer = (role: RoleTexte) => (role === roleOuvert ? REPERE : "");
  const ouvrir = (id: string | null) => {
    setIdEndroit(id);
    setRoleOuvert(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const roleRefuse = (role: RoleTexte) => refuses.some((champ) => champ.endsWith(`_${role}`));

  return (
    <div>
      {/* Valeurs envoyées à l'enregistrement : tous les endroits, quel que soit celui ouvert */}
      {[...ROLES_PAR_INTERFACE.client, ...ROLES_PAR_INTERFACE.equipe].map((role) => (
        <span key={role} hidden>
          <input type="hidden" name={`police_${role}`} value={styles[role].police} />
          <input type="hidden" name={`taille_${role}`} value={styles[role].taille} />
          <input type="hidden" name={`espacement_${role}`} value={styles[role].espacement} />
          <input type="hidden" name={`couleur_${role}`} value={styles[role].couleur ?? ""} />
        </span>
      ))}
      {ENTREES.map(({ cle }) => (
        <span key={cle} hidden>
          <input type="hidden" name={`equipe_${cle}`} value={etats[cle].couleur} />
          {etats[cle].auto && <input type="hidden" name={`equipe_${cle}Auto`} value="1" />}
        </span>
      ))}

      {/* Couleurs générales des clients : toujours là (leurs champs partent aussi), visibles dans leur endroit */}
      <div hidden={!endroit?.generales}>
        <EnTeteEndroit endroit={ENDROITS.client[0]} onRetour={() => ouvrir(null)} t={t} />
        <div className="mt-5">
          <SectionApparence couleurs={couleurs} t={t} />
        </div>
      </div>

      {!endroit ? (
        <>
          {/* L'interface, puis l'endroit */}
          <div role="tablist" className="mx-auto grid max-w-sm grid-cols-2 gap-1 rounded-2xl bg-creux p-1">
            {(["client", "equipe"] as const).map((choix) => (
              <button
                key={choix}
                type="button"
                role="tab"
                aria-selected={interfaceActive === choix}
                onClick={() => setInterfaceActive(choix)}
                className={`texte-boutons-equipe h-11 rounded-xl transition ${
                  interfaceActive === choix ? "bg-surface text-encre shadow-carte" : "text-encre-douce hover:text-encre"
                }`}
              >
                {t(choix === "client" ? "interfaceClient" : "interfaceEquipe")}
              </button>
            ))}
          </div>
          <ul className="mt-5 divide-y divide-ligne overflow-hidden rounded-2xl border border-ligne">
            {ENDROITS[interfaceActive].map(({ id, libelle, icone: Icone }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => ouvrir(id)}
                  className="flex w-full items-center gap-3.5 bg-surface px-4 py-3.5 text-start transition hover:bg-creux/50 active:bg-creux"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bouton/10 text-bouton">
                    <Icone className="size-5" strokeWidth={2.3} aria-hidden />
                  </span>
                  <span className="texte-textes-equipe min-w-0 flex-1 text-textes-equipe">{t(libelle)}</span>
                  <ChevronRight className="size-5 shrink-0 text-encre-pale rtl:-scale-x-100" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : endroit.generales ? null : (
        <>
          <EnTeteEndroit endroit={endroit} onRetour={() => ouvrir(null)} t={t} />

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Aperçu : toujours visible en réglant (collé en haut sur téléphone, à droite sur grand écran) */}
            <div
              aria-hidden
              style={{
                ...(variablesTypographie(styles, interfaceActive) as React.CSSProperties),
                ...variablesComposantsEquipe(valeurs, "initial"),
                ...(endroit.page ? variablesPage(endroit.page) : {}),
              }}
              className="sticky top-[8.75rem] z-[5] h-fit overflow-hidden rounded-[22px] border border-ligne bg-fond shadow-carte lg:top-40 lg:order-last"
            >
              <p className="texte-sections-equipe px-4 pt-3 uppercase text-sections-equipe">{t("apercu")}</p>
              {interfaceActive === "client" || endroit.id === "pages" ? (
                <ApercuTextes groupe={endroit.textes!} styles={styles} exemple={exemple} reperer={reperer} t={t} />
              ) : (
                <ApercuEquipe endroit={endroit} exemple={exemple} reperer={reperer} t={t} />
              )}
            </div>

            <div className="min-w-0 space-y-7">
              {endroit.id === "accueilEquipe" && (
                <section>
                  <h3 className="texte-sections-equipe uppercase text-sections-equipe">{t("palettesSuggerees")}</h3>
                  {/* Un toucher remplit les couleurs de l'accueil ; l'aperçu les montre, « Enregistrer » les garde */}
                  <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {PALETTES_ACCUEIL.map(({ cle, couleurs }) => {
                      const choisie = Object.entries(couleurs).every(
                        ([entree, couleur]) => !etats[entree].auto && etats[entree].couleur === couleur,
                      );
                      return (
                        <button
                          key={cle}
                          type="button"
                          aria-pressed={choisie}
                          onClick={() =>
                            setEtats((actuels) => ({
                              ...actuels,
                              ...Object.fromEntries(
                                Object.entries(couleurs).map(([entree, couleur]) => [entree, { auto: false, couleur }]),
                              ),
                            }))
                          }
                          className={`rounded-2xl border bg-surface p-2 text-start transition active:scale-[0.97] ${
                            choisie ? "border-bouton ring-2 ring-bouton" : "border-ligne hover:border-encre/25"
                          }`}
                        >
                          <span className="flex h-12 items-end gap-1 rounded-xl bg-creux p-1.5">
                            {[0, 1, 2].map((rang) => (
                              <span
                                key={rang}
                                className="grid h-6 flex-1 place-items-center rounded-md"
                                style={{ backgroundColor: couleurs.commandesFond }}
                              >
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: couleurs.commandesIcone }}
                                />
                              </span>
                            ))}
                          </span>
                          <span className="texte-courant-equipe mt-1.5 block truncate px-0.5 text-courant-equipe">
                            {t(`palette_${cle}` as CleTexteEquipe)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {endroit.couleurs && (
                <section>
                  <h3 className="texte-sections-equipe uppercase text-sections-equipe">{t("couleurs")}</h3>
                  <div className="mt-3 space-y-4">
                    {composantsDe(endroit.couleurs).map(({ composant, parties }) => (
                      <div key={composant}>
                        <p className="texte-libelles-equipe text-libelles-equipe">{t(composant as CleTexteEquipe)}</p>
                        <ul className="mt-1.5 divide-y divide-ligne rounded-xl bg-creux/60 px-3">
                          {parties.map((entree) => (
                            <LigneCouleur
                              key={entree.cle}
                              libelle={t(entree.partie as CleTexteEquipe)}
                              nom={`${t(composant as CleTexteEquipe)} · ${t(entree.partie as CleTexteEquipe)}`}
                              etat={etats[entree.cle]}
                              onChanger={(changement) =>
                                setEtats((actuels) => ({
                                  ...actuels,
                                  [entree.cle]: { ...actuels[entree.cle], ...changement },
                                }))
                              }
                              t={t}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {endroit.textes && (
                <section>
                  <h3 className="texte-sections-equipe uppercase text-sections-equipe">{t("textes")}</h3>
                  <ul className="mt-3 divide-y divide-ligne overflow-hidden rounded-xl border border-ligne">
                    {rolesDuGroupe(endroit.textes).map((role) => {
                      const ouvert = role === roleOuvert;
                      return (
                        <li key={role} className="bg-surface">
                          <button
                            type="button"
                            onClick={() => setRoleOuvert(ouvert ? null : role)}
                            aria-expanded={ouvert}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-start ${
                              roleRefuse(role) ? "bg-alerte/[0.06]" : ""
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="texte-textes-equipe block text-textes-equipe">
                                {libelleRole(role, t)}
                              </span>
                              <span className="texte-details-equipe block truncate text-details-equipe">
                                {resume(styles[role])}
                              </span>
                            </span>
                            {styles[role].couleur && (
                              <span
                                className="size-5 shrink-0 rounded-full border border-ligne"
                                style={{ backgroundColor: styles[role].couleur! }}
                              />
                            )}
                            <ChevronDown
                              className={`size-5 shrink-0 text-encre-pale transition ${ouvert ? "rotate-180" : ""}`}
                              aria-hidden
                            />
                          </button>
                          {ouvert && (
                            <div className="border-t border-ligne px-4 pt-4 pb-5">
                              <EditeurStyle
                                role={role}
                                style={styles[role]}
                                exemple={exemple(role)}
                                onModifier={(changement: Partial<StyleTexte>) =>
                                  setStyles((actuels) => ({ ...actuels, [role]: { ...actuels[role], ...changement } }))
                                }
                                t={t}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Les parties d'un même composant, ensemble (Commandes : fond, icône, texte). */
function composantsDe(section: string) {
  const entrees = SECTIONS_COULEURS_EQUIPE.find((groupe) => groupe.section === section)?.entrees ?? [];
  return entrees.reduce<{ composant: string; parties: EntreeCouleurEquipe[] }[]>((groupes, entree) => {
    const dernier = groupes.at(-1);
    if (dernier?.composant === entree.composant) dernier.parties.push(entree);
    else groupes.push({ composant: entree.composant, parties: [entree] });
    return groupes;
  }, []);
}

/** « Manrope · 14 px » : le style d'un texte d'un coup d'œil. */
const resume = (style: StyleTexte) =>
  `${POLICES.find((police) => police.id === style.police)?.nom ?? style.police} · ${style.taille} px`;

function EnTeteEndroit({ endroit, onRetour, t }: { endroit: Endroit; onRetour: () => void; t: TraduireEquipe }) {
  const Icone = endroit.icone;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onRetour}
        aria-label={t("retour")}
        className="grid size-10 shrink-0 place-items-center rounded-full border border-ligne bg-surface text-black shadow-carte transition active:scale-90"
      >
        <ChevronLeft className="size-5 rtl:-scale-x-100" strokeWidth={2.8} />
      </button>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bouton/10 text-bouton">
        <Icone className="size-5" strokeWidth={2.3} aria-hidden />
      </span>
      <h2 className="texte-sous-titres-equipe min-w-0 truncate text-sous-titres-equipe">{t(endroit.libelle)}</h2>
    </div>
  );
}

/** Une partie colorée : son nom, « Automatique » (couleur d'origine) ou une couleur choisie. */
function LigneCouleur({
  libelle,
  nom,
  etat,
  onChanger,
  t,
}: {
  libelle: string;
  nom: string;
  etat: EtatCouleur;
  onChanger: (changement: Partial<EtatCouleur>) => void;
  t: TraduireEquipe;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="texte-courant-equipe min-w-0 flex-1 text-courant-equipe">{libelle}</span>
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[13px] text-encre-douce">
        <input
          type="checkbox"
          checked={etat.auto}
          onChange={(evenement) => onChanger({ auto: evenement.target.checked })}
          className="size-4 accent-encre"
        />
        {t("automatique")}
      </label>
      <input
        type="color"
        value={etat.couleur}
        disabled={etat.auto}
        onChange={(evenement) => onChanger({ couleur: evenement.target.value })}
        aria-label={nom}
        className="h-9 w-14 shrink-0 cursor-pointer rounded-lg border border-ligne bg-fond px-0.5 disabled:cursor-not-allowed disabled:opacity-40"
      />
    </li>
  );
}

const CARTE = "rounded-[18px] border border-ligne bg-surface shadow-carte";

/** Aperçu d'un endroit de l'équipe, avec les couleurs et les textes en cours de réglage. */
function ApercuEquipe({
  endroit,
  exemple,
  reperer,
  t,
}: {
  endroit: Endroit;
  exemple: (role: RoleTexte) => string;
  reperer: (role: RoleTexte) => string;
  t: TraduireEquipe;
}) {
  switch (endroit.id) {
    case "accueilEquipe":
      return (
        <div className="p-2 pt-1.5">
          <div>
            {/* Comme sur le téléphone de l'équipe : une rubrique par ligne */}
            <div className="grid gap-2">
              {(
                [
                  ["commandes", UtensilsCrossed, t("ongletCommandes"), 2],
                  ["questions", MessageCircleQuestion, t("ongletQuestions"), 0],
                  ["avis", Star, t("avisClients"), 1],
                ] as const
              ).map(([cle, Icone, nom, nombre]) => (
                <span
                  key={cle}
                  style={couleursBouton(cle)}
                  className="flex h-16 items-center gap-4 rounded-2xl bg-bouton-tableau px-4 shadow-carte"
                >
                  <Icone className="size-8 shrink-0 text-icone-bouton-tableau" strokeWidth={2} />
                  <span
                    className={`texte-rubriques-tableau min-w-0 flex-1 truncate text-texte-bouton-tableau ${reperer("rubriquesTableau")}`}
                  >
                    {nom}
                  </span>
                  {nombre > 0 && (
                    <span className="grid h-7 min-w-7 place-items-center rounded-full bg-pastilles px-2 text-[13px] font-bold text-texte-pastilles">
                      {nombre}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    case "hotel": {
      const cercles: [CleCercle, LucideIcon, string][] = [
        ["chambres", BedDouble, t("navChambres")],
        ["carte", BookOpenText, t("carteTitre")],
        ["parametres", Settings, t("parametres")],
      ];
      // Comme dans l'espace : les trois barres de la barre du haut, puis l'écran avec ses trois destinations
      const cercle = ([cle, Icone, nom]: (typeof cercles)[number]) => (
        <span key={cle} style={couleursCercle(cle)} className="flex min-w-0 flex-col items-center gap-1.5">
          <span className="grid size-12 place-items-center rounded-full border border-ligne bg-cercle text-icone-cercle shadow-carte">
            <Icone className="size-5" strokeWidth={2.3} />
          </span>
          <span className={`texte-tuiles-equipe max-w-full truncate text-texte-cercle ${reperer("tuilesEquipe")}`}>
            {nom}
          </span>
        </span>
      );
      return (
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-ligne bg-fond/90 px-3 py-1.5">
            <span className="texte-nom-hotel min-w-0 truncate text-[17px] text-nom-hotel">{exemple("nomHotel")}</span>
            <svg
              viewBox="0 0 24 24"
              className="size-6 shrink-0 text-[var(--eq-hotelIcone,#000000)]"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
            >
              <path d="M2.5 4.5h19M2.5 12h19M2.5 19.5h19" />
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface px-1 py-3 shadow-carte">
            {cercles.map(cercle)}
          </div>
        </div>
      );
    }
    case "navigation":
      return (
        <div className="space-y-4 p-4">
          <p className={`texte-nom-hotel w-fit max-w-full truncate text-nom-hotel ${reperer("nomHotel")}`}>
            {exemple("nomHotel")}
          </p>
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
            <span className="grid size-11 place-items-center rounded-full border border-ligne bg-fleche text-icone-fleche shadow-carte">
              <ChevronLeft className="size-6" strokeWidth={2.8} />
            </span>
            <span className="texte-sous-titres-equipe truncate text-center text-titres-equipe">{t("parametres")}</span>
          </div>
        </div>
      );
    case "parametres":
      return (
        <div className="space-y-3 p-4">
          <p className="texte-sous-titres-equipe text-center text-titres-equipe">{t("parametres")}</p>
          <div className={`${CARTE} space-y-2 p-3.5`}>
            <p className={`texte-libelles-equipe text-libelles-equipe ${reperer("libellesEquipe")}`}>
              {exemple("libellesEquipe")}
            </p>
            <p
              className={`texte-champs-equipe flex h-10 items-center rounded-lg border border-ligne bg-fond px-3 text-champs-equipe ${reperer("champsEquipe")}`}
            >
              {exemple("champsEquipe")}
            </p>
          </div>
          <p className="flex h-10 items-center justify-center rounded-xl bg-bouton">
            <span className={`texte-boutons-equipe text-texte-bouton ${reperer("boutonsEquipe")}`}>
              {exemple("boutonsEquipe")}
            </span>
          </p>
        </div>
      );
    default: {
      // Notifications, Chambres, Carte : titre, onglets, une carte
      // Les pages temporaires de Notifications n'ont pas d'onglets
      const onglets: CleTexteEquipe[] =
        endroit.id === "chambres"
          ? ["ongletDeparts", "ongletOccupees"]
          : endroit.id === "carte"
            ? ["ongletCommandes", "ongletQuestions"]
            : [];
      return (
        <div className="space-y-3 p-4">
          <p className="texte-sous-titres-equipe text-center text-titres-equipe">{t(endroit.libelle)}</p>
          <div hidden={onglets.length === 0} className="flex gap-1 rounded-full bg-fond-onglets p-1">
            {onglets.map((cle, rang) => (
              <span
                key={cle}
                className={`flex h-8 flex-1 items-center justify-center truncate rounded-full px-1 text-[12px] font-semibold ${
                  rang === 0 ? "bg-onglet-actif text-texte-onglet-actif shadow-carte" : "text-encre-douce"
                }`}
              >
                {t(cle)}
              </span>
            ))}
          </div>
          <div className={`${CARTE} flex items-start gap-3 p-3.5`}>
            <span className={`texte-numeros w-11 shrink-0 text-numeros ${reperer("numeros")}`}>
              {exemple("numeros")}
            </span>
            <span className="min-w-0 space-y-2">
              <span className={`texte-textes-equipe block text-textes-equipe ${reperer("textesEquipe")}`}>
                {exemple("textesEquipe")}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`texte-services-equipe inline-flex rounded-full bg-bouton/8 px-2.5 py-1 text-services-equipe ${reperer("servicesEquipe")}`}
                >
                  {exemple("servicesEquipe")}
                </span>
                <span
                  className={`texte-etiquettes-equipe rounded-full bg-alerte px-2 py-0.5 uppercase text-white ${reperer("etiquettesEquipe")}`}
                >
                  {exemple("etiquettesEquipe")}
                </span>
              </span>
            </span>
          </div>
        </div>
      );
    }
  }
}
