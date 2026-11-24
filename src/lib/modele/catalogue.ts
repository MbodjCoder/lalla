// Carte type d'un hôtel sénégalais (modèle par défaut).
// Prix indicatifs en FCFA, marqués « à vérifier » : le gérant les ajuste.
// Le français est la langue source ; les autres langues sont pré-traduites.
import type { Departement, TypeCategorie, ZoneTouristique } from "@/generated/prisma/client";
import type { LangueClient } from "@/lib/langues";

export type TraductionArticle = { nom: string; description?: string };
export type TraductionsArticle = Partial<Record<Exclude<LangueClient, "fr">, TraductionArticle>>;

export type ArticleModele = {
  nom: string;
  description?: string;
  prix: number;
  photo: string; // image fournie avec le modèle (public/images/catalogue, crédits dans CREDITS.md)
  traductions: TraductionsArticle;
};

export type CategorieModele = {
  nom: string;
  type: TypeCategorie;
  departement: Departement;
  horaires: string;
  traductions: Partial<Record<Exclude<LangueClient, "fr">, { nom: string }>>;
  articles: ArticleModele[];
};

// ─────────────────────────────────────────────────────────────
// Rubriques communes à tous les hôtels
// ─────────────────────────────────────────────────────────────

const PETIT_DEJEUNER: CategorieModele = {
  nom: "Petit-déjeuner",
  type: "RESTAURATION",
  departement: "RESTAURATION",
  horaires: "7h – 10h30",
  traductions: {
    en: { nom: "Breakfast" },
    wo: { nom: "Ndekki" },
    es: { nom: "Desayuno" },
    it: { nom: "Colazione" },
    de: { nom: "Frühstück" },
    pt: { nom: "Pequeno-almoço" },
    ar: { nom: "الفطور" },
  },
  articles: [
    {
      nom: "Petit-déjeuner continental",
      photo: "/images/catalogue/petit-dejeuner-continental.webp",
      description: "Viennoiseries, pain, confiture, jus de fruits, boisson chaude",
      prix: 8000,
      traductions: {
        en: { nom: "Continental breakfast", description: "Pastries, bread, jam, fruit juice, hot drink" },
        wo: { nom: "Ndekki tubaab" },
        es: { nom: "Desayuno continental", description: "Bollería, pan, mermelada, zumo, bebida caliente" },
        it: { nom: "Colazione continentale", description: "Viennoiserie, pane, marmellata, succo, bevanda calda" },
        de: { nom: "Kontinentales Frühstück", description: "Gebäck, Brot, Marmelade, Saft, Heißgetränk" },
        pt: { nom: "Pequeno-almoço continental", description: "Pastelaria, pão, compota, sumo, bebida quente" },
        ar: { nom: "فطور قاري", description: "معجنات، خبز، مربى، عصير، مشروب ساخن" },
      },
    },
    {
      nom: "Petit-déjeuner sénégalais",
      photo: "/images/catalogue/petit-dejeuner-senegalais.webp",
      description: "Bouillie de mil au lait caillé, beignets, café Touba",
      prix: 7000,
      traductions: {
        en: { nom: "Senegalese breakfast", description: "Millet porridge with curd, fritters, Touba coffee" },
        wo: { nom: "Ndekki Senegaal", description: "Laax, beñe, kafe Tuubaa" },
        es: { nom: "Desayuno senegalés", description: "Gachas de mijo con leche cuajada, buñuelos, café Touba" },
        it: {
          nom: "Colazione senegalese",
          description: "Porridge di miglio con latte cagliato, frittelle, caffè Touba",
        },
        de: { nom: "Senegalesisches Frühstück", description: "Hirsebrei mit Sauermilch, Krapfen, Touba-Kaffee" },
        pt: {
          nom: "Pequeno-almoço senegalês",
          description: "Papas de milho-painço com coalhada, bolinhos, café Touba",
        },
        ar: { nom: "فطور سنغالي", description: "عصيدة الدخن باللبن، فطائر، قهوة طوبى" },
      },
    },
    {
      nom: "Omelette au choix",
      photo: "/images/catalogue/omelette.webp",
      description: "Nature, fromage, tomate ou oignons",
      prix: 4000,
      traductions: {
        en: { nom: "Omelette of your choice", description: "Plain, cheese, tomato or onion" },
        wo: { nom: "Omlet" },
        es: { nom: "Tortilla a elegir", description: "Natural, queso, tomate o cebolla" },
        it: { nom: "Omelette a scelta", description: "Semplice, formaggio, pomodoro o cipolla" },
        de: { nom: "Omelett nach Wahl", description: "Natur, Käse, Tomate oder Zwiebel" },
        pt: { nom: "Omelete à escolha", description: "Simples, queijo, tomate ou cebola" },
        ar: { nom: "أومليت حسب الاختيار", description: "سادة، جبن، طماطم أو بصل" },
      },
    },
  ],
};

