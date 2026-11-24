// GET  : suivi en direct, statut courant des demandes affichées au client.
// POST : demande créée depuis l'interface, sans passer par Lalla : panier du room service ou
//        réservation (transmis aussitôt), service courant (carte à confirmer), service précisé
//        par un formulaire (réveil, taxi, départ tardif : transmis aussitôt).
import { z } from "zod";
import { resoudreChambre, peutCommander } from "@/lib/contexte-chambre";
import { obtenirConversation } from "@/lib/conversations";
import { commanderDirectement, deciderDemande, proposerService, statutsDemandes, textesMoment } from "@/lib/demandes";
import { heureHotel, instantLocal, jourHotel } from "@/lib/horaires-service";
import { traducteurClient } from "@/lib/i18n/client";
import { LANGUES_CLIENT } from "@/lib/langues";
import { autoriser } from "@/lib/limiteur";
import { DEFINITIONS_SERVICES, SERVICES_DIRECTS } from "@/lib/services-directs";
import type { ArticleRefuseVue, DemandeVue } from "@/lib/types";

// Identifiants attendus : cuid (lettres minuscules et chiffres), 20 au plus
const IDENTIFIANT = /^[a-z0-9]{10,40}$/;
const SUIVIS_MAX = 20;
const PAS_DE_CACHE = { "Cache-Control": "no-store" };

export async function GET(requete: Request) {
  const parametres = new URL(requete.url).searchParams;
  const contexte = await resoudreChambre(parametres.get("jeton") ?? "");
  if (!contexte) return Response.json({ demandes: [] }, { status: 404 });

  const ids = (parametres.get("ids") ?? "")
    .split(",")
    .filter((id) => IDENTIFIANT.test(id))
    .slice(0, SUIVIS_MAX);
  const demandes = await statutsDemandes(contexte.chambre.id, ids);
  return Response.json({ demandes }, { headers: PAS_DE_CACHE });
}

const commun = {
  jeton: z.string().min(8).max(32),
  conversationId: z.string().max(40).nullable(),
  langue: z.enum(LANGUES_CLIENT).default("fr"),
};
// Moment choisi dans un formulaire, à l'heure de l'hôtel
const JOUR = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const HEURE = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const JOURS_RESERVABLES = 90;

const schemaCreation = z.discriminatedUnion("genre", [
  z.object({
    ...commun,
    genre: z.literal("commande"),
    lignes: z
      .array(z.object({ articleId: z.string().regex(IDENTIFIANT), quantite: z.number().int().min(1).max(20) }))
      .min(1)
      .max(30),
    // Excursion, soin, transfert : le jour (et l'heure) de la réservation
    reservation: z.object({ jour: JOUR, heure: HEURE.optional() }).optional(),
    precision: z.string().trim().max(200).optional(), // numéro de vol…
  }),
  z.object({
    ...commun,
    genre: z.literal("service"),
    service: z.enum(SERVICES_DIRECTS),
    // Réveil, taxi, départ tardif : le moment voulu, et une précision libre (destination, vol…)
    precisions: z
      .object({ jour: JOUR.optional(), heure: HEURE.optional(), texte: z.string().trim().max(200).optional() })
      .optional(),
  }),
]);

/** Le moment demandé est-il à venir, dans la fenêtre réservable ? (dates « AAAA-MM-JJ » comparables comme du texte) */
function momentValide(jour: string, heure: string | undefined, fuseau: string): boolean {
  const aujourdhui = jourHotel(fuseau);
  const limite = jourHotel(fuseau, new Date(Date.now() + JOURS_RESERVABLES * 24 * 3600 * 1000));
  if (jour < aujourdhui || jour > limite) return false;
  return !heure || jour > aujourdhui || heure >= heureHotel(fuseau);
}

