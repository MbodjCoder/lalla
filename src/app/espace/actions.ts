"use server";

// Actions de l'espace hôtel. Chaque action revérifie la session et
// restreint ses écritures au hotelId de celle-ci.
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bdd } from "@/lib/bdd";
import { COMPOSANTS_EQUIPE, FOND_PAR_DEFAUT, fondAssezClair, lisibleSurBlanc } from "@/lib/couleurs";
import { deciderCommande, repondreQuestion } from "@/lib/demandes";
import { iaConfiguree } from "@/lib/ia/client";
import { traduireFiche } from "@/lib/ia/traduction";
import { traducteurEquipe } from "@/lib/i18n/equipe";
import { COOKIE_LANGUE_EQUIPE, lireLangueEquipe } from "@/lib/langue-equipe";
import { estLangueEquipe, LANGUES_EQUIPE } from "@/lib/langues";
import { adresseClient, autoriser } from "@/lib/limiteur";
import { indexerDocument } from "@/lib/rag/indexation";
import { exigerPersonnel, fermerSession, ouvrirSession } from "@/lib/session-personnel";
import { ROLES_TEXTE, styleValide, type RoleTexte } from "@/lib/typographie";
import type { Departement, Prisma } from "@/generated/prisma/client";

// Empreinte factice : bcrypt s'exécute même pour un e-mail inconnu (temps de réponse constant)
const EMPREINTE_FACTICE = "$2b$10$F7KL/E62oC2oJahV5gBoQOBNTjpKENxmoRG4/rgZrsqrJeL3EWsyK";

const genererJetonQr = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 12);

const DEPARTEMENTS = ["RECEPTION", "ETAGES", "RESTAURATION", "TECHNIQUE", "CONCIERGERIE", "BIEN_ETRE"] as const;

const texte = (formulaire: FormData, cle: string) => String(formulaire.get(cle) ?? "").trim();
const texteOuNull = (formulaire: FormData, cle: string) => texte(formulaire, cle) || null;

async function exigerDirection() {
  const session = await exigerPersonnel();
  if (session.role !== "DIRECTION") redirect("/espace/accueil");
  return session;
}

// ─────────────────────────────────────────────────────────────
// Session et langue
// ─────────────────────────────────────────────────────────────

export type EtatConnexion = { erreur: string | null };

export async function seConnecter(_etat: EtatConnexion, formulaire: FormData): Promise<EtatConnexion> {
  const t = traducteurEquipe(await lireLangueEquipe());
  // Longueurs bornées : clés du limiteur et calcul bcrypt maîtrisés
  const email = texte(formulaire, "email").toLowerCase().slice(0, 254);
  const motDePasse = String(formulaire.get("motDePasse") ?? "").slice(0, 200);

  // Par compte (devinette d'un mot de passe) et par adresse (essais sur de nombreux comptes)
  const autorise =
    autoriser(`connexion:${email}`, 8, 15 * 60 * 1000) &&
    autoriser(`connexion-ip:${await adresseClient()}`, 30, 15 * 60 * 1000);
  if (!autorise) return { erreur: t("tropDeTentatives") };

  const personnel = await bdd.personnel.findUnique({ where: { email } });
  const valide = await bcrypt.compare(motDePasse, personnel?.motDePasseHash ?? EMPREINTE_FACTICE);
  if (!personnel || !valide) return { erreur: t("identifiantsIncorrects") };

  await ouvrirSession({
    personnelId: personnel.id,
    hotelId: personnel.hotelId,
    nom: personnel.nom,
    role: personnel.role,
  });
  redirect("/espace/accueil");
}

export async function seDeconnecter() {
  await fermerSession();
  redirect("/espace/connexion");
}

