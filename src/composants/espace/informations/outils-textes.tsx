"use client";

// Outils du réglage des textes (Design) : l'exemple montré pour chaque texte, le réglage d'un
// texte (taille, espacement, couleur, police) et les aperçus des endroits côté client.
import { Info, Minus, Plus, RotateCcw, UtensilsCrossed } from "lucide-react";
import type { CleTexteEquipe, TraduireEquipe } from "@/lib/i18n/equipe";
import {
  ESPACEMENT_MAX,
  ESPACEMENT_MIN,
  FAMILLES_POLICES,
  GENRES_PAR_FENETRE,
  POLICES,
  ROLES_TEXTE,
  styleOrigine,
  variablesFenetre,
  type FamillePolice,
  type Fenetre,
  type GenreTexte,
  type GroupeTexte,
  type RoleTexte,
  type StyleTexte,
  type Typographie,
} from "@/lib/typographie";

// Couleur proposée quand on quitte la couleur d'origine : l'encre de l'interface
const COULEUR_DEPART = "#1a1b17";

// Textes de l'équipe montrés avec un vrai libellé de l'interface
const EXEMPLES_EQUIPE = {
  tuilesEquipe: "navChambres",
  rubriquesTableau: "ongletCommandes",
  titresEquipe: "notifications",
  detailsEquipe: "detailInformations",
  sectionsEquipe: "historique",
  libellesEquipe: "telephoneReception",
  boutonsEquipe: "enregistrer",
} as const satisfies Partial<Record<RoleTexte, CleTexteEquipe>>;

/**
 * Le texte d'exemple de chaque texte : le vrai nom de l'assistante et de l'hôtel, un vrai numéro
 * de chambre ; le titre d'une fenêtre est son nom, ses noms d'exemple lui sont propres.
 */
export function exempleTexte(
  cle: RoleTexte,
  { nomAssistant, nomHotel, t }: { nomAssistant: string; nomHotel: string; t: TraduireEquipe },
): string {
  if (cle === "nomAssistant") return nomAssistant;
  if (cle === "nomHotel") return nomHotel;
  if (cle === "numeros") return "304";
  if (cle in EXEMPLES_EQUIPE) return t(EXEMPLES_EQUIPE[cle as keyof typeof EXEMPLES_EQUIPE]);
  const { genre, groupe } = ROLES_TEXTE[cle];
  if (genre === "titre") return t(`groupe_${groupe}` as CleTexteEquipe);
  if (genre === "noms") return t(`exemple_noms_${groupe}` as CleTexteEquipe);
  return t(`exemple_${genre ?? cle}` as CleTexteEquipe);
}

/** Le nom d'un texte ; un texte de fenêtre se nomme par sa sorte (« Titre », « Prix »…). */
export function libelleRole(role: RoleTexte, t: TraduireEquipe): string {
  const { genre } = ROLES_TEXTE[role];
  return t((genre ? `genre_${genre}` : `role_${role}`) as CleTexteEquipe);
}

/** Dans un aperçu, le texte en cours de réglage est entouré. */
export const REPERE = "rounded-md outline-2 outline-offset-2 outline-dashed outline-bouton/70";

