// Compréhension du mode secours : normalisation, mots-clés par intention dans
// les 8 langues des clients, détection de la langue du message.
import type { CategorieService } from "@/lib/demandes";
import type { LangueClient } from "@/lib/langues";
import type { CleService } from "./textes";

/**
 * Minuscules, sans accents ni ponctuation : « Où est la Piscine ? » → « ou est la piscine ».
 * « gn » devient « n » : le wolof s'écrit souvent « gnibbi » pour « ñibbi ».
 */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("gn", "n")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Mots-clés : mot entier, ou début de mot avec « * » (« serviette* » couvre « serviettes »).
export type MotsCles = string[];

export function mentionne(texte: string, mots: MotsCles): boolean {
  const entoure = ` ${texte} `;
  return mots.some((mot) =>
    mot.endsWith("*") ? entoure.includes(` ${normaliser(mot.slice(0, -1))}`) : entoure.includes(` ${normaliser(mot)} `),
  );
}

// prettier-ignore
export const MOTS = {
  urgence: [
    "urgence*", "au secours", "ambulance", "samu", "medecin", "docteur", "malaise", "blesse*", "saigne*", "incendie",
    "au feu", "fumee", "agression", "voleur", "emergency", "doctor", "injured", "bleeding", "fire", "smoke", "thief",
    "emergencia", "medico", "herido", "incendio", "fuego", "notfall", "arzt", "verletzt", "feuer", "emergenza",
    "ferito", "urgencia", "socorro", "ferido", "fogo", "doktoor", "طوارئ", "اسعاف", "إسعاف", "طبيب", "حريق", "نجدة",
    "شرطة",
  ],
  incident: [
    "marche pas", "marche plus", "fonctionne pas", "fonctionne plus", "en panne", "panne", "casse*", "fuite", "bouche*",
    "pas d eau chaude", "pas de courant", "plus de courant", "coupure", "clim", "climatisation", "climatiseur",
    "trop chaud", "broken", "not working", "doesn t work", "doesnt work", "does not work", "leak*", "no hot water",
    "air conditioning", "aircon", "no funciona", "roto", "averiad*", "fuga", "aire acondicionado", "non funziona",
    "rotto", "guasto", "perdita", "aria condizionata", "funktioniert nicht", "kaputt", "defekt", "klimaanlage",
    "nao funciona", "avariad*", "vazamento", "quebrad*", "ar condicionado", "yaqu", "liggeyul", "معطل", "لا يعمل",
    "تسرب", "مكيف", "المكيف",
  ],
  departTardif: [
    "depart tardif", "late check*", "late checkout", "partir plus tard", "rester plus tard", "salida tardia",
    "spater auschecken", "spaeter auschecken", "spat auschecken", "partenza posticipata", "check out tardivo",
    "saida tardia", "مغادرة متأخرة",
  ],
  depart: [
    "check out", "checkout", "depart", "partir", "quitter la chambre", "liberer la chambre", "leave", "leaving",
    "salida", "dejar la habitacion", "abreise", "auschecken", "partenza", "lasciare la camera", "saida", "partida",
    "nibbi", "dem", "génn néeg", "مغادرة", "المغادرة",
  ],
  prolongation: [
    "prolonger", "prolongation", "rester plus longtemps", "une nuit de plus", "nuit supplementaire", "nuits de plus",
    "extend my stay", "extend", "extra night", "one more night", "stay longer", "prolongar", "otra noche", "prolungare",
    "un altra notte", "verlangern", "noch eine nacht", "mais uma noite", "yokk ay fan", "تمديد",
  ],
  wifi: [
    "wifi", "wi fi", "wlan", "internet", "mot de passe", "mdp", "password", "contrasena", "passwort", "senha",
    "واي فاي", "الواي", "انترنت", "الانترنت", "الإنترنت", "كلمة السر",
  ],
  horaire: [
    "heure", "heures", "horaire*", "quand", "ouvert*", "ferme", "fermez", "what time", "when", "open*", "close*",
    "hours", "hora", "horas", "horario*", "cuando", "abiert*", "cierra*", "orari*", "quando", "apert*", "chius*", "uhr",
    "wann", "geoffnet", "offnungszeit*", "aberto", "fechad*", "ban waxtu", "waxtu", "kan", "kann", "متى", "ساعة",
    "ساعات", "مواعيد", "مفتوح",
  ],
  faim: [
    "faim", "manger", "menu", "carte", "repas", "room service", "plat*", "hungry", "eat", "food", "lunch", "dinner",
    "hambre", "comer", "comida", "cena", "fame", "mangiare", "cibo", "hunger", "essen", "speisekarte", "fome", "jantar",
    "xiif", "lekk", "جائع", "جوعان", "اكل", "أكل", "طعام", "قائمة",
  ],
  soif: [
    "soif", "boire", "boisson*", "thirsty", "drink*", "beber", "bebida*", "sed", "bere", "durst", "trinken", "getrank*",
    "sede", "mar", "naan", "عطش", "عطشان", "مشروب*", "اشرب",
  ],
  bienEtre: ["spa", "massage*", "soin*", "hammam", "masaje*", "massaggi*", "massagem", "massaas", "مساج", "تدليك"],
  excursion: ["excursion*", "tour", "trip", "excursiones", "escursion*", "ausflug*", "passeio*", "رحلة", "جولة"],
  recommandations: [
    "visiter", "visite", "visites", "a voir", "a faire", "que faire", "quoi faire", "coins", "endroits", "lieux",
    "sortir", "balade*", "decouvrir", "touristique*", "incontournable*", "plage*", "marche", "marches", "musee*",
    "visit", "see", "things to do", "places", "sightseeing", "beach*", "market*", "museum*", "what to do", "visitar",
    "que hacer", "playa*", "mercado*", "museo*", "cosa vedere", "da vedere", "spiaggia", "sehenswurdig*", "strand",
    "markt", "o que fazer", "praia*", "wer", "fu ma mana dem", "زيارة", "اماكن", "أماكن", "شاطئ", "سوق",
  ],
  reception: [
    "reception*", "receptionniste", "quelqu un", "humain", "telephone", "appeler", "front desk", "someone", "human",
    "phone", "call", "recepcion", "recepcionista", "llamar", "reception", "receptionist", "recezione", "telefonare",
    "rezeption", "anrufen", "rececao", "recepcao", "ligar", "resepsiyon*", "woo", "استقبال", "الاستقبال", "هاتف",
  ],
  avis: [
    "avis", "noter", "super sejour", "excellent sejour", "merci pour tout", "au revoir", "on s en va", "nous partons",
    "review", "great stay", "lovely stay", "thank you for everything", "goodbye", "bye", "we are leaving", "opinion",
    "adios", "gracias por todo", "arrivederci", "grazie di tutto", "auf wiedersehen", "danke fur alles", "adeus",
    "obrigad* por tudo", "ba benen yoon", "heureux", "heureuse", "ravi", "ravie", "ravis", "satisfait*", "enchante*",
    "happy", "enjoyed", "loved", "wonderful", "contento", "encantad*", "felice", "zufrieden", "feliz", "beg na",
    "مع السلامة", "شكرا على كل شيء",
  ],
  revenir: [
    "revenir", "reviendr*", "prochain sejour", "come back", "next stay", "proxima estancia", "tornare",
    "prossimo soggiorno", "wiederkommen", "proxima estadia", "nouvelle reservation", "اعود", "أعود", "حجز",
  ],
  statut: [
    "complete*", "termine*", "pret", "prete", "fini", "finie", "arrive", "ou en est", "ou en sont", "toujours rien",
    "toujours pas", "combien de temps", "delai", "suivi", "statut", "ma commande", "mes demandes", "ma demande",
    "status", "ready", "done", "finished", "where is my", "how long", "still waiting", "my order", "listo", "lista",
    "donde esta mi", "cuanto tarda", "mi pedido", "pronto", "finito", "dov e il mio", "quanto ci vuole", "fertig",
    "wo bleibt", "wie lange", "meine bestellung", "onde esta o meu", "quanto tempo", "o meu pedido", "jeex na", "agsi",
    "dafa yagg", "طلبي", "متى يصل", "جاهز",
  ],
  annulation: [
    "annul*", "cancel*", "anula*", "annulla*", "stornier*", "cancela*", "je ne veux plus", "laisse tomber",
    "never mind", "bul ko def", "neenal", "الغاء", "إلغاء", "الغ",
  ],
  identite: [
    "comment tu t appelles", "comment vous appelez vous", "ton nom", "votre nom", "qui es tu", "qui etes vous",
    "tu es qui", "t es qui", "robot*", "es tu humain", "tu es humain", "ia", "intelligence artificielle", "chatgpt",
    "chat gpt", "modele", "model", "your name", "who are you", "are you human", "are you real", "bot", "como te llamas",
    "quien eres", "come ti chiami", "chi sei", "wie heisst du", "wer bist du", "como te chamas", "quem es",
    "naka nga tudd", "noo tudd", "kan nga", "yow kan", "iow kan", "ما اسمك", "من انت", "من أنت",
  ],
  commentCaVa: [
    "ca va", "comment vas tu", "comment allez vous", "tu vas bien", "vous allez bien", "how are you", "how r u",
    "how are u", "que tal", "como estas", "come stai", "come va", "wie geht", "como vai", "tudo bem", "nanga def",
    "na nga def", "naka nga def", "foo nekk", "fo nekk", "noo def", "كيف الحال", "كيف حالك",
  ],
  compliment: [
    "tu es fort*", "t es fort*", "genial*", "bravo", "tu es intelligent*", "tu es top", "tu es super", "trop fort*",
    "you re great", "you are great", "smart", "amazing", "good job", "well done", "eres genial", "sei brava",
    "du bist toll", "es otima", "dangay muus", "ممتاز", "رائع",
  ],
  incompris: [
    "je ne comprends pas", "comprends pas", "pas compris", "tu ne comprends pas", "tu comprends", "mal compris",
    "pas ce que j ai dit", "j ai pas dit", "j ai pas dis", "je n ai pas dit", "ce que je veux dire", "c est pas ca", "ce n est pas ca", "n importe quoi",
    "i don t understand", "you don t understand", "not what i said", "that s wrong", "no entiendo", "non capisco",
    "ich verstehe nicht", "nao entendo", "degguma", "deggoo", "لا افهم", "لم افهم",
  ],
  navigation: [
    "ecran d accueil", "page d accueil", "retour a l accueil", "retourne a l accueil", "retourne", "retour au menu",
    "menu principal", "home screen", "go back", "main menu", "pantalla de inicio", "volver al inicio",
    "schermata iniziale", "startseite", "ecra inicial", "voltar ao inicio",
  ],
  commander: [
    "je voudrais", "je veux", "j aimerais", "je prends", "je prendrai", "commander", "commande", "apportez", "apporter",
    "amenez", "donnez", "reserver", "reserve", "book", "order", "i d like", "i would like", "i want", "i ll have",
    "bring", "can i get", "could i get", "get me", "quiero", "quisiera", "pedir", "reservar", "traer", "vorrei",
    "voglio", "prendo", "ordinare", "prenotare", "portare", "ich mochte", "ich hatte gern", "bestellen", "buchen",
    "bringen", "quero", "queria", "trazer", "begg naa", "dama begg", "indil", "أريد", "اطلب", "احجز",
  ],
  questionArticle: [
    "combien", "prix", "coute*", "c est quoi", "qu est ce que", "how much", "price", "cost", "what is", "what s",
    "cuanto", "precio", "que es", "quanto", "prezzo", "cos e", "was kostet", "preis", "was ist", "quanto custa",
    "preco", "o que e", "naata", "lan la", "كم", "سعر", "ما هو",
  ],
  merci: [
    "merci", "thanks", "thank you", "thx", "jerejef", "jarajef", "gracias", "grazie", "danke", "obrigad*", "شكرا",
    "شكرًا",
  ],
  accord: [
    "ok", "okay", "oui", "d accord", "parfait", "super", "tres bien", "yes", "great", "perfect", "si", "vale",
    "perfecto", "va bene", "perfetto", "ja", "gut", "sim", "perfeito", "waaw", "baax na", "vas y", "allez y", "go",
    "please do", "نعم", "حسنا", "تمام",
  ],
  refus: ["non", "no", "nein", "nao", "deedeet", "pas besoin", "no thanks", "non merci", "لا"],
  salutation: [
    "bonjour", "bonsoir", "salut", "hello", "hi", "hey", "good morning", "good evening", "good afternoon", "salam",
    "salamalekum", "salamaleikum", "asalaa maalekum", "hola", "buenos dias", "buenas", "ciao", "buongiorno",
    "buonasera", "hallo", "guten tag", "guten morgen", "guten abend", "ola", "bom dia", "boa tarde", "boa noite",
    "مرحبا", "السلام عليكم", "اهلا", "أهلا", "que peux tu faire", "que pouvez vous faire", "what can you do", "aide",
    "help",
  ],
} satisfies Record<string, MotsCles>;