export async function changerLangueEquipe(formulaire: FormData) {
  const langue = formulaire.get("langue");
  if (!estLangueEquipe(langue)) return;
  (await cookies()).set(COOKIE_LANGUE_EQUIPE, langue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

// ─────────────────────────────────────────────────────────────
// Demandes
// ─────────────────────────────────────────────────────────────

/** Commande ou demande : l'accepter, ou l'annuler (Lalla explique l'annulation au client). */
export async function deciderCommandeDepuisEspace(formulaire: FormData) {
  const { hotelId } = await exigerPersonnel();
  const decision = formulaire.get("decision") === "annuler" ? "annuler" : "accepter";
  await deciderCommande(texte(formulaire, "demandeId"), hotelId, decision);
  revalidatePath("/espace/accueil");
}

/** Question : la réponse de l'équipe, que Lalla traduit et transmet au client. */
export async function repondreQuestionDepuisEspace(formulaire: FormData) {
  const { hotelId } = await exigerPersonnel();
  const hotel = await bdd.hotel.findUniqueOrThrow({
    where: { id: hotelId },
    select: { langueEquipe: true },
  });
  const langue = await lireLangueEquipe(hotel.langueEquipe);
  await repondreQuestion(texte(formulaire, "demandeId"), hotelId, texte(formulaire, "message"), langue);
  revalidatePath("/espace/accueil");
}

// ─────────────────────────────────────────────────────────────
// Chambres et séjours
// ─────────────────────────────────────────────────────────────

const schemaArrivee = z.object({
  chambreId: z.string().min(1),
  nomClient: z.string().trim().max(120).optional(),
  depart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Check-in : ouvre un séjour (active les commandes, programme l'avis de départ). */
export async function enregistrerArrivee(formulaire: FormData) {
  const { hotelId } = await exigerPersonnel();
  const resultat = schemaArrivee.safeParse({
    chambreId: formulaire.get("chambreId"),
    nomClient: formulaire.get("nomClient") || undefined,
    depart: formulaire.get("depart"),
  });
  if (!resultat.success) return;
  const donnees = resultat.data;

  const chambre = await bdd.chambre.findFirst({
    where: { id: donnees.chambreId, hotelId },
    include: { hotel: { select: { fuseauHoraire: true } } },
  });
  if (!chambre) return;
  // Départ entre aujourd'hui (calendrier de l'hôtel) et un an : une date passée fermerait aussitôt les commandes
  const aujourdhui = new Intl.DateTimeFormat("en-CA", {
    timeZone: chambre.hotel.fuseauHoraire,
  }).format(new Date());
  const dansUnAn = new Date(Date.now() + 366 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (donnees.depart < aujourdhui || donnees.depart > dansUnAn) return;

  // Deux arrivées simultanées sur la même chambre : l'index unique « un séjour en cours par
  // chambre » refuse la seconde, qui est simplement ignorée
  await bdd
    .$transaction([
      // Un seul séjour en cours par chambre
      bdd.sejour.updateMany({
        where: { chambreId: chambre.id, statut: "EN_COURS" },
        data: { statut: "TERMINE" },
      }),
      bdd.sejour.create({
        data: {
          hotelId,
          chambreId: chambre.id,
          nomClient: donnees.nomClient || null,
          arrivee: new Date(),
          // Départ à midi, heure du Sénégal (UTC+0)
          depart: new Date(`${donnees.depart}T12:00:00Z`),
        },
      }),
    ])
    .catch((erreur: unknown) => {
      if ((erreur as { code?: string }).code !== "P2002") throw erreur;
    });
  revalidatePath("/espace/accueil");
}

/** Check-out : clôt le séjour ; la conversation du client précédent devient inaccessible. */
export async function enregistrerDepart(formulaire: FormData) {
  const { hotelId } = await exigerPersonnel();
  await bdd.sejour.updateMany({
    where: {
      chambreId: texte(formulaire, "chambreId"),
      hotelId,
      statut: "EN_COURS",
    },
    data: { statut: "TERMINE" },
  });
  revalidatePath("/espace/accueil");
}

/** Régénère le QR d'une chambre (QR volé, photographié ou abîmé) : l'ancien cesse de fonctionner. */
export async function regenererQr(formulaire: FormData) {
  const { hotelId } = await exigerDirection();
  await bdd.chambre.updateMany({
    where: { id: texte(formulaire, "chambreId"), hotelId },
    data: { jetonQr: genererJetonQr() },
  });
  revalidatePath("/espace/accueil");
}

// ─────────────────────────────────────────────────────────────
// Carte
// ─────────────────────────────────────────────────────────────

/** Un geste : l'article devient indisponible (ou de nouveau disponible). La réception peut le faire. */
export async function basculerDisponibilite(formulaire: FormData) {
  const { hotelId } = await exigerPersonnel();
  await bdd.articleCatalogue.updateMany({
    where: { id: texte(formulaire, "articleId"), hotelId },
    data: { disponible: formulaire.get("disponible") === "oui" },
  });
  revalidatePath("/espace/accueil");
}

const schemaArticle = z.object({
  nom: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  prix: z.coerce.number().int().min(0).max(10_000_000),
  // Lien https vers une image, ou photo fournie avec le modèle (/images/…)
  photo: z
    .string()
    .trim()
    .max(500)
    .regex(/^(https:\/\/\S+|\/images\/[\w\/.-]+)$/)
    .optional(),
});

// Traduction automatique quand le texte source change ; sans IA, les anciennes
// traductions sont retirées pour ne jamais afficher un nom périmé.
async function traductionsArticle(nom: string, description: string | undefined) {
  if (!iaConfiguree()) return {};
  try {
    return (await traduireFiche(nom, description)) as Prisma.InputJsonValue;
  } catch (erreur) {
    console.error("[carte] traduction impossible", erreur);
    return {};
  }
}

export async function enregistrerArticle(formulaire: FormData) {
  const { hotelId } = await exigerDirection();
  // Le formulaire valide déjà ces règles dans le navigateur ; une saisie contournée est ignorée
  const resultat = schemaArticle.safeParse({
    nom: formulaire.get("nom"),
    description: texte(formulaire, "description") || undefined,
    prix: formulaire.get("prix"),
    photo: texte(formulaire, "photo") || undefined,
  });
  if (!resultat.success) return;
  const donnees = resultat.data;
  const articleId = texte(formulaire, "articleId");

  if (articleId) {
    const existant = await bdd.articleCatalogue.findFirst({
      where: { id: articleId, hotelId },
    });
    if (!existant) return;
    const texteModifie = existant.nom !== donnees.nom || (existant.description ?? undefined) !== donnees.description;
    await bdd.articleCatalogue.update({
      where: { id: existant.id },
      data: {
        ...donnees,
        description: donnees.description ?? null,
        photo: donnees.photo ?? null,
        aVerifier: false,
        ...(texteModifie
          ? {
              traductions: await traductionsArticle(donnees.nom, donnees.description),
            }
          : {}),
      },
    });
  } else {
    const categorie = await bdd.categorieCatalogue.findFirst({
      where: { id: texte(formulaire, "categorieId"), hotelId },
    });
    if (!categorie) return;
    const dernier = await bdd.articleCatalogue.findFirst({
      where: { categorieId: categorie.id },
      orderBy: { ordre: "desc" },
    });
    await bdd.articleCatalogue.create({
      data: {
        ...donnees,
        hotelId,
        categorieId: categorie.id,
        ordre: (dernier?.ordre ?? -1) + 1,
        traductions: await traductionsArticle(donnees.nom, donnees.description),
      },
    });
  }
  revalidatePath("/espace/accueil");
}

export async function supprimerArticle(formulaire: FormData) {
  const { hotelId } = await exigerDirection();
  await bdd.articleCatalogue.deleteMany({
    where: { id: texte(formulaire, "articleId"), hotelId },
  });
  revalidatePath("/espace/accueil");
}

export async function enregistrerCategorie(formulaire: FormData) {
  const { hotelId } = await exigerDirection();
  const departement = texte(formulaire, "departement");
  await bdd.categorieCatalogue.updateMany({
    where: { id: texte(formulaire, "categorieId"), hotelId },
    data: {
      horaires: texteOuNull(formulaire, "horaires")?.slice(0, 80) ?? null,
      ...(DEPARTEMENTS.includes(departement as Departement) ? { departement: departement as Departement } : {}),
      aVerifier: false,
    },
  });
  revalidatePath("/espace/accueil");
}

/** Valide en bloc les éléments issus du modèle par défaut. */
export async function toutValiderCarte() {
  const { hotelId } = await exigerDirection();
  await bdd.$transaction([
    bdd.categorieCatalogue.updateMany({
      where: { hotelId },
      data: { aVerifier: false },
    }),
    bdd.articleCatalogue.updateMany({
      where: { hotelId },
      data: { aVerifier: false },
    }),
  ]);
  revalidatePath("/espace/accueil");
  revalidatePath("/espace/accueil");
}

// ─────────────────────────────────────────────────────────────
// Informations de l'hôtel : chaque section s'enregistre seule
// ─────────────────────────────────────────────────────────────

export type SectionInformations =
  "identite" | "design" | "apparence" | "textes" | "contacts" | "sejour" | "delais" | "liens";

export type EtatInformations = {
  statut: "repos" | "enregistre" | "erreur";
  champs?: string[]; // champs refusés, signalés en rouge
  enregistreLe?: number; // distingue deux enregistrements successifs
};

const enregistre = (): EtatInformations => ({
  statut: "enregistre",
  enregistreLe: Date.now(),
});
const refuse = (champs: string[]): EtatInformations => ({
  statut: "erreur",
  champs,
});

const numeroWhatsapp = z
  .string()
  .trim()
  .transform((valeur) => valeur.replace(/[\s+().-]/g, ""))
  .refine((valeur) => valeur === "" || /^\d{8,15}$/.test(valeur));

const couleurHex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Délai habituel d'un service, en minutes ; vide : aucune heure d'arrivée annoncée au client
const delaiMinutes = z.union([z.literal(""), z.coerce.number().int().min(1).max(600)]);

// Sections à simples champs texte ; une valeur vide efface le champ facultatif
const SCHEMAS_INFORMATIONS = {
  identite: z.object({
    nom: z.string().trim().min(2).max(120),
    sousTitre: z.string().trim().max(40),
    nomAssistant: z.string().trim().min(2).max(30),
    langueEquipe: z.enum(LANGUES_EQUIPE),
  }),
  contacts: z.object({
    telephoneReception: z.string().trim().max(30),
    whatsappReception: numeroWhatsapp,
    whatsappDirection: numeroWhatsapp,
  }),
  sejour: z.object({
    wifiReseau: z.string().trim().max(60),
    wifiMotDePasse: z.string().trim().max(60),
    heureCheckout: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  delais: z.object({
    delaiRestauration: delaiMinutes,
    delaiEtages: delaiMinutes,
    delaiTechnique: delaiMinutes,
  }),
  liens: z.object({
    lienAvisPublic: z.union([z.literal(""), z.url()]),
    lienReservation: z.union([z.literal(""), z.url()]),
    codeFidelite: z.string().trim().max(30),
  }),
} as const;

export async function enregistrerInformations(
  _etat: EtatInformations,
  formulaire: FormData,
): Promise<EtatInformations> {
  const { hotelId } = await exigerDirection();
  const section = texte(formulaire, "section") as SectionInformations;

  if (section === "design") {
    const resultat =
      (await enregistrerApparence(hotelId, formulaire)) ?? (await enregistrerTypographie(hotelId, formulaire));
    if (resultat) return resultat;
  } else if (section === "apparence") {
    const resultat = await enregistrerApparence(hotelId, formulaire);
    if (resultat) return resultat;
  } else if (section === "textes") {
    const resultat = await enregistrerTypographie(hotelId, formulaire);
    if (resultat) return resultat;
  } else if (section in SCHEMAS_INFORMATIONS) {
    const schema = SCHEMAS_INFORMATIONS[section as keyof typeof SCHEMAS_INFORMATIONS];
    const resultat = schema.safeParse(Object.fromEntries(formulaire));
    if (!resultat.success) return refuse(resultat.error.issues.map((issue) => String(issue.path[0])));
    const donnees = Object.fromEntries(Object.entries(resultat.data).map(([cle, valeur]) => [cle, valeur || null]));

    // Contacts : les numéros WhatsApp des services (vide : la réception reçoit à leur place)
    const services =
      section === "contacts"
        ? DEPARTEMENTS.filter((departement) => departement !== "RECEPTION").map((departement) => {
            const numero = numeroWhatsapp.safeParse(formulaire.get(`whatsapp_${departement}`) ?? "");
            return {
              departement,
              numero: numero.data ?? "",
              valide: numero.success,
            };
          })
        : [];
    const refuses = services.filter((service) => !service.valide).map((service) => `whatsapp_${service.departement}`);
    if (refuses.length) return refuse(refuses);

    await bdd.$transaction([
      bdd.hotel.update({ where: { id: hotelId }, data: donnees }),
      ...services.map(({ departement, numero }) =>
        bdd.serviceHotel.upsert({
          where: { hotelId_departement: { hotelId, departement } },
          update: { whatsapp: numero || null },
          create: { hotelId, departement, whatsapp: numero || null },
        }),
      ),
    ]);
  } else {
    return refuse([]);
  }
  revalidatePath("/espace", "layout");
  return enregistre();
}

/** Textes : chaque réglage reçu est vérifié ; un réglage hors bornes est refusé (signalé en rouge). */
async function enregistrerTypographie(hotelId: string, formulaire: FormData): Promise<EtatInformations | null> {
  const refuses: string[] = [];
  const typographie = Object.fromEntries(
    (Object.keys(ROLES_TEXTE) as RoleTexte[]).map((role) => {
      const recu = {
        police: texte(formulaire, `police_${role}`),
        taille: Number(texte(formulaire, `taille_${role}`)),
        espacement: Number(texte(formulaire, `espacement_${role}`)),
        couleur: texte(formulaire, `couleur_${role}`) || null,
      };
      const valide = styleValide(role, recu);
      if (
        valide.police !== recu.police ||
        valide.taille !== recu.taille ||
        valide.espacement !== recu.espacement ||
        valide.couleur !== (recu.couleur?.toLowerCase() ?? null)
      )
        refuses.push(`taille_${role}`);
      return [role, valide];
    }),
  );
  if (refuses.length) return refuse(refuses);
  await bdd.hotel.update({ where: { id: hotelId }, data: { typographie } });
  return null;
}

/** Couleurs : null si tout est enregistré, sinon l'état d'erreur à afficher. */
async function enregistrerApparence(hotelId: string, formulaire: FormData): Promise<EtatInformations | null> {
  const couleurAccent = couleurHex.safeParse(formulaire.get("couleurAccent")).data?.toLowerCase();
  if (!couleurAccent) return refuse(["couleurAccent"]);
  // Case « Automatique » cochée (ou couleur invalide) : couleur par défaut ; le texte s'adapte au fond choisi
  const couleurChoisie = (champ: string) =>
    formulaire.get(`${champ}Auto`) ? null : (couleurHex.safeParse(formulaire.get(champ)).data?.toLowerCase() ?? null);
  // Fond client : uniquement une teinte claire ; le blanc cassé par défaut n'est pas stocké
  const fondChoisi = String(formulaire.get("couleurFond") ?? FOND_PAR_DEFAUT).toLowerCase();
  if (!fondAssezClair(fondChoisi)) return refuse(["couleurFond"]);
  // Heures et dates : case « Automatique » ou teinte assez foncée pour une carte blanche
  const horairesChoisis = String(formulaire.get("couleurHoraires") ?? "").toLowerCase();
  if (!formulaire.get("couleurHorairesAuto") && !lisibleSurBlanc(horairesChoisis)) return refuse(["couleurHoraires"]);
  // Icônes du client : case « Automatique » (noir) ou teinte lisible sur les cartes blanches
  const iconesChoisies = String(formulaire.get("couleurIcones") ?? "").toLowerCase();
  if (!formulaire.get("couleurIconesAuto") && !lisibleSurBlanc(iconesChoisies)) return refuse(["couleurIcones"]);

  await bdd.hotel.update({
    where: { id: hotelId },
    data: {
      couleurAccent,
      couleurMessages: couleurChoisie("couleurMessages"),
      couleurMessagesClient: couleurChoisie("couleurMessagesClient"),
      couleurBoutons: couleurChoisie("couleurBoutons"),
      couleurFond: fondChoisi === FOND_PAR_DEFAUT ? null : fondChoisi,
      couleurHoraires: formulaire.get("couleurHorairesAuto") ? null : horairesChoisis,
      couleurIcones: formulaire.get("couleurIconesAuto") ? null : iconesChoisies,
      // Composants de l'équipe (tableau de bord, cercles, pastilles) : null = couleur d'origine
      couleursEquipe: Object.fromEntries(COMPOSANTS_EQUIPE.map((cle) => [cle, couleurChoisie(`equipe_${cle}`)])),
    },
  });
  return null;
}

/** Fiche de connaissance : enregistrer la valide (elle n'est plus « à vérifier ») et la réindexe. */
export async function enregistrerDocument(_etat: EtatInformations, formulaire: FormData): Promise<EtatInformations> {
  const { hotelId } = await exigerDirection();
  const contenu = texte(formulaire, "contenu").slice(0, 30_000);
  const document = await bdd.document.findFirst({
    where: { id: texte(formulaire, "documentId"), hotelId },
  });
  if (!document) return refuse([]);
  if (!contenu) return refuse(["contenu"]);

  await bdd.document.update({
    where: { id: document.id },
    data: { contenu, aVerifier: false },
  });
  await indexerDocument(bdd, document.id);
  revalidatePath("/espace/informations");
  revalidatePath("/espace/accueil");
  return enregistre();
}

// ─────────────────────────────────────────────────────────────
// Avis
// ─────────────────────────────────────────────────────────────

export async function marquerAvisTraite(formulaire: FormData) {
  const { hotelId } = await exigerPersonnel();
  await bdd.avis.updateMany({
    where: { id: texte(formulaire, "avisId"), hotelId },
    data: { traite: true },
  });
  revalidatePath("/espace/accueil");
}
