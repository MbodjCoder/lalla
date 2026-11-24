// Banc d'essai : question transmise à la réception, réponse de l'équipe, puis suite de la conversation.
// Vérifie que Lalla retient la réponse et ne ressort jamais une ancienne question pour une nouvelle.
// Usage : pnpm dev, puis pnpm lalla:question-reception [jeton-de-chambre]
import { config as chargerDotenv } from "dotenv";

chargerDotenv({ path: ".env.local" });
chargerDotenv();

const BASE = process.env.URL_TEST ?? "http://localhost:3000";
const JETON = process.argv[2] ?? "chambre304";
const REPONSE_EQUIPE = "Oui, nous avons des chewing-gums à la boutique du hall, 500 FCFA le paquet.";

type Carte = { id: string; type: string; statut: string; resume: string };
type Resultat = { texte: string; cartes: Carte[]; conversationId: string | null };

const sansAccents = (texte: string) => texte.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

async function envoyer(message: string, conversationId: string | null): Promise<Resultat> {
  const reponse = await fetch(`${BASE}/api/conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jeton: JETON, conversationId, message, langue: "fr" }),
  });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status} : ${await reponse.text()}`);
  let texte = "";
  let id = conversationId;
  const cartes: Carte[] = [];
  for (const ligne of (await reponse.text()).split("\n").filter(Boolean)) {
    const evenement = JSON.parse(ligne);
    if (evenement.type === "conversation") id = evenement.id;
    if (evenement.type === "texte") texte += evenement.delta;
    if (evenement.type === "demande") {
      const { id: idCarte, type, statut, textes } = evenement.demande;
      cartes.push({ id: idCarte, type, statut, resume: textes.fr?.resume ?? "" });
    }
  }
  return { texte, cartes, conversationId: id };
}

async function main() {
  // Modules serveur chargés après les variables d'environnement
  const { bdd } = await import("../src/lib/bdd");
  const { deciderDemande, repondreQuestion } = await import("../src/lib/demandes");
  const chambre = await bdd.chambre.findFirstOrThrow({
    where: { jetonQr: JETON },
    select: { id: true, hotelId: true },
  });
  // La réponse de l'équipe enrichit la fiche « Réponses de la réception » : restaurée à la fin
  const { TITRE_FICHE_APPRISE } = await import("../src/lib/apprentissage");
  const ficheAvant = await bdd.document.findFirst({
    where: { hotelId: chambre.hotelId, titre: TITRE_FICHE_APPRISE },
    select: { id: true, contenu: true },
  });

  let reussis = 0;
  let total = 0;
  const conversations = new Set<string>();
  const verifier = (etape: string, message: string, resultat: Resultat, echecs: string[]) => {
    total++;
    if (echecs.length === 0) reussis++;
    console.log(`${echecs.length === 0 ? "✓" : "✗"} ${etape} — « ${message} »`);
    if (resultat.texte.trim()) console.log(`  ${resultat.texte.trim().replaceAll("\n", "\n  ")}`);
    for (const carte of resultat.cartes) console.log(`  ▸ carte ${carte.type} [${carte.statut}] : ${carte.resume}`);
    for (const echec of echecs) console.log(`  ⚠ ${echec}`);
    console.log();
  };

  try {
    // 1. Question sans réponse connue : Lalla propose de la transmettre
    let conversationId: string | null = null;
    let message = "Est-ce que vous avez des chewing-gums ?";
    let r = await envoyer(message, conversationId);
    conversationId = r.conversationId;
    if (conversationId) conversations.add(conversationId);
    verifier("offre de transmission", message, r, r.cartes.length ? ["carte inattendue"] : []);

    // 2. Le client accepte : la carte porte sa question
    message = "oui";
    r = await envoyer(message, conversationId);
    const question = r.cartes.find((carte) => carte.type === "QUESTION");
    verifier(
      "carte de question",
      message,
      r,
      !question
        ? ["carte QUESTION absente"]
        : sansAccents(question.resume).includes("chewing")
          ? []
          : ["mauvaise question"],
    );
    if (!question) return;

    // 3. Le client confirme, la réception répond
    await deciderDemande(chambre.id, question.id, "confirmer");
    await repondreQuestion(question.id, chambre.hotelId, REPONSE_EQUIPE, "fr");
    console.log(`  (réception : « ${REPONSE_EQUIPE} »)\n`);

    // 4. Le client repose la question : Lalla s'appuie sur la réponse de l'équipe
    message = "vous avez des chewing gums ?";
    r = await envoyer(message, conversationId);
    verifier("réponse retenue", message, r, [
      ...(sansAccents(r.texte).includes("500") || sansAccents(r.texte).includes("boutique")
        ? []
        : ["réponse de la réception oubliée"]),
      ...(r.cartes.length ? ["carte inattendue"] : []),
    ]);

    // 5. Nouvelle question : jamais l'ancienne carte
    message = "Où se trouve la plage ?";
    r = await envoyer(message, conversationId);
    verifier(
      "nouvelle question",
      message,
      r,
      r.cartes.some((carte) => sansAccents(carte.resume).includes("chewing")) ? ["ancienne question ressortie"] : [],
    );

    // 6. Une question laissée sans confirmation ne bloque pas la suivante
    message = "oui";
    r = await envoyer(message, conversationId);
    const plage = r.cartes.find((carte) => carte.type === "QUESTION");
    verifier(
      "accord pour la plage",
      message,
      r,
      plage && !sansAccents(plage.resume).includes("plage") ? ["carte d'une autre question"] : [],
    );
    message = "Est-ce qu'il y a un distributeur de billets dans l'hôtel ?";
    r = await envoyer(message, conversationId);
    verifier(
      "question suivante",
      message,
      r,
      r.cartes.some(
        (carte) => !sansAccents(carte.resume).includes("billet") && !sansAccents(carte.resume).includes("distributeur"),
      )
        ? ["carte d'une autre question"]
        : [],
    );
    message = "oui demandez";
    r = await envoyer(message, conversationId);
    const billets = r.cartes.find((carte) => carte.type === "QUESTION");
    verifier(
      "carte distributeur",
      message,
      r,
      !billets
        ? ["carte QUESTION absente"]
        : /billet|distributeur/.test(sansAccents(billets.resume))
          ? []
          : ["carte d'une autre question"],
    );
  } finally {
    await bdd.demande.deleteMany({ where: { conversationId: { in: [...conversations] } } });
    await bdd.conversation.deleteMany({ where: { id: { in: [...conversations] } } });
    if (ficheAvant) await bdd.document.update({ where: { id: ficheAvant.id }, data: { contenu: ficheAvant.contenu } });
    else await bdd.document.deleteMany({ where: { hotelId: chambre.hotelId, titre: TITRE_FICHE_APPRISE } });
    await bdd.$disconnect();
  }
  console.log(`${reussis}/${total} étapes réussies`);
  process.exitCode = reussis === total ? 0 : 1;
}

main();
