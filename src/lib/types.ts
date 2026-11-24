// Types partagés client / serveur (aucune dépendance serveur ici).

export type TypeDemandeVue = "COMMANDE" | "SERVICE" | "INCIDENT" | "QUESTION";
export type StatutDemandeVue = "PROPOSEE" | "CONFIRMEE" | "PRISE_EN_CHARGE" | "TERMINEE" | "ANNULEE";
export type DepartementVue = "RECEPTION" | "ETAGES" | "RESTAURATION" | "TECHNIQUE" | "CONCIERGERIE" | "BIEN_ETRE";

// Textes multilingues : le français est toujours présent (langue de référence),
// l'anglais pour l'équipe, et la langue choisie par le client.
export type TexteDemande = { resume: string; details: string | null };
export type TexteLigne = { libelle: string; remarque: string | null };
export type Textes<T> = { fr: T } & Partial<Record<string, T>>;

/** Article demandé mais non ajouté à la carte : le client voit pourquoi, au lieu d'un oubli silencieux. */
export type ArticleRefuseVue = {
  libelle: Textes<string>; // nom de l'article, en français et dans les langues de la demande
  raison: "ferme" | "indisponible";
  horaires: string | null; // horaires du service, tels que saisis par l'hôtel (« 11h – 23h »)
};

export type LigneDemandeVue = {
  quantite: number;
  prixUnitaire: number;
  textes: Textes<TexteLigne>;
};

export type DemandeVue = {
  id: string;
  type: TypeDemandeVue;
  departement: DepartementVue;
  statut: StatutDemandeVue;
  langueClient: string;
  urgent: boolean;
  montantTotal: number;
  textes: Textes<TexteDemande>;
  lignes: LigneDemandeVue[];
  refuses: ArticleRefuseVue[];
  creeLe: string;
  prevueLe: string | null; // heure d'arrivée annoncée (instant ISO), une fois la demande acceptée
  // Question : réponse de l'équipe (langue de l'équipe) et sa traduction pour le client
  reponse: {
    original: string;
    traductions: Partial<Record<string, string>>;
    messageId: string | null;
    le: string | null; // instant ISO de la réponse
    retenue: boolean; // générale et durable : Lalla l'a apprise pour les prochains clients
  } | null;
  // Messages de l'équipe au client à propos de cette demande (réponse, information, motif de refus)
  messagesEquipe: {
    messageId: string;
    auteur: "equipe" | "lalla"; // réponse de la réception, ou explication rédigée par Lalla
    original: string;
    traductions: Partial<Record<string, string>>;
  }[];
  declinee: boolean; // déclinée par l'hôtel (et non annulée par le client)
  decideeLe: string | null; // instant ISO de la décision de la réception (acceptée, répondue, déclinée)
};

/** Événements du flux NDJSON renvoyé par /api/conversation. */
export type EvenementFlux =
  | { type: "conversation"; id: string }
  | { type: "texte"; delta: string }
  | { type: "messageEnregistre"; id: string } // identifiant en base du texte qui vient d'être écrit
  | { type: "demande"; demande: DemandeVue }
  | { type: "avis" }
  | { type: "fin" }
  | { type: "erreur"; message: string };

/** Élément affiché dans le fil de discussion. */
export type ElementFil =
  // envoyeLe : instant ISO, affiché en heure dans la bulle
  | { genre: "client"; id: string; texte: string; envoyeLe: string }
  // idsMessages : messages en base composant la bulle (pour la traduire au changement de langue)
  // equipe : message de la réception, transmis par Lalla
  | {
      genre: "assistant";
      id: string;
      texte: string;
      idsMessages: string[];
      envoyeLe: string;
      equipe?: boolean;
    }
  // rappel : la même carte, reprise en bas du fil quand son état change après que la discussion a avancé
  | { genre: "demande"; id: string; demande: DemandeVue; rappel?: boolean }
  | { genre: "avis"; id: string }
  | {
      genre: "erreur";
      id: string;
      cle: "erreurReseau" | "erreurIndisponible";
      messageARenvoyer: string;
    };

/** Carte exposée à l'interface client, avec toutes ses traductions (changement de langue instantané). */
export type ArticleVue = {
  id: string;
  nom: string;
  description: string | null;
  prix: number;
  photo: string | null;
  disponible: boolean; // indisponible : affiché, mais ne peut pas être ajouté
  traductions: Partial<Record<string, { nom: string; description?: string }>>;
};

export type CategorieVue = {
  id: string;
  nom: string;
  type: string; // RESTAURATION (boissons comprises), BIEN_ETRE, EXPERIENCE, TRANSPORT, SERVICE
  horaires: string | null;
  traductions: Partial<Record<string, { nom: string }>>;
  articles: ArticleVue[];
};

/** Informations pratiques de l'hôtel et du séjour, consultables sans écrire. */
export type InfosPratiquesVue = {
  wifiReseau: string | null;
  wifiMotDePasse: string | null;
  heureCheckout: string; // « 12:00 »
  depart: string | null; // instant ISO du départ prévu (séjour en cours)
  fuseauHoraire: string;
  telephoneReception: string | null;
};