/** Réglage d'un texte : taille, espacement, couleur, puis la police (chacune montrée avec ce texte). */
export function EditeurStyle({
  role,
  style,
  exemple,
  onModifier,
  t,
}: {
  role: RoleTexte;
  style: StyleTexte;
  exemple: string;
  onModifier: (changement: Partial<StyleTexte>) => void;
  t: TraduireEquipe;
}) {
  const { min, max, sansCouleur } = ROLES_TEXTE[role];
  const origine = styleOrigine(role);
  const modifie =
    style.police !== origine.police ||
    style.taille !== origine.taille ||
    style.espacement !== origine.espacement ||
    style.couleur !== null;
  // Espacement affiché par rapport à celui d'origine : « Normal », « +3 », « −1 »
  const ecartEspacement = style.espacement - origine.espacement;
  const borner = (valeur: number, bas: number, haut: number) => Math.min(haut, Math.max(bas, Math.round(valeur)));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Reglette
          libelle={t("tailleTexte")}
          valeur={`${style.taille} px`}
          actuel={style.taille}
          min={min}
          max={max}
          moins={t("plusPetit")}
          plus={t("plusGrand")}
          onChanger={(taille) => onModifier({ taille: borner(taille, min, max) })}
        />
        {/* Espacement entre les lettres : plus aéré, plus lisible */}
        <Reglette
          libelle={t("espacementTexte")}
          valeur={
            ecartEspacement === 0
              ? t("espacementNormal")
              : `${ecartEspacement > 0 ? "+" : "−"}${Math.abs(ecartEspacement)}`
          }
          actuel={style.espacement}
          min={ESPACEMENT_MIN}
          max={ESPACEMENT_MAX}
          moins={t("moinsEspace")}
          plus={t("plusEspace")}
          onChanger={(espacement) => onModifier({ espacement: borner(espacement, ESPACEMENT_MIN, ESPACEMENT_MAX) })}
        />
        {/* Couleur : libre, ou celle d'origine ; un texte dont la couleur a un sens (pastille, texte sur
            bouton) ou se règle avec son composant n'en a pas ici */}
        {!sansCouleur && (
          <div>
            <p className="texte-libelles-equipe text-libelles-equipe">{t("couleurTexte")}</p>
            <div className="mt-2.5 flex items-center gap-3">
              <input
                type="color"
                value={style.couleur ?? COULEUR_DEPART}
                onChange={(evenement) => onModifier({ couleur: evenement.target.value })}
                aria-label={t("couleurTexte")}
                className="h-10 w-14 shrink-0 cursor-pointer rounded-xl border border-ligne bg-surface p-1"
              />
              <label className="texte-libelles-equipe flex items-center gap-2 text-libelles-equipe">
                <input
                  type="checkbox"
                  checked={style.couleur === null}
                  onChange={(evenement) => onModifier({ couleur: evenement.target.checked ? null : COULEUR_DEPART })}
                  className="size-4 accent-bouton"
                />
                {t("couleurOrigine")}
              </label>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="texte-libelles-equipe text-libelles-equipe">{t("styleTexte")}</p>
          {modifie && (
            <button
              type="button"
              onClick={() => onModifier(origine)}
              className="texte-libelles-equipe flex items-center gap-1.5 text-libelles-equipe transition hover:opacity-75"
            >
              <RotateCcw className="size-3.5" strokeWidth={2.4} />
              {t("styleOrigine")}
            </button>
          )}
        </div>
        <div className="mt-3 space-y-5">
          {FAMILLES_POLICES.map((famille: FamillePolice) => (
            <div key={famille}>
              <p className="texte-sections-equipe uppercase text-sections-equipe">
                {t(`famille_${famille}` as CleTexteEquipe)}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {POLICES.filter((police) => police.famille === famille).map((police) => {
                  const choisie = style.police === police.id;
                  return (
                    <button
                      key={police.id}
                      type="button"
                      onClick={() => onModifier({ police: police.id })}
                      aria-pressed={choisie}
                      className={`flex min-h-[70px] flex-col items-start justify-between gap-1 rounded-xl border px-3 py-2.5 text-start transition active:scale-[0.98] ${
                        choisie ? "border-bouton bg-bouton/[0.06] ring-1 ring-bouton" : "border-ligne bg-surface"
                      }`}
                    >
                      <span
                        className="block max-w-full truncate text-[19px] leading-tight"
                        style={{
                          fontFamily: `var(${police.variable})`,
                          fontWeight: police.poids,
                          letterSpacing: `${style.espacement / 100}em`,
                          color: style.couleur ?? undefined,
                        }}
                      >
                        {exemple}
                      </span>
                      <span className="texte-details-equipe text-details-equipe">{police.nom}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Aperçu d'un endroit (clients, ou textes communs de l'équipe), tel qu'il sera vu. */
export function ApercuTextes({
  groupe,
  styles,
  exemple,
  reperer,
  t,
}: {
  groupe: GroupeTexte;
  styles: Typographie;
  exemple: (role: RoleTexte) => string;
  reperer: (role: RoleTexte) => string;
  t: TraduireEquipe;
}) {
  const carte = "rounded-[18px] border border-ligne bg-surface p-3.5 shadow-carte";
  switch (groupe) {
    case "accueil": {
      // La présentation de Lalla : son nom dans son propre style
      const presentation = t("apercuPresentation", { nom: "\u0000" })
        .split(/(\u0000)/)
        .map((morceau, index) =>
          morceau === "\u0000" ? (
            <span key={index} className={`texte-nom-assistant text-nom-assistant ${reperer("nomAssistant")}`}>
              {exemple("nomAssistant")}
            </span>
          ) : (
            morceau
          ),
        );
      return (
        <div className="space-y-4 p-4">
          <p className="texte-messages w-fit max-w-[95%] rounded-[18px] bg-surface px-3 py-2 leading-[1.4] text-texte-bulle shadow-carte">
            {presentation}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                [exemple("rubriquesAccueil"), UtensilsCrossed],
                [t("apercuTuile2"), Info],
              ] as const
            ).map(([titre, Icone]) => (
              <div key={titre} className="flex flex-col items-center gap-2 text-center">
                <span className="grid size-14 place-items-center rounded-full border border-ligne bg-surface text-bouton shadow-carte">
                  <Icone className="size-6" strokeWidth={2.2} />
                </span>
                <span className={`texte-rubriques-accueil text-rubriques-accueil ${reperer("rubriquesAccueil")}`}>
                  {titre}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "menu":
      return (
        <div className="space-y-3 p-4">
          <p className={`texte-titres text-titres ${reperer("titreMenu")}`}>{exemple("titreMenu")}</p>
          <div className={`${carte} flex items-center gap-3`}>
            <span className="size-10 shrink-0 rounded-2xl bg-bouton/10" />
            <span className="min-w-0">
              <span className={`texte-rubriques-menu block text-rubriques-menu ${reperer("rubriquesMenu")}`}>
                {exemple("rubriquesMenu")}
              </span>
              <span className={`texte-details-menu mt-0.5 block text-details-menu ${reperer("detailsMenu")}`}>
                {exemple("detailsMenu")}
              </span>
            </span>
          </div>
        </div>
      );
    case "conversation":
      return (
        <div className="space-y-3 p-4">
          <p
            className={`texte-messages w-fit max-w-[90%] rounded-[18px] bg-surface px-3 py-2 text-texte-bulle shadow-carte ${reperer("messages")}`}
          >
            {exemple("messages")}
          </p>
          <div className={carte}>
            <p className={`texte-titres-cartes text-titres-cartes ${reperer("titresCartes")}`}>
              {exemple("titresCartes")}
            </p>
            <p className={`texte-textes-cartes mt-2 text-textes-cartes ${reperer("textesCartes")}`}>
              {exemple("textesCartes")}
            </p>
            <p className={`texte-prix mt-2 tabular-nums text-prix ${reperer("prix")}`}>{exemple("prix")}</p>
            <p className="mt-3 flex h-11 items-center justify-center rounded-2xl bg-bouton">
              <span className={`texte-boutons text-boutons ${reperer("boutons")}`}>{exemple("boutons")}</span>
            </p>
          </div>
        </div>
      );
    case "repas":
    case "services":
    case "activites":
    case "infos":
      return <ApercuFenetre fenetre={groupe} styles={styles} exemple={exemple} reperer={reperer} />;
    case "pages":
      return (
        <div className="space-y-2.5 p-4">
          <p className={`texte-titres-equipe text-titres-equipe ${reperer("titresEquipe")}`}>
            {exemple("titresEquipe")}
          </p>
          <p className={`texte-details-equipe text-details-equipe ${reperer("detailsEquipe")}`}>
            {exemple("detailsEquipe")}
          </p>
          <p className={`texte-sous-titres-equipe pt-2 text-sous-titres-equipe ${reperer("sousTitresEquipe")}`}>
            {exemple("sousTitresEquipe")}
          </p>
          <p className={`texte-sections-equipe uppercase text-sections-equipe ${reperer("sectionsEquipe")}`}>
            {exemple("sectionsEquipe")}
          </p>
          <p className={`texte-courant-equipe text-courant-equipe ${reperer("courantEquipe")}`}>
            {exemple("courantEquipe")}
          </p>
        </div>
      );
    default:
      return null;
  }
}

/** Réglage au pas près : moins, glissière, plus ; la valeur lisible en haut à droite. */
function Reglette({
  libelle,
  valeur,
  actuel,
  min,
  max,
  moins,
  plus,
  onChanger,
}: {
  libelle: string;
  valeur: string;
  actuel: number;
  min: number;
  max: number;
  moins: string;
  plus: string;
  onChanger: (valeur: number) => void;
}) {
  const bouton =
    "grid size-10 shrink-0 place-items-center rounded-full border border-ligne bg-surface text-encre transition active:scale-95 disabled:opacity-40";
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="texte-libelles-equipe text-libelles-equipe">{libelle}</p>
        <span className="texte-libelles-equipe tabular-nums text-libelles-equipe">{valeur}</span>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChanger(actuel - 1)}
          disabled={actuel <= min}
          aria-label={moins}
          className={bouton}
        >
          <Minus className="size-4" strokeWidth={2.4} />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={actuel}
          onChange={(evenement) => onChanger(Number(evenement.target.value))}
          aria-label={libelle}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-bouton"
        />
        <button
          type="button"
          onClick={() => onChanger(actuel + 1)}
          disabled={actuel >= max}
          aria-label={plus}
          className={bouton}
        >
          <Plus className="size-4" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

/**
 * Aperçu d'une fenêtre (repas, services, activités, infos) avec ses propres réglages,
 * posés sur l'aperçu comme sur la vraie fenêtre.
 */
function ApercuFenetre({
  fenetre,
  styles,
  exemple,
  reperer,
}: {
  fenetre: Fenetre;
  styles: Typographie;
  exemple: (role: RoleTexte) => string;
  reperer: (role: RoleTexte) => string;
}) {
  const carte = "rounded-[18px] border border-ligne bg-surface p-3.5 shadow-carte";
  // Le texte d'une sorte donnée de cette fenêtre, avec sa classe et son repère
  const texte = (genre: GenreTexte, classes: string, balise: "p" | "span" = "p") => {
    const role = `${fenetre}.${genre}` as RoleTexte;
    const Balise = balise;
    return <Balise className={`${classes} ${reperer(role)}`}>{exemple(role)}</Balise>;
  };
  const a = (genre: GenreTexte) => (GENRES_PAR_FENETRE[fenetre] as readonly GenreTexte[]).includes(genre);

  return (
    <div className="space-y-3 p-4" style={variablesFenetre(styles, fenetre) as React.CSSProperties}>
      {texte("titre", "texte-titres text-titres")}
      {a("categories") && texte("categories", "texte-sections uppercase text-sections")}
      {a("nomsActivites") ? (
        <div className="rounded-[18px] bg-encre p-3.5 shadow-carte">
          {texte("nomsActivites", "texte-titres-cartes block text-white", "span")}
          {texte("descriptions", "texte-secondaires mt-1 block text-white/80", "span")}
          {texte("prix", "texte-prix mt-1.5 block tabular-nums text-white/90", "span")}
        </div>
      ) : (
        <div className={carte}>
          <div className="flex items-center justify-between gap-3">
            {texte("noms", "texte-intitules text-intitules")}
            {a("horaires") && texte("horaires", "texte-valeurs-horaires tabular-nums text-valeurs-horaires", "span")}
          </div>
          {texte("descriptions", "texte-secondaires mt-1 text-secondaires")}
          {a("prix") && texte("prix", "texte-prix mt-2 tabular-nums text-prix")}
        </div>
      )}
      {a("wifiReseau") && (
        <div className={carte}>
          {texte("wifiReseau", "texte-wifi-reseau text-wifi-reseau")}
          {texte("wifiMotDePasse", "texte-wifi-mot-de-passe mt-2 text-wifi-mot-de-passe")}
        </div>
      )}
      {a("boutons") && (
        <p className="flex h-12 items-center justify-center rounded-2xl bg-bouton">
          {texte("boutons", "texte-boutons text-boutons", "span")}
        </p>
      )}
    </div>
  );
}
