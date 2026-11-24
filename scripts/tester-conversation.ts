// Banc d'essai de Lalla : scénarios de clients réels envoyés au serveur en marche,
// vérification des réponses et des cartes. Fonctionne avec l'IA comme en mode secours.
// Les conversations créées sont supprimées à la fin.
// Usage : pnpm dev, puis pnpm lalla:tester [jeton-de-chambre…]
// (plusieurs chambres conseillées : 20 messages / 10 min par chambre)
import { config as chargerDotenv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { EvenementFlux, StatutDemandeVue, TypeDemandeVue } from "../src/lib/types";

chargerDotenv({ path: ".env.local" });
chargerDotenv();

const BASE = process.env.URL_TEST ?? "http://localhost:3000";
const JETONS = process.argv.length > 2 ? process.argv.slice(2) : ["chambre304", "AEAUmHUATdfh", "RLM4v6YnamMk"];
// Pause entre deux messages (offres gratuites limitées à quelques requêtes par minute)
const PAUSE_MS = Number(process.env.PAUSE_MS ?? 0);
// Échantillon : seuls les scénarios dont le premier message correspond (quota gratuit limité)
const FILTRE = process.env.FILTRE ? new RegExp(process.env.FILTRE, "i") : null;

type Tour = {
  langue?: string; // fr par défaut
  message: string;
  carte?: TypeDemandeVue; // nouvelle carte attendue
  urgent?: boolean;
  avis?: boolean;
  sansCarte?: boolean;
  carteMiseAJour?: StatutDemandeVue; // carte existante modifiée (annulation)
  contient?: string[]; // fragments attendus (sans accents ni casse)
  contientPas?: string[];
};
type Scenario = Tour | Tour[]; // plusieurs tours = une même conversation

const TOUS_LES_SCENARIOS: Scenario[] = [
  // Informations
  { message: "Bonjour", sansCarte: true },
  { message: "c'est quoi le code wifi ?", contient: ["teranga2026"], sansCarte: true },
  { langue: "en", message: "What's the wifi password?", contient: ["teranga2026"], sansCarte: true },
  { message: "à quelle heure ouvre la piscine ?", contient: ["8h"], sansCarte: true },
  { langue: "de", message: "Bis wann hat die Bar geöffnet?", sansCarte: true },
  { message: "j'ai faim, qu'est-ce que vous proposez ?", sansCarte: true },
  { message: "c'est quoi le thiakry ?", contient: ["thiakry"], sansCarte: true },
  // Objet à apporter en chambre : une demande de service, la carte se suffit
  { message: "on peut avoir un adaptateur pour les prises ?", carte: "SERVICE" },
  { langue: "en", message: "Do you have an adapter for the sockets?", carte: "SERVICE" },
  { message: "où est-ce que je peux fumer ?", contient: ["exterieur"], sansCarte: true },
  { message: "Quels sont les coins à visiter ?", contient: ["goree"], sansCarte: true },
  { message: "on aimerait revenir l'année prochaine", contient: ["SEJOUR10"], sansCarte: true },
  { langue: "ar", message: "ما هي كلمة سر الواي فاي؟", contient: ["teranga2026"], sansCarte: true },
  { langue: "fr", message: "Kagn laay gnibbi ?", contient: ["12"], sansCarte: true },
  // Conversation
  { message: "Comment tu t'appelles", contient: ["Lalla"], sansCarte: true },
  { message: "Iow ban model IA gha ?", contient: ["Lalla"], sansCarte: true },
  { message: "Tu es fort ?", contientPas: ["coffre"], sansCarte: true },
  { message: "Je ne comprends pas", sansCarte: true },
  { message: "J’ai pas dis ça est ce que tu comprends ce que je veux dire ?", contient: ["compris"], sansCarte: true },
  { message: "Retourne à l’écran d’accueil", contient: ["⊞"], sansCarte: true },
  { langue: "ar", message: "كيف الحال ؟", sansCarte: true },
  { message: "merci pour tout, super séjour !", avis: true },
  // Commandes et services
  { message: "je voudrais 2 bissap et un yassa poulet", carte: "COMMANDE" },
  { langue: "en", message: "Can I get a club sandwich and two local beers please", carte: "COMMANDE" },
  { message: "deux serviettes et un oreiller s'il vous plaît", carte: "SERVICE" },
  { langue: "it", message: "La climatizzazione non funziona", carte: "INCIDENT" },
  // Le transfert aéroport est vendu au catalogue : une commande
  { message: "je veux un taxi pour l'aéroport demain à 6h", carte: "COMMANDE" },
  { message: "est-ce possible de partir plus tard le jour du départ ?", carte: "SERVICE" },
  { message: "Je veux prolonger mon séjour, comment faire ?", carte: "SERVICE", contientPas: ["http"] },
  { message: "mon mari a fait un malaise, il faut un médecin", urgent: true, contient: ["1515"] },
  // Plusieurs tours : la mémoire de la conversation
  [
    { message: "une eau minérale", carte: "COMMANDE" }, // boisson servie 24h/24 : test indépendant de l'heure
    { message: "Annule le", carteMiseAJour: "ANNULEE", sansCarte: true },
  ],
  [
    { message: "un petit déjeuner svp", sansCarte: true, contient: ["continental", "senegalais"] },
    { message: "le deuxième", carte: "COMMANDE" },
  ],
  [
    { message: "Combien coûte le massage ?", contient: ["25"], sansCarte: true },
    { message: "oui", carte: "COMMANDE" },
  ],
  [
    { message: "Est-ce qu'il y a une salle de sport ?", sansCarte: true },
    { message: "oui", carte: "QUESTION" },
  ],
  [
    { message: "je voudrais un bissap", carte: "COMMANDE" },
    { message: "Est ce complété ?", sansCarte: true, contient: ["confirm"] },
  ],
];

const SCENARIOS = TOUS_LES_SCENARIOS.filter(
  (scenario) => !FILTRE || FILTRE.test((Array.isArray(scenario) ? scenario[0] : scenario).message),
);

const sansAccents = (texte: string) => texte.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s/g, " ");

