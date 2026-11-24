// Vitesse et taille du prompt dans une très longue conversation : la réponse ne doit pas
// ralentir avec le nombre d'échanges. Crée une conversation de 99 messages (tours réalistes),
// y envoie un message qui demande le modèle, compare avec une conversation neuve, puis nettoie.
// Usage : pnpm dev, puis pnpm lalla:longue-conversation [jeton-de-chambre]
import { config as chargerDotenv } from "dotenv";

chargerDotenv({ path: ".env.local" });
chargerDotenv();

const BASE = process.env.URL_TEST ?? "http://localhost:3000";
const MESSAGE = process.env.MESSAGE ?? "Je voudrais un bissap";
const TOURS = 33; // 33 tours × (client + contexte + Lalla) = 99 messages

async function envoyer(jeton: string, conversationId: string | null) {
  const debut = Date.now();
  const reponse = await fetch(`${BASE}/api/conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jeton, conversationId, message: MESSAGE, langue: "fr" }),
  });
  let premier: number | null = null;
  let id: string | null = null;
  const texte = await reponse.text();
  for (const ligne of texte.split("\n").filter(Boolean)) {
    const evenement = JSON.parse(ligne);
    if (evenement.type === "conversation") id = evenement.id;
    if ((evenement.type === "texte" || evenement.type === "demande") && premier === null) premier = Date.now() - debut;
  }
  return { statut: reponse.status, duree: Date.now() - debut, id, fin: texte.includes('"fin"') };
}

async function main() {
  const { resoudreChambre } = await import("../src/lib/contexte-chambre");
  const { bdd } = await import("../src/lib/bdd");
  const { historiqueGemini, FENETRE_HISTORIQUE } = await import("../src/lib/ia/gemini");
  const jeton = process.argv[2] ?? "chambre304";
  const contexte = await resoudreChambre(jeton);
  if (!contexte) throw new Error(`Chambre introuvable : ${jeton}`);

  // Conversation longue, aux tailles réelles mesurées (client ~40, contexte ~1 200, Lalla ~140 caractères)
  const conversation = await bdd.conversation.create({
    data: {
      hotelId: contexte.hotel.id,
      chambreId: contexte.chambre.id,
      sejourId: contexte.sejour?.id ?? null,
      langue: "fr",
    },
  });
  const contexteTour =
    "Contexte à cet instant : jeudi, 21:40 (heure de l'hôtel) · séjour en cours · " + "demande passée ".repeat(75);
  let rang = 1;
  for (let tour = 0; tour < TOURS; tour++) {
    const client = `Question numéro ${tour} sur l'hôtel, s'il vous plaît ?`;
    const lalla = `Réponse numéro ${tour} : voici l'information demandée, avec un peu de détail pour être réaliste ici.`;
    await bdd.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          rang: rang++,
          role: "CLIENT",
          contenu: [{ type: "text", text: client }],
          texte: client,
        },
        { conversationId: conversation.id, rang: rang++, role: "SYSTEME", contenu: contexteTour, texte: null },
        {
          conversationId: conversation.id,
          rang: rang++,
          role: "ASSISTANT",
          contenu: [{ type: "text", text: lalla }],
          texte: lalla,
        },
      ],
    });
  }

  // Taille de l'historique envoyé au modèle : avant (tout, contextes compris) et maintenant (fenêtre)
  const historique = await bdd.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { rang: "asc" },
  });
  const avant = historique.reduce((total, m) => total + (m.texte ?? String(m.contenu)).length, 0);
  const fenetre = historiqueGemini(historique);
  const maintenant = fenetre.reduce((total, m) => total + String(m.content ?? "").length, 0);
  console.log(`historique : ${historique.length} messages`);
  console.log(
    `envoyé au modèle avant : ~${avant} caractères · maintenant : ${maintenant} caractères (${fenetre.length} messages, fenêtre ${FENETRE_HISTORIQUE})`,
  );

  // Ordre alterné (NEUVE_D_ABORD=1) : le premier appel remplit le cache du modèle, le second en profite
  const neuveDAbord = process.env.NEUVE_D_ABORD === "1";
  const neuve0 = neuveDAbord ? await envoyer(jeton, null) : null;
  const longue = await envoyer(jeton, conversation.id);
  const neuve = neuve0 ?? (await envoyer(jeton, null));
  console.log(
    `conversation de ${historique.length} messages : ${longue.duree} ms (statut ${longue.statut}, fin ${longue.fin}, même conversation : ${longue.id === conversation.id})`,
  );
  console.log(`conversation neuve           : ${neuve.duree} ms (statut ${neuve.statut}, fin ${neuve.fin})`);

  // Ménage : les deux conversations de test et leurs cartes
  const ids = [conversation.id, neuve.id].filter((id): id is string => Boolean(id));
  await bdd.demande.deleteMany({ where: { conversationId: { in: ids } } });
  await bdd.conversation.deleteMany({ where: { id: { in: ids } } });
  await bdd.$disconnect();
}

void main();
