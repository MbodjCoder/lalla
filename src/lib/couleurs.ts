// Couleurs propres à chaque hôtel, injectées en variables CSS (voir globals.css).
// Partagé client / serveur : aucune dépendance.

const HEXA = /^#[0-9a-fA-F]{6}$/;

export const FOND_PAR_DEFAUT = "#f7f8f3";

/** Fonds clairs éprouvés, proposés en un clic dans les réglages. */
export const FONDS_SUGGERES = [
  { couleur: FOND_PAR_DEFAUT, nom: "blancCasse" },
  { couleur: "#faf6ee", nom: "ivoire" },
  { couleur: "#f3eee5", nom: "sable" },
  { couleur: "#eff4f1", nom: "sauge" },
  { couleur: "#eef3f8", nom: "brume" },
  { couleur: "#f8f0ee", nom: "rose" },
] as const;

/** Luminance relative WCAG d'une couleur « #rrggbb » (0 = noir, 1 = blanc). */
function luminance(hexa: string): number {
  const [r, g, b] = [1, 3, 5].map((debut) => {
    const canal = parseInt(hexa.slice(debut, debut + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Au-dessous de ce seuil, un texte blanc contraste mieux qu'un texte encre
const SEUIL_FOND_SOMBRE = 0.36;
// Le fond reçoit des cartes blanches et du texte encre : il doit rester clair
const SEUIL_FOND_CLAIR = 0.72;

// Texte en gras sur carte blanche : contraste d'au moins 3:1 (WCAG, texte mis en avant)
const SEUIL_TEXTE_SUR_BLANC = 0.3;

/** La couleur reste-t-elle lisible en texte sur une carte blanche ? */
export function lisibleSurBlanc(couleur: string): boolean {
  return HEXA.test(couleur) && luminance(couleur) <= SEUIL_TEXTE_SUR_BLANC;
}

/** Le fond est-il assez clair pour que cartes, texte et ombres restent lisibles ? */
export function fondAssezClair(couleur: string): boolean {
  return HEXA.test(couleur) && luminance(couleur) >= SEUIL_FOND_CLAIR;
}

export type CouleursHotel = {
  couleurAccent: string;
  couleurMessages?: string | null; // messages de l'assistant
  couleurMessagesClient?: string | null; // messages du client
  couleurFond?: string | null;
  couleurHoraires?: string | null;
  couleurBoutons?: string | null;
  couleurIcones?: string | null;
};

/** Texte lisible (blanc ou noir) sur un fond donné, avec sa variante atténuée (heure, coches). */
function texteSur(fond: string) {
  const sombre = luminance(fond) < SEUIL_FOND_SOMBRE;
  return {
    texte: sombre ? "#ffffff" : "#000000",
    doux: sombre ? "rgb(255 255 255 / 0.72)" : "rgb(26 27 23 / 0.5)",
  };
}

/**
 * Variables CSS d'un hôtel : couleur d'accent, couleurs des messages (assistant et
 * client) et des boutons, chacune avec un texte lisible calculé automatiquement,
 * fond de l'interface client et couleur des heures et du mot de passe Wi-Fi.
 */
export function variablesCouleurs({
  couleurAccent,
  couleurMessages,
  couleurMessagesClient,
  couleurFond,
  couleurHoraires,
  couleurBoutons,
  couleurIcones,
}: CouleursHotel): React.CSSProperties {
  const variables: Record<string, string> = { "--accent-hotel": couleurAccent };
  if (couleurMessages && HEXA.test(couleurMessages)) {
    const { texte, doux } = texteSur(couleurMessages);
    variables["--bulle-hotel"] = couleurMessages;
    variables["--texte-bulle-hotel"] = texte;
    variables["--texte-bulle-doux-hotel"] = doux;
  }
  if (couleurMessagesClient && HEXA.test(couleurMessagesClient)) {
    const { texte, doux } = texteSur(couleurMessagesClient);
    variables["--bulle-client-hotel"] = couleurMessagesClient;
    variables["--texte-bulle-client-hotel"] = texte;
    variables["--texte-bulle-client-doux-hotel"] = doux;
    variables["--coche-lue-hotel"] = texte; // l'accent pourrait se fondre dans la bulle
  }
  if (couleurBoutons && HEXA.test(couleurBoutons)) {
    variables["--bouton-hotel"] = couleurBoutons;
    variables["--texte-bouton-hotel"] = texteSur(couleurBoutons).texte;
  }
  if (couleurFond && fondAssezClair(couleurFond)) variables["--fond-hotel"] = couleurFond;
  if (couleurHoraires && lisibleSurBlanc(couleurHoraires)) variables["--horaires-hotel"] = couleurHoraires;
  if (couleurIcones && lisibleSurBlanc(couleurIcones)) variables["--icones-hotel"] = couleurIcones;
  return variables as React.CSSProperties;
}

/**
 * Espace hôtel (tableau de bord, lien WhatsApp) : seuls la couleur de l'hôtel et les
 * boutons s'appliquent ; sans couleur choisie, les boutons restent couleur encre.
 */
export function variablesEspace(couleurAccent: string, couleurBoutons: string | null): React.CSSProperties {
  return {
    "--bouton-defaut": "#1a1b17",
    ...variablesCouleurs({ couleurAccent, couleurBoutons }),
  } as React.CSSProperties;
}

/** Les pages de l'équipe dont les cartes, les onglets et les textes ont leurs propres couleurs. */
export type PageEquipe = "notifications" | "chambres" | "carte" | "parametres";

/**
 * Une couleur réglable de l'interface de l'équipe : son composant (« Commandes ») et la partie
 * colorée (« Fond »), désignés par leurs clés de libellé ; texteAuto : un texte lisible (blanc ou
 * noir) est calculé sur ce fond.
 */
export type EntreeCouleurEquipe = { cle: string; composant: string; partie: string; texteAuto?: boolean };

// Fond, icône et texte d'un bouton ou d'un cercle
const troisParties = (prefixe: string, composant: string): EntreeCouleurEquipe[] =>
  (["Fond", "Icone", "Texte"] as const).map((partie) => ({
    cle: `${prefixe}${partie}`,
    composant,
    partie: `partie_${partie.toLowerCase()}`,
  }));

// Une rubrique de l'accueil : sur son fond choisi, icône et texte lisibles d'office (s'ils ne sont pas choisis)
const rubriqueAccueil = (prefixe: string, composant: string): EntreeCouleurEquipe[] =>
  troisParties(prefixe, composant).map((entree) =>
    entree.partie === "partie_fond" ? { ...entree, texteAuto: true } : entree,
  );

// Cartes, onglets et textes d'une page
const parPage = (page: PageEquipe, onglets: boolean): EntreeCouleurEquipe[] => [
  { cle: `${page}Cartes`, composant: "composant_cartes", partie: "partie_fond" },
  ...(onglets
    ? [
        { cle: `${page}Onglets`, composant: "composant_onglets", partie: "composant_barre" },
        { cle: `${page}OngletActif`, composant: "composant_onglets", partie: "composant_ongletActif", texteAuto: true },
      ]
    : []),
  { cle: `${page}Titre`, composant: "composant_textes", partie: "composant_titre" },
  { cle: `${page}Textes`, composant: "composant_textes", partie: "partie_autres" },
];

/** Les couleurs réglables, rangées par endroit (clé de libellé de l'endroit), dans l'ordre des réglages. */
export const SECTIONS_COULEURS_EQUIPE: { section: string; entrees: EntreeCouleurEquipe[] }[] = [
  {
    section: "navAccueil",
    entrees: [
      ...rubriqueAccueil("commandes", "ongletCommandes"),
      ...rubriqueAccueil("questions", "ongletQuestions"),
      ...rubriqueAccueil("avis", "avisClients"),
      { cle: "pastilles", composant: "composant_pastilles", partie: "partie_fond", texteAuto: true },
    ],
  },
  {
    section: "navHotel",
    entrees: [
      { cle: "hotelIcone", composant: "composant_boutonHotel", partie: "partie_icone" },
      ...troisParties("chambres", "navChambres"),
      ...troisParties("carte", "carteTitre"),
      ...troisParties("parametres", "parametres"),
    ],
  },
  { section: "notifications", entrees: parPage("notifications", false) },
  { section: "navChambres", entrees: parPage("chambres", true) },
  { section: "carteTitre", entrees: parPage("carte", true) },
  { section: "parametres", entrees: parPage("parametres", false) },
  {
    section: "navigationEquipe",
    entrees: [
      { cle: "flecheFond", composant: "composant_fleche", partie: "partie_fond" },
      { cle: "flecheIcone", composant: "composant_fleche", partie: "partie_icone" },
    ],
  },
];

const ENTREES_EQUIPE = SECTIONS_COULEURS_EQUIPE.flatMap(({ entrees }) => entrees);

// Une palette de l'accueil : rubriques (fond, icône, texte) et pastilles
const palette = (boutons: string, icones: string, textes: string, pastilles: string): Record<string, string> => ({
  ...Object.fromEntries(
    ["commandes", "questions", "avis"].flatMap((bouton) => [
      [`${bouton}Fond`, boutons],
      [`${bouton}Icone`, icones],
      [`${bouton}Texte`, textes],
    ]),
  ),
  pastilles,
});

/**
 * Palettes suggérées pour le tableau de bord, choisies pour leur lisibilité : textes à au moins
 * 7:1 sur leur fond (WCAG AAA), icônes à au moins 4,5:1, pastilles rouges au chiffre blanc à 4,8:1.
 */
export const PALETTES_ACCUEIL = [
  // Celle d'origine : anthracite, or champagne (texte 15:1, icônes 7,6:1), pour tout hôtel
  { cle: "signature", couleurs: palette("#1c2529", "#d4b27a", "#ffffff", "#dc2626") },
  { cle: "nuit", couleurs: palette("#14213d", "#f2c14e", "#ffffff", "#dc2626") },
  { cle: "ardoise", couleurs: palette("#1f2937", "#ffffff", "#f8fafc", "#dc2626") },
  { cle: "emeraude", couleurs: palette("#0f3d3a", "#7ee0c3", "#ffffff", "#dc2626") },
  { cle: "clair", couleurs: palette("#ffffff", "#1d4e89", "#0f172a", "#dc2626") },
] as const;
export const COMPOSANTS_EQUIPE = ENTREES_EQUIPE.map(({ cle }) => cle);

// null : couleur d'origine (celle qui suit les couleurs de l'hôtel)
export type CouleursEquipe = Record<string, string | null>;

// Réglages d'avant (une couleur pour tous les boutons, une pour tous les cercles) : repris tels quels
const ANCIENNES_CLES: Record<string, string> = Object.fromEntries([
  ...["commandes", "questions", "avis"].flatMap((bouton) => [
    [`${bouton}Fond`, "boutonsTableau"],
    [`${bouton}Icone`, "iconesTableau"],
  ]),
  ...["hotel", "chambres", "carte", "parametres"].flatMap((cercle) => [
    [`${cercle}Fond`, "cercles"],
    [`${cercle}Icone`, "iconesCercles"],
  ]),
]);

/** Couleurs des composants lues en base (JSON libre) : seules les couleurs « #rrggbb » passent. */
export function lireCouleursEquipe(json: unknown): CouleursEquipe {
  const brut = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return Object.fromEntries(
    COMPOSANTS_EQUIPE.map((cle) => {
      const valeur = brut[cle] ?? brut[ANCIENNES_CLES[cle]];
      return [cle, typeof valeur === "string" && HEXA.test(valeur) ? valeur.toLowerCase() : null];
    }),
  );
}

/**
 * Variables CSS des composants de l'équipe (--eq-<clé>, et --eq-<clé>-texte pour le texte
 * lisible calculé sur un fond) ; sans couleur choisie, globals.css garde l'origine.
 * « initial » (aperçu des réglages) rend l'origine même sous une couleur déjà enregistrée.
 */
export function variablesComposantsEquipe(
  couleurs: CouleursEquipe,
  sansCouleur: "initial" | null = null,
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const { cle, texteAuto } of ENTREES_EQUIPE) {
    const couleur = couleurs[cle];
    if (couleur) {
      variables[`--eq-${cle}`] = couleur;
      if (texteAuto) variables[`--eq-${cle}-texte`] = texteSur(couleur).texte;
    } else if (sansCouleur) {
      variables[`--eq-${cle}`] = sansCouleur;
      if (texteAuto) variables[`--eq-${cle}-texte`] = sansCouleur;
    }
  }
  return variables;
}

/**
 * Variables posées sur une page de l'équipe : ses cartes, ses onglets et ses textes prennent
 * leurs couleurs. Une couleur non choisie (variable --eq-* absente) laisse celle d'origine.
 */
export function variablesPage(page: PageEquipe): React.CSSProperties {
  return {
    "--color-surface": `var(--eq-${page}Cartes, #ffffff)`,
    "--page-onglets": `var(--eq-${page}Onglets)`,
    "--page-onglet-actif": `var(--eq-${page}OngletActif)`,
    "--page-texte-onglet-actif": `var(--eq-${page}OngletActif-texte)`,
    "--page-titres": `var(--eq-${page}Titre)`,
    "--page-textes": `var(--eq-${page}Textes)`,
  } as React.CSSProperties;
}