const ROOM_SERVICE: CategorieModele = {
  nom: "Room service",
  type: "RESTAURATION",
  departement: "RESTAURATION",
  horaires: "11h – 23h",
  traductions: {
    en: { nom: "Room service" },
    wo: { nom: "Lekk ci néeg bi" },
    es: { nom: "Servicio de habitaciones" },
    it: { nom: "Servizio in camera" },
    de: { nom: "Zimmerservice" },
    pt: { nom: "Serviço de quarto" },
    ar: { nom: "خدمة الغرف" },
  },
  articles: [
    {
      nom: "Thiéboudienne",
      photo: "/images/catalogue/thieboudienne.webp",
      description: "Riz au poisson et aux légumes, le plat national",
      prix: 9000,
      traductions: {
        en: { nom: "Thieboudienne", description: "Fish and vegetable rice, the national dish" },
        wo: { nom: "Ceebu jën" },
        es: { nom: "Thieboudienne", description: "Arroz con pescado y verduras, el plato nacional" },
        it: { nom: "Thieboudienne", description: "Riso con pesce e verdure, il piatto nazionale" },
        de: { nom: "Thieboudienne", description: "Reis mit Fisch und Gemüse, das Nationalgericht" },
        pt: { nom: "Thieboudienne", description: "Arroz com peixe e legumes, o prato nacional" },
        ar: { nom: "تشيبودجين", description: "أرز بالسمك والخضار، الطبق الوطني" },
      },
    },
    {
      nom: "Yassa poulet",
      photo: "/images/catalogue/yassa-poulet.webp",
      description: "Poulet mariné au citron et aux oignons, riz blanc",
      prix: 7500,
      traductions: {
        en: { nom: "Chicken yassa", description: "Chicken marinated in lemon and onions, white rice" },
        wo: { nom: "Yàssa ginaar" },
        es: { nom: "Pollo yassa", description: "Pollo marinado con limón y cebolla, arroz blanco" },
        it: { nom: "Pollo yassa", description: "Pollo marinato al limone e cipolle, riso bianco" },
        de: { nom: "Hähnchen Yassa", description: "In Zitrone und Zwiebeln mariniertes Hähnchen, Reis" },
        pt: { nom: "Frango yassa", description: "Frango marinado em limão e cebola, arroz branco" },
        ar: { nom: "دجاج ياسا", description: "دجاج متبل بالليمون والبصل، أرز أبيض" },
      },
    },
    {
      nom: "Mafé de bœuf",
      photo: "/images/catalogue/mafe.webp",
      description: "Bœuf mijoté à la sauce d'arachide, riz blanc",
      prix: 8000,
      traductions: {
        en: { nom: "Beef mafé", description: "Beef stewed in peanut sauce, white rice" },
        wo: { nom: "Mafe yàpp" },
        es: { nom: "Mafé de ternera", description: "Ternera guisada en salsa de cacahuete, arroz blanco" },
        it: { nom: "Mafé di manzo", description: "Manzo stufato in salsa di arachidi, riso bianco" },
        de: { nom: "Rindfleisch-Mafé", description: "Rindfleisch in Erdnusssauce geschmort, Reis" },
        pt: { nom: "Mafé de vaca", description: "Carne de vaca estufada em molho de amendoim, arroz branco" },
        ar: { nom: "مافيه باللحم", description: "لحم بقري مطهو بصلصة الفول السوداني، أرز أبيض" },
      },
    },
    {
      nom: "Poisson grillé du jour",
      photo: "/images/catalogue/poisson-grille.webp",
      description: "Selon arrivage, frites ou riz, salade",
      prix: 9500,
      traductions: {
        en: { nom: "Grilled fish of the day", description: "Catch of the day, fries or rice, salad" },
        wo: { nom: "Jën wu ñu lakk" },
        es: { nom: "Pescado a la parrilla del día", description: "Según captura, patatas fritas o arroz, ensalada" },
        it: { nom: "Pesce alla griglia del giorno", description: "Pescato del giorno, patatine o riso, insalata" },
        de: { nom: "Gegrillter Fisch des Tages", description: "Tagesfang, Pommes oder Reis, Salat" },
        pt: { nom: "Peixe grelhado do dia", description: "Conforme a pesca, batatas fritas ou arroz, salada" },
        ar: { nom: "سمك مشوي طازج", description: "حسب الصيد اليومي، بطاطا مقلية أو أرز، سلطة" },
      },
    },
    {
      nom: "Club sandwich",
      photo: "/images/catalogue/club-sandwich.webp",
      description: "Poulet, œuf, crudités, frites",
      prix: 6500,
      traductions: {
        en: { nom: "Club sandwich", description: "Chicken, egg, raw vegetables, fries" },
        wo: { nom: "Club sandwich" },
        es: { nom: "Sándwich club", description: "Pollo, huevo, verduras, patatas fritas" },
        it: { nom: "Club sandwich", description: "Pollo, uovo, verdure crude, patatine" },
        de: { nom: "Clubsandwich", description: "Hähnchen, Ei, Rohkost, Pommes" },
        pt: { nom: "Sanduíche club", description: "Frango, ovo, legumes crus, batatas fritas" },
        ar: { nom: "كلوب ساندويتش", description: "دجاج، بيض، خضار طازجة، بطاطا مقلية" },
      },
    },
    {
      nom: "Pastels (6 pièces)",
      photo: "/images/catalogue/pastels.webp",
      description: "Chaussons au poisson, sauce tomate pimentée",
      prix: 3500,
      traductions: {
        en: { nom: "Pastels (6 pieces)", description: "Fish turnovers, spicy tomato sauce" },
        wo: { nom: "Pastel (6)" },
        es: { nom: "Pastels (6 piezas)", description: "Empanadillas de pescado, salsa de tomate picante" },
        it: { nom: "Pastels (6 pezzi)", description: "Fagottini di pesce, salsa di pomodoro piccante" },
        de: { nom: "Pastels (6 Stück)", description: "Fischtaschen, scharfe Tomatensauce" },
        pt: { nom: "Pastéis (6 unidades)", description: "Pastéis de peixe, molho de tomate picante" },
        ar: { nom: "باستيل (6 قطع)", description: "فطائر محشوة بالسمك، صلصة طماطم حارة" },
      },
    },
    {
      nom: "Thiakry",
      photo: "/images/catalogue/thiakry.webp",
      description: "Dessert de mil au lait caillé",
      prix: 2500,
      traductions: {
        en: { nom: "Thiakry", description: "Millet and sweet curd dessert" },
        wo: { nom: "Caakiri" },
        es: { nom: "Thiakry", description: "Postre de mijo con leche cuajada" },
        it: { nom: "Thiakry", description: "Dessert di miglio con latte cagliato" },
        de: { nom: "Thiakry", description: "Hirsedessert mit Sauermilch" },
        pt: { nom: "Thiakry", description: "Sobremesa de milho-painço com coalhada" },
        ar: { nom: "تشاكري", description: "حلوى الدخن باللبن" },
      },
    },
    {
      nom: "Salade de fruits frais",
      photo: "/images/catalogue/salade-fruits.webp",
      prix: 3000,
      traductions: {
        en: { nom: "Fresh fruit salad" },
        wo: { nom: "Salaat bu doom garab" },
        es: { nom: "Macedonia de frutas frescas" },
        it: { nom: "Macedonia di frutta fresca" },
        de: { nom: "Frischer Obstsalat" },
        pt: { nom: "Salada de fruta fresca" },
        ar: { nom: "سلطة فواكه طازجة" },
      },
    },
  ],
};

