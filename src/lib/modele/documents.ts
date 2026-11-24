// Documents du modèle par défaut (base de connaissance de l'assistant).
// Rédigés en français, langue source : l'assistant répond dans la langue du client.
// Tous sont marqués « à vérifier » à la création de l'hôtel.
import type { TypeDocument, ZoneTouristique } from "@/generated/prisma/client";

export type DocumentModele = { titre: string; type: TypeDocument; contenu: string };

const LIVRET: DocumentModele = {
  titre: "Livret d'accueil",
  type: "LIVRET_ACCUEIL",
  contenu: `# Bienvenue
Toute l'équipe vous souhaite un excellent séjour. La réception est ouverte 24h/24 et reste votre premier interlocuteur pour toute demande.

# Restaurant
Déjeuner de 12h à 15h, dîner de 19h à 22h30. Cuisine sénégalaise et internationale. Les horaires peuvent être adaptés pendant le mois de Ramadan : renseignez-vous à la réception.

# Petit-déjeuner
Servi au restaurant de 7h à 10h30, ou en chambre sur commande.

# Bar
Ouvert de 11h à minuit.

# Piscine
Ouverte de 8h à 19h. Serviettes de piscine disponibles sur place. Les enfants doivent être accompagnés d'un adulte. Pas de surveillance permanente.

# Ménage des chambres
Le ménage est effectué chaque jour entre 9h et 15h. Accrochez le panneau « Ne pas déranger » à votre porte si vous ne souhaitez pas être dérangé ; vous pouvez demander le ménage à un autre moment via le concierge.

# Blanchisserie
Linge confié avant 10h, rendu le lendemain. Tarifs disponibles à la réception.

# Électricité et climatisation
Courant 220 V, prises de type C et E (prises européennes). Des adaptateurs peuvent être prêtés par la réception. Merci d'éteindre la climatisation en quittant la chambre.

# Eau
Nous vous conseillons de boire de l'eau en bouteille.

# Santé et moustiques
Un répulsif anti-moustiques est recommandé, surtout le soir et pendant la saison des pluies (juillet à octobre). Une moustiquaire peut être installée sur demande.

# Coffre-fort
Un coffre-fort est à votre disposition dans la chambre. L'hôtel décline toute responsabilité pour les objets de valeur laissés hors du coffre.

# Départ
La chambre doit être libérée avant 12h. Un départ tardif peut être accordé selon les disponibilités : demandez-le à la réception la veille. Les bagages peuvent être gardés gratuitement à la réception.

# Argent et paiements
Le franc CFA (FCFA) est la monnaie locale. Les paiements mobiles (Wave, Orange Money) sont très répandus. Un bureau de change ou un distributeur se trouve généralement à proximité : demandez à la réception.

# Pratique religieuse
La réception peut vous indiquer la mosquée ou l'église la plus proche ainsi que les horaires des offices.

# Urgences
SAMU : 1515. Sapeurs-pompiers : 18. Police : 17. La réception peut vous indiquer la pharmacie de garde et appeler un médecin.`,
};

const REGLES: DocumentModele = {
  titre: "Règles de la maison",
  type: "CONSIGNES",
  contenu: `# Règles de la maison
Les chambres sont non-fumeurs. Merci de fumer uniquement dans les espaces extérieurs prévus.

Les visiteurs extérieurs sont accueillis jusqu'à 22h et doivent se présenter à la réception.

Le calme est de rigueur entre 22h et 7h.

Les animaux de compagnie ne sont pas admis, sauf accord préalable de la direction.

Merci de ne pas sortir les serviettes de bain des chambres : des serviettes de piscine et de plage sont prévues.`,
};

