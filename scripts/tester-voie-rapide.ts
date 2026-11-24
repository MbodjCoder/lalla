// Banc de la voie rapide : chaque message doit recevoir une réponse instantanée (ou être
// laissé au modèle) exactement comme prévu. Aucune écriture en base, aucun appel au modèle.
// Usage : pnpm lalla:voie-rapide [jeton-de-chambre]
import { config as chargerDotenv } from "dotenv";

chargerDotenv({ path: ".env.local" });
chargerDotenv();

type Cas = { message: string; langue?: string; attendu: "instantane" | "modele"; contient?: string };

// prettier-ignore
const CAS: Cas[] = [
  // Instantané : une seule question d'information, réponse certaine
  { message: "Quel est le mot de passe du wifi ?", attendu: "instantane", contient: "teranga2026" },
  { message: "wifi", attendu: "instantane", contient: "Hotel-Invites" },
  { message: "What's the wifi password?", langue: "en", attendu: "instantane", contient: "Password" },
  { message: "كلمة السر للواي فاي؟", langue: "ar", attendu: "instantane", contient: "teranga2026" },
  { message: "À quelle heure est le check-out ?", attendu: "instantane", contient: "12" },
  { message: "À quelle heure ferme la piscine ?", attendu: "instantane", contient: "19" },
  { message: "Le petit-déjeuner est servi à quelle heure ?", attendu: "instantane", contient: "7" },
  { message: "Quel est le numéro de la réception ?", attendu: "instantane", contient: "+221" },
  { message: "Merci beaucoup", attendu: "instantane", contient: "plaisir" },
  { message: "thanks!", langue: "en", attendu: "instantane", contient: "pleasure" },
  { message: "Bonjour", attendu: "instantane", contient: "Lalla" },
  { message: "Bonsoir Lalla", attendu: "instantane", contient: "concierge" },
  { message: "Hello", langue: "en", attendu: "instantane", contient: "help" },
  { message: "Asalaa maalekum", langue: "wo", attendu: "instantane", contient: "Lalla" },
  { message: "مرحبا", langue: "ar", attendu: "instantane", contient: "Lalla" },
  // Au modèle : actions, ambiguïtés, plusieurs intentions, pièges
  { message: "Je voudrais un club sandwich", attendu: "modele" },
  { message: "Le club sandwich, c'est quoi ?", attendu: "modele" },
  { message: "Salut, ça va ?", attendu: "modele" },
  { message: "Bonjour, que pouvez-vous faire ?", attendu: "modele" },
  { message: "Aide", attendu: "modele" },
  { message: "Bonsoir, quel est le mot de passe du wifi et à quelle heure est le départ ?", attendu: "modele" },
  { message: "Le wifi ne marche pas", attendu: "modele" },
  { message: "Quel est le code du coffre-fort ?", attendu: "modele" },
  { message: "Quel est le mot de passe ?", attendu: "modele" },
  { message: "Pouvez-vous demander à la réception s'il y a un parking ?", attendu: "modele" },
  { message: "Je voudrais partir plus tard, vers 15h", attendu: "modele" },
  { message: "Je veux prolonger d'une nuit", attendu: "modele" },
  { message: "Il y a une fuite d'eau dans la salle de bain", attendu: "modele" },
  { message: "Au secours, il y a le feu", attendu: "modele" },
  { message: "Annulez ma commande", attendu: "modele" },
  { message: "Où en est ma commande ?", attendu: "modele" },
  { message: "Pouvez-vous m'appeler un taxi pour le départ ?", attendu: "modele" },
  { message: "Que me conseillez-vous de visiter à Dakar ?", attendu: "modele" },
  { message: "Non merci", attendu: "modele" },
  { message: "Oui", attendu: "modele" },
  { message: "Merci, et je voudrais aussi des serviettes", attendu: "modele" },
  { message: "Quels sont vos horaires ?", attendu: "modele" },
];

async function main() {
  const { resoudreChambre } = await import("../src/lib/contexte-chambre");
  const { bdd } = await import("../src/lib/bdd");
  const { reponseInstantanee } = await import("../src/lib/ia/voie-rapide");
  const jeton = process.argv[2] ?? "chambre304";
  const contexte = await resoudreChambre(jeton);
  if (!contexte) throw new Error(`Chambre introuvable : ${jeton}`);
  const [categories, documents] = await Promise.all([
    bdd.categorieCatalogue.findMany({
      where: { hotelId: contexte.hotel.id },
      orderBy: [{ ordre: "asc" }, { id: "asc" }],
      include: { articles: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } },
    }),
    bdd.document.findMany({ where: { hotelId: contexte.hotel.id }, select: { titre: true, contenu: true } }),
  ]);

  let echecs = 0;
  for (const cas of CAS) {
    const debut = performance.now();
    const reponse = reponseInstantanee({
      message: cas.message,
      langueInterface: cas.langue ?? "fr",
      contexte,
      categories,
      documents,
    });
    const duree = (performance.now() - debut).toFixed(1);
    const obtenu = reponse ? "instantane" : "modele";
    const conforme = obtenu === cas.attendu && (!cas.contient || reponse?.includes(cas.contient));
    if (!conforme) echecs++;
    console.log(
      `${conforme ? "OK   " : "ÉCHEC"} ${obtenu.padEnd(10)} ${duree.padStart(5)} ms  « ${cas.message} »${reponse ? ` → ${reponse.replace(/\s+/g, " ").slice(0, 70)}` : ""}`,
    );
  }
  console.log(echecs ? `\n${echecs} échec(s) sur ${CAS.length}` : `\nLes ${CAS.length} cas sont conformes.`);
  await bdd.$disconnect();
  process.exit(echecs ? 1 : 0);
}

void main();