// Demandes de service reconnues : mots-clés → catégorie de routage
// prettier-ignore
export const SERVICES: { cle: CleService; categorie: CategorieService; mots: MotsCles }[] = [
  {
    cle: "serviettes",
    categorie: "linge",
    mots: [
      "serviette*", "towel*", "toalla*", "asciugaman*", "handtuch*", "handtucher", "toalha*", "sarbet", "منشف*",
      "مناشف",
    ],
  },
  {
    cle: "oreillers",
    categorie: "linge",
    mots: ["oreiller*", "pillow*", "almohada*", "cuscin*", "kissen", "travesseir*", "almofada*", "وسادة", "وسائد"],
  },
  {
    cle: "couverture",
    categorie: "linge",
    mots: [
      "couverture*", "drap", "draps", "blanket*", "sheets", "manta*", "sabana*", "copert*", "lenzuol*", "decke",
      "bettwasche", "cobertor*", "lencol", "lencois", "بطانية", "شراشف",
    ],
  },
  {
    cle: "produits",
    categorie: "linge",
    mots: [
      "papier toilette", "papier hygienique", "savon*", "shampo*", "gel douche", "toilet paper", "soap", "toiletries",
      "papel higienico", "jabon", "carta igienica", "sapone", "toilettenpapier", "seife", "sabonete", "صابون",
      "ورق التواليت", "محارم",
    ],
  },
  {
    cle: "menage",
    categorie: "menage",
    mots: [
      "menage", "nettoy*", "faire la chambre", "cleaning", "clean the room", "clean my room", "housekeeping",
      "limpieza", "limpiar", "pulizia", "pulire", "reinigung", "reinigen", "putzen", "limpeza", "limpar", "setal",
      "تنظيف",
    ],
  },
  {
    cle: "reveil",
    categorie: "reveil",
    mots: [
      "reveil*", "reveiller", "wake up", "wake me", "wakeup", "wake-up", "despertador", "despertar*", "sveglia",
      "svegliar*", "weckruf", "wecken", "weckdienst", "acordar", "yee ma", "ايقاظ", "إيقاظ", "منبه",
    ],
  },
  {
    cle: "taxi",
    categorie: "transport",
    mots: [
      "taxi*", "chauffeur", "voiture", "cab", "uber", "yango", "heetch", "coche", "macchina", "tagsi", "taksi", "تاكسي",
      "سيارة",
    ],
  },
];