const RECOMMANDATIONS: Record<ZoneTouristique, string> = {
  DAKAR: `# À découvrir à Dakar et alentours
Île de Gorée : à une vingtaine de minutes de chaloupe depuis le port de Dakar. Maison des Esclaves, ruelles colorées, galeries d'artistes. Site classé au patrimoine mondial de l'UNESCO.

Monument de la Renaissance africaine : sur les collines des Mamelles, vue panoramique sur la ville depuis le sommet.

Village artisanal de Soumbédioune : bijoux, sculptures, tissus. Le marchandage fait partie de la culture.

Marché Kermel et marché Sandaga : marchés historiques du centre-ville.

Île de Ngor : accessible en pirogue en quelques minutes depuis la plage de Ngor, idéale pour une baignade calme.

Lac Rose (lac Retba) : à environ une heure de route, sa couleur est la plus intense en saison sèche.

Musée des Civilisations noires : grand musée consacré aux cultures africaines, dans le centre-ville.`,
  PETITE_COTE: `# À découvrir sur la Petite Côte
Réserve de Bandia : safari à la rencontre des girafes, rhinocéros, zèbres et antilopes, entre Saly et Dakar.

Joal-Fadiouth : village natal du président Senghor et île aux coquillages reliée par un pont de bois, avec son cimetière mixte chrétien et musulman.

Lagune de la Somone : réserve naturelle, balade en pirogue entre mangroves et oiseaux.

Marché de Mbour et arrivée des pirogues de pêche en fin d'après-midi : un spectacle très vivant.

Village artisanal de Saly : artisanat local, marchandage d'usage.`,
  SAINT_LOUIS: `# À découvrir à Saint-Louis
L'île de Saint-Louis : ancienne capitale de l'Afrique-Occidentale française, centre historique classé au patrimoine mondial de l'UNESCO. Le tour en calèche est la meilleure façon de la découvrir.

Pont Faidherbe : emblème de la ville, qui relie l'île au continent.

Quartier des pêcheurs de Guet Ndar : pirogues colorées et vie animée sur la Langue de Barbarie.

Parc national des oiseaux du Djoudj : l'un des principaux sanctuaires d'oiseaux d'Afrique de l'Ouest, à visiter de préférence de novembre à avril.

Festival international de jazz de Saint-Louis : chaque année au printemps.`,
  SINE_SALOUM: `# À découvrir dans le Sine-Saloum
Delta du Saloum : classé au patrimoine mondial de l'UNESCO, un labyrinthe de bolongs (bras de mer) bordés de mangroves, idéal en pirogue.

Îles du Saloum : villages de pêcheurs, amas de coquillages, observation des oiseaux au coucher du soleil.

Villages sérères : accueil chaleureux, artisanat et traditions.

Conseil : pensez à la crème solaire, au chapeau et au répulsif anti-moustiques pour les sorties en pirogue.`,
  CASAMANCE: `# À découvrir en Casamance
Plages du Cap Skirring : parmi les plus belles plages du pays.

Île de Carabane : ancien comptoir chargé d'histoire, accessible en pirogue.

Oussouye : village au cœur du pays diola, résidence du roi d'Oussouye ; architecture traditionnelle et forêts sacrées.

Bolongs de Casamance : balades en pirogue dans les mangroves, observation des oiseaux et des villages de pêcheurs.

Ziguinchor : capitale régionale, marché animé et bords du fleuve Casamance.`,
  AUTRE: `# À découvrir dans la région
La réception connaît les meilleures adresses des environs : n'hésitez pas à lui demander conseil pour les visites, les marchés et les restaurants.`,
};

const CONSEILS_PRATIQUES = `

# Conseils pratiques
Taxi : négociez le prix avant de monter, ou demandez à la réception d'appeler un chauffeur de confiance.

Photos : demandez toujours l'accord des personnes avant de les photographier.

Salutations : prendre le temps de saluer est une marque de respect très appréciée. « Salaam aleekum » et « Jërëjëf » (merci) font toujours plaisir.`;

/** Documents du modèle par défaut, adaptés à la zone de l'hôtel. */
export function documentsModele(zone: ZoneTouristique): DocumentModele[] {
  return [
    LIVRET,
    REGLES,
    {
      titre: "Recommandations de la conciergerie",
      type: "RECOMMANDATIONS",
      contenu: RECOMMANDATIONS[zone] + CONSEILS_PRATIQUES,
    },
  ];
}