export async function POST(requete: Request) {
  const corps = schemaCreation.safeParse(await requete.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "requeteInvalide" }, { status: 400 });
  const donnees = corps.data;

  // 10 demandes directes / 10 min par chambre : large pour un client, bloquant pour un abus
  if (!autoriser(`demande-directe:${donnees.jeton}`, 10, 10 * 60 * 1000)) {
    return Response.json({ erreur: "tropDeDemandes" }, { status: 429 });
  }
  const contexte = await resoudreChambre(donnees.jeton);
  if (!contexte) return Response.json({ erreur: "chambreIntrouvable" }, { status: 404 });
  // Sans séjour enregistré (QR photographié, chambre libre) : pas de commande, la réception reste joignable
  if (!peutCommander(contexte)) return Response.json({ erreur: "commandesBloquees" }, { status: 403 });
  const fuseau = contexte.hotel.fuseauHoraire;

  const conversation = await obtenirConversation(contexte, donnees.conversationId, donnees.langue);
  const rattachement = {
    hotelId: contexte.hotel.id,
    chambreId: contexte.chambre.id,
    sejourId: contexte.sejour?.id ?? null,
    conversationId: conversation.id,
  };
  const reponse = (demandes: DemandeVue[], refuses: ArticleRefuseVue[] = []) =>
    Response.json({ conversationId: conversation.id, demandes, refuses }, { headers: PAS_DE_CACHE });

  if (donnees.genre === "commande") {
    const { reservation } = donnees;
    if (reservation && !momentValide(reservation.jour, reservation.heure, fuseau)) {
      return Response.json({ erreur: "momentInvalide" }, { status: 400 });
    }
    const resultat = await commanderDirectement(
      rattachement,
      donnees.langue,
      donnees.lignes,
      reservation,
      donnees.precision || undefined,
    );
    // Rien n'a pu être ajouté (service fermé, épuisé) : le récapitulatif dit pourquoi
    if (!resultat.ok) return Response.json({ erreur: "refusee", refuses: resultat.refuses }, { status: 409 });
    return reponse(resultat.demandes, resultat.refuses);
  }

  // Intitulé rédigé dans les langues de la demande (équipe en fr et en, client dans la sienne)
  const { categorie, resume, formulaire } = DEFINITIONS_SERVICES[donnees.service];
  const intitule = (langue: (typeof LANGUES_CLIENT)[number]) => traducteurClient(langue)(resume);
  const textesResume = { fr: intitule("fr"), en: intitule("en"), client: intitule(donnees.langue) };

  if (!formulaire) {
    // Un geste suffit : la carte attend la confirmation du client
    const { demande } = await proposerService(rattachement, donnees.langue, categorie, textesResume, undefined, false);
    return reponse([demande]);
  }

  // Formulaire : l'heure est exigée ; le départ tardif porte sur le jour du départ
  const { heure, texte } = donnees.precisions ?? {};
  // Jour du départ prévu ; s'il est déjà passé (départ non enregistré) ou inconnu, aujourd'hui
  const aujourdhui = jourHotel(fuseau);
  const departPrevu = contexte.sejour ? jourHotel(fuseau, contexte.sejour.depart) : aujourdhui;
  const jourDepart = departPrevu > aujourdhui ? departPrevu : aujourdhui;
  const jour = donnees.precisions?.jour ?? (donnees.service === "departTardif" ? jourDepart : undefined);
  if (!heure || !jour || !momentValide(jour, heure, fuseau)) {
    return Response.json({ erreur: "momentInvalide" }, { status: 400 });
  }
  const moment = textesMoment(donnees.langue, { jour, heure }, fuseau);
  const precision = texte ? ` — « ${texte} »` : "";
  const details = { fr: moment.fr + precision, en: moment.en + precision, client: moment.client + precision };
  // L'envoi du formulaire vaut confirmation : la demande part aussitôt à l'équipe
  const { demande } = await proposerService(rattachement, donnees.langue, categorie, textesResume, details, false, {
    ignorerDoublons: true,
    prevueLe: formulaire.heurePrevue ? instantLocal(jour, heure, fuseau) : null,
  });
  const transmise = (await deciderDemande(rattachement.chambreId, demande.id, "confirmer")) ?? demande;
  return reponse([transmise]);
}
