// Police, taille et couleur de chaque texte, côté client et côté équipe, réglées par la direction.
// Partagé client / serveur, sans dépendance : les fichiers de police sont déclarés dans
// lib/polices.ts (chacun expose la variable CSS --police-<id>, posée sur <html>).

const HEXA = /^#[0-9a-fA-F]{6}$/;

/** Espacement des lettres, en centièmes de em (0 = celui de la police) : de serré à très aéré. */
export const ESPACEMENT_MIN = -5;
export const ESPACEMENT_MAX = 30;

export type FamillePolice = "elegant" | "moderne" | "affirme" | "manuscrit" | "ludique";

export type DefinitionPolice = {
  id: string;
  nom: string; // nom affiché dans les réglages
  famille: FamillePolice;
  poids: number; // graisse retenue : celle qui rend le mieux à l'écran
  variable: string; // variable CSS de la police (posée sur <html>)
};

const police = (id: string, nom: string, famille: FamillePolice, poids: number, variable = `--police-${id}`) => ({
  id,
  nom,
  famille,
  poids,
  variable,
});

/** 25 styles très variés, rangés par famille (dont la police du téléphone, celle des messages d'origine). */
export const POLICES: DefinitionPolice[] = [
  // Élégant : empattements, maison soignée
  police("instrument", "Instrument Serif", "elegant", 400, "--police-titre"),
  police("playfair", "Playfair Display", "elegant", 700),
  police("cormorant", "Cormorant Garamond", "elegant", 700),
  police("dmserif", "DM Serif Display", "elegant", 400),
  police("fraunces", "Fraunces", "elegant", 700),
  police("lora", "Lora", "elegant", 600),
  // Moderne : sans empattements, net et très lisible
  police("systeme", "Police du téléphone", "moderne", 400, "--font-systeme"),
  police("manrope", "Manrope", "moderne", 600, "--police-texte"),
  police("poppins", "Poppins", "moderne", 600),
  police("montserrat", "Montserrat", "moderne", 700),
  police("outfit", "Outfit", "moderne", 600),
  police("spacegrotesk", "Space Grotesk", "moderne", 600),
  // Affirmé : caractère fort, effet affiche
  police("bebas", "Bebas Neue", "affirme", 400),
  police("oswald", "Oswald", "affirme", 600),
  police("abril", "Abril Fatface", "affirme", 400),
  police("archivoblack", "Archivo Black", "affirme", 400),
  // Manuscrit : écrit à la main, chaleureux
  police("pacifico", "Pacifico", "manuscrit", 400),
  police("dancing", "Dancing Script", "manuscrit", 700),
  police("caveat", "Caveat", "manuscrit", 700),
  police("greatvibes", "Great Vibes", "manuscrit", 400),
  police("kaushan", "Kaushan Script", "manuscrit", 400),
  // Ludique : rond, rétro, décontracté
  police("fredoka", "Fredoka", "ludique", 600),
  police("baloo", "Baloo 2", "ludique", 700),
  police("righteous", "Righteous", "ludique", 400),
  police("specialelite", "Special Elite", "ludique", 400),
];

export const FAMILLES_POLICES: FamillePolice[] = ["elegant", "moderne", "affirme", "manuscrit", "ludique"];

const POLICES_PAR_ID = new Map(POLICES.map((definition) => [definition.id, definition]));

export type Interface = "client" | "equipe";

/** Les fenêtres du client : chacune a ses propres réglages de textes, appliqués à l'intérieur d'elle seule. */
export type Fenetre = "repas" | "services" | "activites" | "infos";

/** Les endroits où se trouvent les textes : on choisit l'endroit, puis le texte. */
export type GroupeTexte =
  | "accueil"
  | "menu"
  | "conversation"
  | Fenetre
  | "navigation"
  | "tableauEquipe"
  | "cerclesEquipe"
  | "pages"
  | "demandes"
  | "formulaires";

type RoleGlobal =
  | "nomAssistant"
  | "rubriquesAccueil"
  | "titreMenu"
  | "rubriquesMenu"
  | "detailsMenu"
  | "messages"
  | "titresCartes"
  | "textesCartes"
  | "prix"
  | "boutons"
  | "nomHotel"
  | "tuilesEquipe"
  | "rubriquesTableau"
  | "titresEquipe"
  | "sousTitresEquipe"
  | "sectionsEquipe"
  | "detailsEquipe"
  | "courantEquipe"
  | "numeros"
  | "textesEquipe"
  | "servicesEquipe"
  | "etiquettesEquipe"
  | "libellesEquipe"
  | "champsEquipe"
  | "boutonsEquipe";