// Nombres écrits en toutes lettres, pour « deux bissap », « two beers »…
// prettier-ignore
export const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5,
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, due: 2, tre: 3, quattro: 4, cinque: 5, ein: 1, eine: 1,
  einen: 1, zwei: 2, drei: 3, vier: 4, funf: 5, um: 1, uma: 1, dois: 2, duas: 2, quatro: 4, benn: 1, naar: 2, nett: 3,
  neent: 4, juroom: 5, واحد: 1, اثنين: 2, اثنان: 2, ثلاثة: 3, اربعة: 4,
};

// Rang dans une liste proposée juste avant (« le deuxième », « the first »)
// prettier-ignore
export const ORDINAUX: Record<string, number> = {
  premier: 1, premiere: 1, first: 1, primero: 1, primera: 1, primo: 1, prima: 1, erste: 1, ersten: 1, primeiro: 1,
  deuxieme: 2, second: 2, seconde: 2, segundo: 2, segunda: 2, secondo: 2, zweite: 2, zweiten: 2, troisieme: 3, third: 3,
  tercero: 3, tercera: 3, terzo: 3, dritte: 3, dritten: 3, terceiro: 3,
};

/** Quantité ou rang annoncé seul (« 2 », « deux », « le deuxième ») ; null sinon. */
export function nombreAnnonce(mots: string[]): number | null {
  for (const mot of mots) {
    if (/^\d{1,2}$/.test(mot)) return Number(mot);
    if (ORDINAUX[mot]) return ORDINAUX[mot];
    if (NOMBRES[mot] && mot.length > 1) return NOMBRES[mot];
  }
  return null;
}