const BOISSONS: CategorieModele = {
  nom: "Boissons",
  type: "BOISSONS",
  departement: "RESTAURATION",
  horaires: "24h/24",
  traductions: {
    en: { nom: "Drinks" },
    wo: { nom: "Naan" },
    es: { nom: "Bebidas" },
    it: { nom: "Bevande" },
    de: { nom: "Getränke" },
    pt: { nom: "Bebidas" },
    ar: { nom: "مشروبات" },
  },
  articles: [
    {
      nom: "Bissap",
      photo: "/images/catalogue/bissap.webp",
      description: "Jus d'hibiscus maison",
      prix: 1500,
      traductions: {
        en: { nom: "Bissap", description: "Homemade hibiscus juice" },
        wo: { nom: "Bissap" },
        es: { nom: "Bissap", description: "Zumo casero de hibisco" },
        it: { nom: "Bissap", description: "Succo di ibisco fatto in casa" },
        de: { nom: "Bissap", description: "Hausgemachter Hibiskussaft" },
        pt: { nom: "Bissap", description: "Sumo caseiro de hibisco" },
        ar: { nom: "بيساب", description: "عصير الكركديه المنزلي" },
      },
    },
    {
      nom: "Bouye",
      photo: "/images/catalogue/bouye.webp",
      description: "Jus de pain de singe (fruit du baobab)",
      prix: 1500,
      traductions: {
        en: { nom: "Bouye", description: "Baobab fruit juice" },
        wo: { nom: "Bouy" },
        es: { nom: "Bouye", description: "Zumo de fruto del baobab" },
        it: { nom: "Bouye", description: "Succo del frutto del baobab" },
        de: { nom: "Bouye", description: "Saft der Baobabfrucht" },
        pt: { nom: "Bouye", description: "Sumo do fruto do embondeiro" },
        ar: { nom: "بوي", description: "عصير ثمرة الباوباب" },
      },
    },
    {
      nom: "Jus de gingembre",
      photo: "/images/catalogue/gingembre.webp",
      description: "Maison",
      prix: 1500,
      traductions: {
        en: { nom: "Ginger juice", description: "Homemade" },
        wo: { nom: "Jinjeer" },
        es: { nom: "Zumo de jengibre", description: "Casero" },
        it: { nom: "Succo di zenzero", description: "Fatto in casa" },
        de: { nom: "Ingwersaft", description: "Hausgemacht" },
        pt: { nom: "Sumo de gengibre", description: "Caseiro" },
        ar: { nom: "عصير الزنجبيل", description: "منزلي" },
      },
    },
    {
      nom: "Café Touba",
      photo: "/images/catalogue/cafe-touba.webp",
      description: "Café épicé au poivre de Guinée",
      prix: 1000,
      traductions: {
        en: { nom: "Touba coffee", description: "Coffee spiced with Guinea pepper" },
        wo: { nom: "Kafe Tuubaa" },
        es: { nom: "Café Touba", description: "Café especiado con pimienta de Guinea" },
        it: { nom: "Caffè Touba", description: "Caffè speziato al pepe di Guinea" },
        de: { nom: "Touba-Kaffee", description: "Mit Guinea-Pfeffer gewürzter Kaffee" },
        pt: { nom: "Café Touba", description: "Café com pimenta-da-guiné" },
        ar: { nom: "قهوة طوبى", description: "قهوة متبلة بفلفل غينيا" },
      },
    },
    {
      nom: "Eau minérale 1,5 L",
      photo: "/images/catalogue/eau.webp",
      prix: 1000,
      traductions: {
        en: { nom: "Mineral water 1.5 L" },
        wo: { nom: "Ndox 1,5 L" },
        es: { nom: "Agua mineral 1,5 L" },
        it: { nom: "Acqua minerale 1,5 L" },
        de: { nom: "Mineralwasser 1,5 L" },
        pt: { nom: "Água mineral 1,5 L" },
        ar: { nom: "مياه معدنية 1.5 لتر" },
      },
    },
    {
      nom: "Soda",
      photo: "/images/catalogue/soda.webp",
      description: "Coca-Cola, Fanta, Sprite",
      prix: 1500,
      traductions: {
        en: { nom: "Soft drink", description: "Coca-Cola, Fanta, Sprite" },
        wo: { nom: "Soda" },
        es: { nom: "Refresco", description: "Coca-Cola, Fanta, Sprite" },
        it: { nom: "Bibita", description: "Coca-Cola, Fanta, Sprite" },
        de: { nom: "Softdrink", description: "Coca-Cola, Fanta, Sprite" },
        pt: { nom: "Refrigerante", description: "Coca-Cola, Fanta, Sprite" },
        ar: { nom: "مشروب غازي", description: "كوكاكولا، فانتا، سبرايت" },
      },
    },
    {
      nom: "Bière locale",
      photo: "/images/catalogue/biere.webp",
      prix: 2000,
      traductions: {
        en: { nom: "Local beer" },
        wo: { nom: "Biyeer" },
        es: { nom: "Cerveza local" },
        it: { nom: "Birra locale" },
        de: { nom: "Lokales Bier" },
        pt: { nom: "Cerveja local" },
        ar: { nom: "بيرة محلية" },
      },
    },
  ],
};

