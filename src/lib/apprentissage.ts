// Lalla apprend des réponses de la réception.
//
// Quand l'équipe répond à une question de client, le modèle juge si la réponse est une
// information GÉNÉRALE et DURABLE sur l'hôtel (horaires, équipements, règles, services…),
// utile à d'autres clients. Si oui, il la reformule en question/réponse neutre, sans
// donnée personnelle, et l'ajoute à la fiche « Réponses de la réception » : Lalla la lit
// comme le reste de ses connaissances et répondra seule la prochaine fois.
// Une réponse propre à un client (sa chambre, sa réservation, un fait du jour) n'est pas retenue.
//
// La fiche reste modifiable par la direction dans « Informations de l'hôtel ».
import "server-only";
import { z } from "zod";
import { bdd } from "@/lib/bdd";
import { iaConfiguree } from "@/lib/ia/client";
import { completerJson } from "@/lib/ia/json";
import { indexerDocument } from "@/lib/rag/indexation";

export const TITRE_FICHE_APPRISE = "Réponses de la réception";

const INTRODUCTION =
  "Réponses données par la réception aux questions des clients, retenues par l'assistant. " +
  "Modifiables librement : chaque entrée est un titre « ## question » suivi de sa réponse.";

// Bornes : la fiche reste lisible et tient dans le prompt aux côtés des autres documents
const ENTREES_MAX = 150;
const LONGUEUR_MAX_QUESTION = 200;
const LONGUEUR_MAX_REPONSE = 700;

type Entree = { question: string; reponse: string };

/** Entrées de la fiche : chaque « ## question » suivi de sa réponse ; le texte avant le premier titre est l'introduction. */
export function lireEntrees(contenu: string): Entree[] {
  return contenu
    .split(/^##\s+/m)
    .slice(1)
    .map((morceau) => {
      const [question, ...lignes] = morceau.split("\n");
      return { question: question.trim(), reponse: lignes.join("\n").trim() };
    })
    .filter((entree) => entree.question && entree.reponse);
}

function ecrireFiche(introduction: string, entrees: Entree[]): string {
  return [introduction.trim(), ...entrees.map(({ question, reponse }) => `## ${question}\n${reponse}`)].join("\n\n");
}

const comparable = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const schemaDecision = z.object({
  retenir: z.boolean(),
  question: z.string(),
  reponse: z.string(),
  // Numéro de l'entrée existante sur le même sujet, que la nouvelle réponse remplace ; 0 : aucune
  remplace: z.number().int().min(0),
});

const CONSIGNES = `Tu tiens la base de connaissances d'un hôtel au Sénégal. La réception vient de répondre à la question d'un client.

Décide si cette réponse est une information GÉNÉRALE et DURABLE sur l'hôtel, utile telle quelle à d'autres clients : horaires, services, équipements, emplacements, règles, tarifs, modalités, recommandations.
Ne la retiens PAS (retenir = false) si elle est personnelle ou ponctuelle : elle concerne ce client, sa chambre, sa réservation, sa facture, un objet perdu, un rendez-vous, un fait du jour (« aujourd'hui », « ce soir », « en ce moment »), une disponibilité momentanée, une décision au cas par cas, ou si elle ne répond pas vraiment (« je me renseigne », « oui », « voir avec la réception »).

Si tu la retiens :
- question : la question générique en français, telle qu'un client la poserait, sans nom ni numéro de chambre ;
- reponse : la réponse factuelle en français, complète et neutre (sans formule de politesse, sans « nous vous » adressé à ce client), fidèle à ce qu'a dit la réception, sans rien ajouter ;
- remplace : le numéro de l'entrée existante qui porte sur le même sujet (la nouvelle réponse fait foi), sinon 0.
Ne retiens jamais de donnée personnelle (nom, téléphone, numéro de chambre, montant d'une facture).
Si tu ne la retiens pas : question et reponse vides, remplace = 0.`;

/** Après la réponse de l'équipe à une question : la retenir si elle sert à d'autres clients. */
export async function apprendreDeLaReponse(questionId: string): Promise<void> {
  if (!iaConfiguree()) return;
  const question = await bdd.demande.findFirst({
    where: { id: questionId, type: "QUESTION", statut: "TERMINEE", reponseRetenue: false, reponse: { not: null } },
    select: { id: true, hotelId: true, resume: true, details: true, reponse: true },
  });
  if (!question?.reponse) return;

  const fiche = await ficheApprise(question.hotelId);
  const entrees = lireEntrees(fiche?.contenu ?? "");
  const decision = await completerJson(
    CONSIGNES,
    [
      `Question du client : ${question.resume}${question.details ? `\nPrécision : ${question.details}` : ""}`,
      `Réponse de la réception : ${question.reponse}`,
      entrees.length
        ? `Entrées existantes :\n${entrees.map((entree, rang) => `${rang + 1}. ${entree.question} → ${entree.reponse.slice(0, 160)}`).join("\n")}`
        : "Entrées existantes : aucune.",
    ].join("\n\n"),
    schemaDecision,
  );

  const nouvelle: Entree = {
    question: decision.question.replace(/\s+/g, " ").trim().slice(0, LONGUEUR_MAX_QUESTION),
    reponse: decision.reponse.trim().slice(0, LONGUEUR_MAX_REPONSE),
  };
  if (!decision.retenir || !nouvelle.question || !nouvelle.reponse) return;
  // Le sujet remplacé est repéré par sa question (la fiche a pu changer depuis la lecture)
  const remplacee = entrees[decision.remplace - 1]?.question;

  const documentId = await bdd.$transaction(async (tx) => {
    // Un apprentissage à la fois par hôtel : deux réponses simultanées ne s'écrasent pas
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`apprentissage:${question.hotelId}`}))`;
    const actuelle = await tx.document.findFirst({
      where: { hotelId: question.hotelId, type: "FAQ", titre: TITRE_FICHE_APPRISE },
      orderBy: { misAJourLe: "desc" },
    });
    const contenu = actuelle?.contenu ?? INTRODUCTION;
    const introduction = contenu.split(/^##\s+/m)[0] || INTRODUCTION;
    const existantes = lireEntrees(contenu);
    const cible = existantes.findIndex(
      (entree) =>
        comparable(entree.question) === comparable(remplacee ?? "") ||
        comparable(entree.question) === comparable(nouvelle.question),
    );
    // La plus récente en bas ; au-delà de la limite, les plus anciennes cèdent la place
    const misesAJour = (cible === -1 ? [...existantes, nouvelle] : existantes.with(cible, nouvelle)).slice(
      -ENTREES_MAX,
    );
    const texte = ecrireFiche(introduction, misesAJour);

    const document = actuelle
      ? await tx.document.update({ where: { id: actuelle.id }, data: { contenu: texte }, select: { id: true } })
      : await tx.document.create({
          data: { hotelId: question.hotelId, titre: TITRE_FICHE_APPRISE, type: "FAQ", contenu: texte },
          select: { id: true },
        });
    await tx.demande.update({ where: { id: question.id }, data: { reponseRetenue: true } });
    return document.id;
  });

  // Recherche documentaire à jour (fragments, et vecteurs si disponibles)
  await indexerDocument(bdd, documentId);
}

function ficheApprise(hotelId: string) {
  return bdd.document.findFirst({
    where: { hotelId, type: "FAQ", titre: TITRE_FICHE_APPRISE },
    orderBy: { misAJourLe: "desc" },
    select: { contenu: true },
  });
}