// ── Langue du message ────────────────────────────────────────────────────────

// Mots très fréquents propres à chaque langue (après normalisation)
const INDICES_LANGUE: Record<Exclude<LangueClient, "ar">, Set<string>> = {
  fr: new Set(
    (
      "je tu vous est le la les un une des mon ma mes pour avec quel quelle quels comment ou merci bonjour " +
      "bonsoir svp c ce que qui pas ne j avez moi dans sur du au oui non peux pouvez voudrais veux sont il y a"
    ).split(" "),
  ),
  en: new Set(
    (
      "i you the is are my me what where how when please can could would like thanks thank hello hi to of " +
      "for do does there yes want need it this your have get"
    ).split(" "),
  ),
  es: new Set(
    (
      "yo el los las es esta mi que donde como cuando por favor quiero gracias hola para con hay puedo " +
      "necesito usted tiene"
    ).split(" "),
  ),
  it: new Set(
    (
      "io il lo gli sono mio che dove come quando per favore voglio vorrei grazie ciao buongiorno con " +
      "posso c e della"
    ).split(" "),
  ),
  de: new Set(
    (
      "ich du sie der die das ist mein was wo wie wann bitte danke hallo ein eine mit fur kann mochte " +
      "gibt es ja nein nicht und"
    ).split(" "),
  ),
  pt: new Set(
    (
      "eu o os as meu minha que onde como quando por favor quero queria obrigado obrigada ola uma um para " +
      "com posso sim nao voce"
    ).split(" "),
  ),
  wo: new Set(
    (
      "ma nga bi yi ba dafa dama begg laaj lan naka ndax jerejef nekk laay ban ci ak fan fo kan nanga def " +
      "waaw deedeet mangi maangi yow man sa sama am amul noo nu ngi lay laa bu fii iow"
    ).split(" "),
  ),
};