const BIEN_ETRE: CategorieModele = {
  nom: "Spa & bien-être",
  type: "BIEN_ETRE",
  departement: "BIEN_ETRE",
  horaires: "9h – 20h",
  traductions: {
    en: { nom: "Spa & wellness" },
    wo: { nom: "Spa ak massaas" },
    es: { nom: "Spa y bienestar" },
    it: { nom: "Spa e benessere" },
    de: { nom: "Spa & Wellness" },
    pt: { nom: "Spa e bem-estar" },
    ar: { nom: "السبا والعناية" },
  },
  articles: [
    {
      nom: "Massage relaxant (60 min)",
      photo: "/images/catalogue/massage.webp",
      prix: 25000,
      traductions: {
        en: { nom: "Relaxing massage (60 min)" },
        wo: { nom: "Massaas (60 simili)" },
        es: { nom: "Masaje relajante (60 min)" },
        it: { nom: "Massaggio rilassante (60 min)" },
        de: { nom: "Entspannungsmassage (60 Min.)" },
        pt: { nom: "Massagem relaxante (60 min)" },
        ar: { nom: "تدليك استرخائي (60 دقيقة)" },
      },
    },
    {
      nom: "Hammam & gommage au karité",
      photo: "/images/catalogue/hammam.webp",
      prix: 15000,
      traductions: {
        en: { nom: "Hammam & shea butter scrub" },
        wo: { nom: "Hammam ak karite" },
        es: { nom: "Hammam y exfoliación con karité" },
        it: { nom: "Hammam e scrub al karité" },
        de: { nom: "Hammam & Sheabutter-Peeling" },
        pt: { nom: "Hammam e esfoliação com karité" },
        ar: { nom: "حمّام وتقشير بزبدة الشيا" },
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Rubriques qui dépendent de la zone : excursions et transfert
// ─────────────────────────────────────────────────────────────

const traduireNom = (
  noms: [en: string, wo: string, es: string, it: string, de: string, pt: string, ar: string],
): TraductionsArticle => {
  const [en, wo, es, it, de, pt, ar] = noms;
  return {
    en: { nom: en },
    wo: { nom: wo },
    es: { nom: es },
    it: { nom: it },
    de: { nom: de },
    pt: { nom: pt },
    ar: { nom: ar },
  };
};

const EXCURSIONS_PAR_ZONE: Record<ZoneTouristique, ArticleModele[]> = {
  DAKAR: [
    {
      nom: "Île de Gorée (demi-journée)",
      photo: "/images/catalogue/goree.webp",
      prix: 20000,
      traductions: traduireNom([
        "Gorée Island (half day)",
        "Dun Goree (genn-wàll bés)",
        "Isla de Gorea (medio día)",
        "Isola di Gorée (mezza giornata)",
        "Insel Gorée (halber Tag)",
        "Ilha de Gorée (meio dia)",
        "جزيرة غوري (نصف يوم)",
      ]),
    },
    {
      nom: "Lac Rose (journée)",
      photo: "/images/catalogue/lac-rose.webp",
      prix: 35000,
      traductions: traduireNom([
        "Pink Lake (full day)",
        "Dex gu xonq (bés bépp)",
        "Lago Rosa (día completo)",
        "Lago Rosa (giornata intera)",
        "Rosa See (ganzer Tag)",
        "Lago Rosa (dia inteiro)",
        "البحيرة الوردية (يوم كامل)",
      ]),
    },
    {
      nom: "Visite de Dakar (demi-journée)",
      photo: "/images/catalogue/dakar.webp",
      prix: 20000,
      traductions: traduireNom([
        "Dakar city tour (half day)",
        "Wër Ndakaaru (genn-wàll bés)",
        "Visita de Dakar (medio día)",
        "Visita di Dakar (mezza giornata)",
        "Stadtrundfahrt Dakar (halber Tag)",
        "Visita a Dacar (meio dia)",
        "جولة في داكار (نصف يوم)",
      ]),
    },
  ],
  PETITE_COTE: [
    {
      nom: "Réserve de Bandia (demi-journée)",
      photo: "/images/catalogue/bandia.webp",
      prix: 30000,
      traductions: traduireNom([
        "Bandia wildlife reserve (half day)",
        "Reserwu Bandia (genn-wàll bés)",
        "Reserva de Bandia (medio día)",
        "Riserva di Bandia (mezza giornata)",
        "Bandia-Reservat (halber Tag)",
        "Reserva de Bandia (meio dia)",
        "محمية بانديا (نصف يوم)",
      ]),
    },
    {
      nom: "Joal-Fadiouth, l'île aux coquillages",
      photo: "/images/catalogue/joal-fadiouth.webp",
      prix: 20000,
      traductions: traduireNom([
        "Joal-Fadiouth, the shell island",
        "Joal-Fadiouth",
        "Joal-Fadiouth, la isla de las conchas",
        "Joal-Fadiouth, l'isola delle conchiglie",
        "Joal-Fadiouth, die Muschelinsel",
        "Joal-Fadiouth, a ilha das conchas",
        "جوال-فاديوث، جزيرة الأصداف",
      ]),
    },
    {
      nom: "Lagune de la Somone en pirogue",
      photo: "/images/catalogue/somone.webp",
      prix: 15000,
      traductions: traduireNom([
        "Somone lagoon by pirogue",
        "Somone ci gaal",
        "Laguna de la Somone en piragua",
        "Laguna della Somone in piroga",
        "Somone-Lagune im Einbaum",
        "Lagoa da Somone de piroga",
        "بحيرة سومون بالقارب",
      ]),
    },
  ],
  SAINT_LOUIS: [
    {
      nom: "Tour de l'île en calèche",
      photo: "/images/catalogue/saint-louis.webp",
      prix: 10000,
      traductions: traduireNom([
        "Island tour by horse carriage",
        "Wër dun bi ci sarett",
        "Vuelta a la isla en calesa",
        "Giro dell'isola in carrozza",
        "Inselrundfahrt mit der Kutsche",
        "Volta à ilha de charrete",
        "جولة في الجزيرة بعربة الخيل",
      ]),
    },
    {
      nom: "Parc national des oiseaux du Djoudj (journée)",
      photo: "/images/catalogue/djoudj.webp",
      prix: 40000,
      traductions: traduireNom([
        "Djoudj bird sanctuary (full day)",
        "Parkub picc yu Djoudj",
        "Parque de aves del Djoudj (día completo)",
        "Parco degli uccelli del Djoudj (giornata)",
        "Vogelpark Djoudj (ganzer Tag)",
        "Parque de aves do Djoudj (dia inteiro)",
        "محمية طيور دجودج (يوم كامل)",
      ]),
    },
    {
      nom: "Langue de Barbarie en pirogue",
      photo: "/images/catalogue/langue-barbarie.webp",
      prix: 15000,
      traductions: traduireNom([
        "Langue de Barbarie by pirogue",
        "Langue de Barbarie ci gaal",
        "Langue de Barbarie en piragua",
        "Langue de Barbarie in piroga",
        "Langue de Barbarie im Einbaum",
        "Langue de Barbarie de piroga",
        "لسان البربري بالقارب",
      ]),
    },
  ],
  SINE_SALOUM: [
    {
      nom: "Balade en pirogue dans les bolongs",
      photo: "/images/catalogue/bolongs.webp",
      prix: 15000,
      traductions: traduireNom([
        "Pirogue ride through the mangroves",
        "Doxantu ci gaal ci bolong yi",
        "Paseo en piragua por los manglares",
        "Giro in piroga tra le mangrovie",
        "Einbaumfahrt durch die Mangroven",
        "Passeio de piroga nos mangais",
        "جولة بالقارب بين أشجار المانغروف",
      ]),
    },
    {
      nom: "Île aux coquillages et villages sérères",
      photo: "/images/catalogue/joal-fadiouth.webp",
      prix: 20000,
      traductions: traduireNom([
        "Shell island and Serer villages",
        "Dun bu ñaq ak dëkki seereer",
        "Isla de las conchas y pueblos sereres",
        "Isola delle conchiglie e villaggi serer",
        "Muschelinsel und Serer-Dörfer",
        "Ilha das conchas e aldeias sereres",
        "جزيرة الأصداف وقرى السيرير",
      ]),
    },
  ],
  CASAMANCE: [
    {
      nom: "Île de Carabane (journée)",
      photo: "/images/catalogue/carabane.webp",
      prix: 25000,
      traductions: traduireNom([
        "Carabane Island (full day)",
        "Dun Karabaan (bés bépp)",
        "Isla de Carabane (día completo)",
        "Isola di Carabane (giornata)",
        "Insel Carabane (ganzer Tag)",
        "Ilha de Carabane (dia inteiro)",
        "جزيرة كارابان (يوم كامل)",
      ]),
    },
    {
      nom: "Balade en pirogue dans les bolongs",
      photo: "/images/catalogue/bolongs.webp",
      prix: 15000,
      traductions: traduireNom([
        "Pirogue ride through the mangroves",
        "Doxantu ci gaal ci bolong yi",
        "Paseo en piragua por los manglares",
        "Giro in piroga tra le mangrovie",
        "Einbaumfahrt durch die Mangroven",
        "Passeio de piroga nos mangais",
        "جولة بالقارب بين أشجار المانغروف",
      ]),
    },
    {
      nom: "Village et roi d'Oussouye",
      photo: "/images/catalogue/oussouye.webp",
      prix: 20000,
      traductions: traduireNom([
        "Oussouye village and its king",
        "Dëkku Usuy ak buuram",
        "Pueblo y rey de Oussouye",
        "Villaggio e re di Oussouye",
        "Dorf und König von Oussouye",
        "Aldeia e rei de Oussouye",
        "قرية أوسوي وملكها",
      ]),
    },
  ],
  AUTRE: [],
};

// Aéroport le plus pertinent et prix indicatif du transfert selon la zone
const TRANSFERT_PAR_ZONE: Record<ZoneTouristique, { aeroport: string; prix: number }> = {
  DAKAR: { aeroport: "Aéroport international Blaise-Diagne (AIBD)", prix: 25000 },
  PETITE_COTE: { aeroport: "Aéroport international Blaise-Diagne (AIBD)", prix: 25000 },
  SAINT_LOUIS: { aeroport: "Aéroport international Blaise-Diagne (AIBD)", prix: 70000 },
  SINE_SALOUM: { aeroport: "Aéroport international Blaise-Diagne (AIBD)", prix: 50000 },
  CASAMANCE: { aeroport: "Aéroport de Cap Skirring", prix: 10000 },
  AUTRE: { aeroport: "Aéroport international Blaise-Diagne (AIBD)", prix: 40000 },
};

function conciergerie(zone: ZoneTouristique): CategorieModele[] {
  const { aeroport, prix } = TRANSFERT_PAR_ZONE[zone];
  const transferts: CategorieModele = {
    nom: "Transferts",
    type: "TRANSPORT",
    departement: "CONCIERGERIE",
    horaires: "24h/24 — prévenir 3 h à l'avance",
    traductions: {
      en: { nom: "Transfers" },
      wo: { nom: "Yóbbu ak indi" },
      es: { nom: "Traslados" },
      it: { nom: "Transfer" },
      de: { nom: "Transfers" },
      pt: { nom: "Transferes" },
      ar: { nom: "خدمة التوصيل" },
    },
    articles: [
      {
        nom: "Transfert aéroport",
        photo: "/images/catalogue/transfert-aeroport.webp",
        description: aeroport,
        prix,
        traductions: Object.fromEntries(
          Object.entries(
            traduireNom([
              "Airport transfer",
              "Yóbbu ayeropoor",
              "Traslado al aeropuerto",
              "Transfer aeroporto",
              "Flughafentransfer",
              "Transfer para o aeroporto",
              "التوصيل إلى المطار",
            ]),
          ).map(([langue, { nom }]) => [langue, { nom, description: aeroport }]),
        ),
      },
    ],
  };

  const excursions = EXCURSIONS_PAR_ZONE[zone];
  if (excursions.length === 0) return [transferts];

  return [
    {
      nom: "Excursions",
      type: "EXPERIENCE",
      departement: "CONCIERGERIE",
      horaires: "Réserver la veille avant 20h",
      traductions: {
        en: { nom: "Excursions" },
        wo: { nom: "Doxantu" },
        es: { nom: "Excursiones" },
        it: { nom: "Escursioni" },
        de: { nom: "Ausflüge" },
        pt: { nom: "Excursões" },
        ar: { nom: "رحلات" },
      },
      articles: excursions,
    },
    transferts,
  ];
}

/** Carte complète du modèle par défaut, adaptée à la zone de l'hôtel. */
export function catalogueModele(zone: ZoneTouristique): CategorieModele[] {
  return [PETIT_DEJEUNER, ROOM_SERVICE, BOISSONS, BIEN_ETRE, ...conciergerie(zone)];
}