/** Les sortes de textes d'une fenêtre (titre, catégories, noms…) : chacune a sa classe .texte-* (globals.css). */
export type GenreTexte =
  | "titre"
  | "categories"
  | "noms"
  | "nomsActivites"
  | "descriptions"
  | "prix"
  | "boutons"
  | "wifiReseau"
  | "wifiMotDePasse"
  | "horaires";

/** Les textes de chaque fenêtre, dans l'ordre où ils y apparaissent. */
export const GENRES_PAR_FENETRE = {
  repas: ["titre", "categories", "noms", "descriptions", "prix", "boutons"],
  services: ["titre", "noms", "descriptions", "categories", "prix", "boutons"],
  activites: ["titre", "categories", "nomsActivites", "descriptions", "prix", "boutons"],
  infos: ["titre", "categories", "noms", "descriptions", "wifiReseau", "wifiMotDePasse", "horaires"],
} as const satisfies Record<Fenetre, readonly GenreTexte[]>;

type RoleFenetre = { [F in Fenetre]: `${F}.${(typeof GENRES_PAR_FENETRE)[F][number]}` }[Fenetre];

export type RoleTexte = RoleGlobal | RoleFenetre;

// couleur : null = couleur d'origine (celle de l'interface, qui suit les couleurs de l'hôtel) ;
// espacement : entre les lettres, en centièmes de em
export type StyleTexte = { police: string; taille: number; espacement: number; couleur: string | null };
export type Typographie = Record<RoleTexte, StyleTexte>;

type DefinitionRole = {
  groupe: GroupeTexte;
  genre?: GenreTexte; // textes d'une fenêtre : leur sorte (libellé et exemple des réglages)
  prefixe: string; // variables CSS --police-<prefixe>, --poids-, --taille-, --couleur- (globals.css)
  defaut: { police: string; taille: number; espacement: number };
  min: number;
  max: number;
  // Graisse imposée (texte courant) ; sinon celle de la police, qui la met le mieux en valeur
  poids?: number;
  poidsOrigine?: number; // graisse d'origine, gardée tant que la police d'origine l'est (globals.css)
  // Texte dont la couleur dit quelque chose (pastille rouge, texte sur bouton) : couleur non réglable
  sansCouleur?: boolean;
};

type Options = { poids?: number; poidsOrigine?: number; espacement?: number; sansCouleur?: boolean };

const role = (
  groupe: GroupeTexte,
  prefixe: string,
  police: string,
  taille: number,
  min: number,
  max: number,
  { espacement = 0, ...graisse }: Options = {},
): DefinitionRole => ({ groupe, prefixe, defaut: { police, taille, espacement }, min, max, ...graisse });

/** Style d'origine de chaque sorte de texte des fenêtres : le même pour toutes les fenêtres. */
const GENRES: Record<GenreTexte, Omit<DefinitionRole, "groupe" | "genre">> = {
  titre: role("repas", "titres", "instrument", 28, 20, 38),
  categories: role("repas", "sections", "manrope", 13, 11, 17, { poidsOrigine: 700, espacement: 14 }),
  noms: role("repas", "intitules", "manrope", 16, 14, 22, { poidsOrigine: 700 }),
  nomsActivites: role("repas", "titres-cartes", "instrument", 22, 17, 30),
  descriptions: role("repas", "secondaires", "manrope", 14, 12, 17, { poids: 400 }),
  prix: role("repas", "prix", "manrope", 15, 13, 20, { poidsOrigine: 600 }),
  boutons: role("repas", "boutons", "manrope", 16, 14, 20, { poidsOrigine: 600 }),
  wifiReseau: role("repas", "wifi-reseau", "manrope", 24, 18, 32, { poidsOrigine: 700, espacement: 3 }),
  wifiMotDePasse: role("repas", "wifi-mot-de-passe", "manrope", 24, 18, 32, { poidsOrigine: 700, espacement: 3 }),
  horaires: role("repas", "valeurs-horaires", "manrope", 16, 13, 20, { poidsOrigine: 800, espacement: 6 }),
};

const ROLES_FENETRES = Object.fromEntries(
  (Object.keys(GENRES_PAR_FENETRE) as Fenetre[]).flatMap((fenetre) =>
    GENRES_PAR_FENETRE[fenetre].map((genre) => [`${fenetre}.${genre}`, { ...GENRES[genre], groupe: fenetre, genre }]),
  ),
) as Record<RoleFenetre, DefinitionRole>;