/** Langue dans laquelle le client écrit, si elle se reconnaît sans ambiguïté ; null sinon. */
export function detecterLangue(message: string): LangueClient | null {
  if ((message.match(/[؀-ۿ]/g) ?? []).length >= 2) return "ar";
  const mots = normaliser(message).split(" ").filter(Boolean);
  const scores = (Object.entries(INDICES_LANGUE) as [LangueClient, Set<string>][])
    .map(([langue, indices]) => ({ langue, score: mots.filter((mot) => indices.has(mot)).length }))
    .sort((a, b) => b.score - a.score);
  const [premiere, seconde] = scores;
  if (premiere.score >= 2 && premiere.score > seconde.score) return premiere.langue;
  // Message très court (« gracias », « foo nekk ») : un seul indice suffit s'il n'est partagé avec aucune langue
  if (mots.length <= 3 && premiere.score >= 1 && seconde.score === 0) return premiere.langue;
  return null;
}

// Débuts de question, dans chaque langue
const INTERROGATIFS = new Set(
  (
    "quel quelle quels quelles ou comment quand combien pourquoi qui est ce avez vous peut on a what where when " +
    "how why who which is are do does can could que donde cuando como cual cuanto dove quando come quale quanto wo " +
    "wann wie was welche gibt onde qual lan fan fo naka ndax kan ban ما اين أين متى كيف هل كم"
  ).split(" "),
);

export function estQuestion(message: string): boolean {
  if (/[?؟]/.test(message)) return true;
  const premier = normaliser(message).split(" ")[0] ?? "";
  return INTERROGATIFS.has(premier);
}