async function jouer(tour: Tour, jeton: string, conversationId: string | null) {
  const langue = tour.langue ?? "fr";
  const debut = Date.now();
  const reponse = await fetch(`${BASE}/api/conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jeton, conversationId, message: tour.message, langue }),
  });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status} : ${await reponse.text()}`);

  let texte = "";
  let id = conversationId;
  const cartes: { id: string; type: TypeDemandeVue; statut: StatutDemandeVue; urgent: boolean; resume: string }[] = [];
  let avis = false;
  let erreur = false;
  for (const ligne of (await reponse.text()).split("\n").filter(Boolean)) {
    const evenement = JSON.parse(ligne) as EvenementFlux;
    if (evenement.type === "conversation") id = evenement.id;
    if (evenement.type === "texte") texte += evenement.delta;
    if (evenement.type === "avis") avis = true;
    if (evenement.type === "erreur") erreur = true;
    if (evenement.type === "demande") {
      const { id: idCarte, type, statut, urgent, textes } = evenement.demande;
      cartes.push({ id: idCarte, type, statut, urgent, resume: (textes[langue] ?? textes.fr).resume });
    }
  }
  return { texte, cartes, avis, erreur, conversationId: id, duree: Date.now() - debut };
}

function verifier(tour: Tour, resultat: Awaited<ReturnType<typeof jouer>>, cartesConnues: Set<string>): string[] {
  const nouvelles = resultat.cartes.filter((carte) => !cartesConnues.has(carte.id));
  const modifiees = resultat.cartes.filter((carte) => cartesConnues.has(carte.id));
  const echecs: string[] = [];
  if (resultat.erreur) echecs.push("erreur renvoyée");
  // Une carte se suffit à elle-même (aucun texte autour) ; sans carte, une réponse écrite est due
  if (!resultat.texte.trim() && resultat.cartes.length === 0 && !resultat.avis) echecs.push("aucun texte");
  if (tour.carte && !nouvelles.some((carte) => carte.type === tour.carte)) echecs.push(`carte ${tour.carte} absente`);
  if (tour.urgent && !nouvelles.some((carte) => carte.urgent)) echecs.push("alerte urgente absente");
  if (tour.avis && !resultat.avis) echecs.push("formulaire d'avis absent");
  if (tour.sansCarte && nouvelles.length > 0) echecs.push("carte inattendue");
  if (tour.carteMiseAJour && !modifiees.some((carte) => carte.statut === tour.carteMiseAJour)) {
    echecs.push(`carte non passée à ${tour.carteMiseAJour}`);
  }
  for (const fragment of tour.contient ?? []) {
    if (!sansAccents(resultat.texte).includes(sansAccents(fragment))) echecs.push(`« ${fragment} » absent`);
  }
  for (const fragment of tour.contientPas ?? []) {
    if (sansAccents(resultat.texte).includes(sansAccents(fragment))) echecs.push(`« ${fragment} » présent`);
  }
  return echecs;
}

async function main() {
  const bdd = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const conversations = new Set<string>();
  const total = SCENARIOS.flat().length;
  let reussis = 0;

  console.log(`Lalla · ${total} messages · ${BASE} · chambres ${JETONS.join(", ")}\n`);
  try {
    for (const [rang, scenario] of SCENARIOS.entries()) {
      const jeton = JETONS[rang % JETONS.length];
      const tours = Array.isArray(scenario) ? scenario : [scenario];
      let conversationId: string | null = null;
      const cartesConnues = new Set<string>();
      for (const [index, tour] of tours.entries()) {
        if (PAUSE_MS) await new Promise((resoudre) => setTimeout(resoudre, PAUSE_MS));
        const resultat = await jouer(tour, jeton, conversationId);
        conversationId = resultat.conversationId;
        if (conversationId) conversations.add(conversationId);
        const echecs = verifier(tour, resultat, cartesConnues);
        resultat.cartes.forEach((carte) => cartesConnues.add(carte.id));
        if (echecs.length === 0) reussis++;

        const retrait = tours.length > 1 && index > 0 ? "  ↳ " : "";
        console.log(
          `${echecs.length === 0 ? "✓" : "✗"} ${retrait}(${tour.langue ?? "fr"}) ${tour.message}  [${resultat.duree} ms]`,
        );
        console.log(`  ${resultat.texte.replaceAll("\n", "\n  ")}`);
        for (const carte of resultat.cartes) {
          console.log(`  ▸ carte ${carte.type}${carte.urgent ? " URGENTE" : ""} [${carte.statut}] : ${carte.resume}`);
        }
        if (resultat.avis) console.log("  ▸ formulaire d'avis");
        for (const echec of echecs) console.log(`  ⚠ ${echec}`);
        console.log();
      }
    }
  } finally {
    // Rien ne doit rester : ni conversation de test, ni demande proposée
    await bdd.demande.deleteMany({ where: { conversationId: { in: [...conversations] } } });
    await bdd.conversation.deleteMany({ where: { id: { in: [...conversations] } } });
    await bdd.$disconnect();
  }

  console.log(`${reussis}/${total} messages réussis`);
  process.exitCode = reussis === total ? 0 : 1;
}

main();