/**
 * Chaque texte réglable, rangé par endroit (l'ordre est celui des réglages) : son style
 * d'origine et les tailles permises (en px). Le style d'origine reproduit l'interface telle quelle.
 */
export const ROLES_TEXTE: Record<RoleTexte, DefinitionRole> = {
  // Client — en-tête et accueil
  nomAssistant: role("accueil", "nom-assistant", "instrument", 20, 14, 28),
  rubriquesAccueil: role("accueil", "rubriques-accueil", "manrope", 14, 12, 18, { poidsOrigine: 600, espacement: -1 }),
  // Client — menu (son titre est aussi celui du choix de la langue)
  titreMenu: role("menu", "titres", "instrument", 28, 20, 38),
  rubriquesMenu: role("menu", "rubriques-menu", "manrope", 16, 13, 22, { poidsOrigine: 700 }),
  detailsMenu: role("menu", "details-menu", "manrope", 14, 12, 18, { poids: 400 }),
  // Client — conversation
  messages: role("conversation", "messages", "systeme", 16, 14, 20, { poids: 400 }),
  titresCartes: role("conversation", "titres-cartes", "instrument", 22, 17, 30),
  textesCartes: role("conversation", "textes-cartes", "manrope", 16, 13, 20, { poidsOrigine: 500 }),
  prix: role("conversation", "prix", "manrope", 15, 13, 20, { poidsOrigine: 600 }),
  boutons: role("conversation", "boutons", "manrope", 16, 14, 20, { poidsOrigine: 600 }),
  // Client — fenêtres : repas, services, activités, infos
  ...ROLES_FENETRES,
  // Équipe — en-tête et accueil (tableau de bord, destinations)
  nomHotel: role("navigation", "nom-hotel", "manrope", 16, 13, 24, { poidsOrigine: 500 }),
  // Textes du tableau de bord : leur couleur se règle avec leur composant (Design → Apparence)
  rubriquesTableau: role("tableauEquipe", "rubriques-tableau", "manrope", 22, 16, 30, {
    poidsOrigine: 700,
    sansCouleur: true,
  }),
  tuilesEquipe: role("cerclesEquipe", "tuiles-equipe", "manrope", 14, 12, 18, { poidsOrigine: 600 }),
  // Équipe — pages : titres, sections, détails et texte courant
  titresEquipe: role("pages", "titres-equipe", "instrument", 36, 26, 48),
  sousTitresEquipe: role("pages", "sous-titres-equipe", "instrument", 26, 20, 34),
  sectionsEquipe: role("pages", "sections-equipe", "manrope", 12, 10, 16, { poidsOrigine: 700, espacement: 14 }),
  detailsEquipe: role("pages", "details-equipe", "manrope", 14, 12, 18, { poids: 400 }),
  courantEquipe: role("pages", "courant-equipe", "manrope", 15, 13, 19, { poids: 400 }),
  // Équipe — lignes des demandes, des chambres et des avis
  numeros: role("demandes", "numeros", "instrument", 26, 18, 34),
  textesEquipe: role("demandes", "textes-equipe", "manrope", 16, 14, 20, { poidsOrigine: 600 }),
  servicesEquipe: role("demandes", "services-equipe", "manrope", 13, 11, 17, { poidsOrigine: 600 }),
  etiquettesEquipe: role("demandes", "etiquettes-equipe", "manrope", 11, 10, 14, {
    poidsOrigine: 700,
    espacement: 4,
    sansCouleur: true,
  }),
  // Équipe — formulaires et boutons
  libellesEquipe: role("formulaires", "libelles-equipe", "manrope", 14, 12, 17, { poidsOrigine: 600 }),
  champsEquipe: role("formulaires", "champs-equipe", "manrope", 15, 13, 18, { poids: 400 }),
  boutonsEquipe: role("formulaires", "boutons-equipe", "manrope", 14, 12, 18, { poidsOrigine: 600, sansCouleur: true }),
};

export const FENETRES = Object.keys(GENRES_PAR_FENETRE) as Fenetre[];
const estFenetre = (groupe: GroupeTexte): groupe is Fenetre => (FENETRES as GroupeTexte[]).includes(groupe);

export const GROUPES_PAR_INTERFACE: Record<Interface, GroupeTexte[]> = {
  client: ["accueil", "menu", "conversation", ...FENETRES],
  equipe: ["navigation", "tableauEquipe", "cerclesEquipe", "pages", "demandes", "formulaires"],
};

const TOUS_LES_ROLES = Object.keys(ROLES_TEXTE) as RoleTexte[];

export const rolesDuGroupe = (groupe: GroupeTexte) =>
  TOUS_LES_ROLES.filter((cle) => ROLES_TEXTE[cle].groupe === groupe);

export const ROLES_PAR_INTERFACE: Record<Interface, RoleTexte[]> = {
  client: GROUPES_PAR_INTERFACE.client.flatMap(rolesDuGroupe),
  equipe: GROUPES_PAR_INTERFACE.equipe.flatMap(rolesDuGroupe),
};

export const styleOrigine = (role: RoleTexte): StyleTexte => ({ ...ROLES_TEXTE[role].defaut, couleur: null });

/**
 * Style valide d'un texte : police connue, taille et espacement entiers dans leurs bornes,
 * couleur « #rrggbb » ou d'origine. Un réglage absent (enregistré avant l'espacement) reprend l'origine.
 */
export function styleValide(role: RoleTexte, valeur: unknown): StyleTexte {
  const { defaut, min, max } = ROLES_TEXTE[role];
  const brut = (valeur ?? {}) as Partial<Record<keyof StyleTexte, unknown>>;
  const taille = Number(brut.taille);
  const espacement = Number(brut.espacement);
  return {
    police: typeof brut.police === "string" && POLICES_PAR_ID.has(brut.police) ? brut.police : defaut.police,
    taille: Number.isInteger(taille) && taille >= min && taille <= max ? taille : defaut.taille,
    espacement:
      brut.espacement !== undefined &&
      Number.isInteger(espacement) &&
      espacement >= ESPACEMENT_MIN &&
      espacement <= ESPACEMENT_MAX
        ? espacement
        : defaut.espacement,
    couleur: typeof brut.couleur === "string" && HEXA.test(brut.couleur) ? brut.couleur.toLowerCase() : null,
  };
}

/** Typographie lue en base (JSON libre) : chaque texte est vérifié, rien d'inconnu ne passe. */
export function lireTypographie(json: unknown): Typographie {
  const brut = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return Object.fromEntries(TOUS_LES_ROLES.map((role) => [role, styleValide(role, brut[role])])) as Typographie;
}

/** Variables CSS de quelques textes : police (et graisse), taille, espacement et couleur choisie. */
function variablesDesRoles(
  typographie: Typographie,
  roles: RoleTexte[],
  couleurOrigine: string | null,
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const role of roles) {
    const { prefixe, poids, poidsOrigine, defaut } = ROLES_TEXTE[role];
    const { police: id, taille, espacement, couleur } = typographie[role];
    const definition = POLICES_PAR_ID.get(id) ?? POLICES_PAR_ID.get(defaut.police)!;
    variables[`--police-${prefixe}`] = `var(${definition.variable})`;
    variables[`--poids-${prefixe}`] = String(
      poids ?? (id === defaut.police ? poidsOrigine : undefined) ?? definition.poids,
    );
    variables[`--taille-${prefixe}`] = `${taille}px`;
    variables[`--espacement-${prefixe}`] = `${espacement / 100}em`;
    if (couleur) variables[`--couleur-${prefixe}`] = couleur;
    else if (couleurOrigine) variables[`--couleur-${prefixe}`] = couleurOrigine;
  }
  return variables;
}

/**
 * Variables CSS d'une interface (hors fenêtres) : sans réglage, les classes .texte-* de
 * globals.css gardent le style d'origine.
 */
export function variablesTypographie(typographie: Typographie, interfaceVisee: Interface): Record<string, string> {
  const roles = ROLES_PAR_INTERFACE[interfaceVisee].filter((role) => !estFenetre(ROLES_TEXTE[role].groupe));
  const variables = variablesDesRoles(typographie, roles, null);
  // Le nom de l'assistante garde son italique d'origine avec sa police d'origine seulement
  if (interfaceVisee === "client") {
    variables["--style-nom-assistant"] = typographie.nomAssistant.police === "instrument" ? "italic" : "normal";
  }
  return variables;
}

/**
 * Variables CSS d'une fenêtre, posées sur la fenêtre elle-même : elles priment, à l'intérieur,
 * sur celles de l'interface. Sans couleur choisie, « initial » rend sa couleur d'origine au texte,
 * même si le même genre de texte a une couleur ailleurs (les prix de la conversation, par exemple).
 */
export function variablesFenetre(typographie: Typographie, fenetre: Fenetre): Record<string, string> {
  return variablesDesRoles(typographie, rolesDuGroupe(fenetre), "initial");
}
