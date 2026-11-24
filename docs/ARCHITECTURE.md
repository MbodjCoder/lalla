# Lalla — Document d'architecture technique

> Concierge IA de chambre d'hôtel, accessible par QR code, vendu en SaaS B2B aux hôtels premium du Sénégal.
> Version 0.2 — octobre 2026. Contexte marché : [RECHERCHE-HOTELLERIE-SENEGAL.md](RECHERCHE-HOTELLERIE-SENEGAL.md).

---

## 1. Analyse du projet

### 1.1 Proposition de valeur

| Pour qui | Problème | Ce que fait Lalla |
|---|---|---|
| Client de l'hôtel | Barrière de la langue, téléphone de chambre peu pratique, infos dispersées | Un QR → un concierge qui répond dans sa langue, 24 h/24, et commande pour lui |
| Réception | Appels répétitifs (Wi-Fi, horaires, serviettes) | Questions absorbées par l'IA ; demandes structurées reçues sur WhatsApp |
| Direction | Ventes additionnelles faibles, avis négatifs découverts trop tard, commissions Booking | Room-service et spa poussés au bon moment ; alerte immédiate sur note basse ; lien de réservation directe |

L'argument commercial le plus fort est **mesurable** : l'espace hôtel affiche dès le premier jour les demandes traitées, le délai de prise en charge et le **chiffre d'affaires passé par Lalla**.

### 1.2 Corrections apportées au cahier des charges initial

Le brief était solide ; six points auraient posé problème en production. Ils sont corrigés dans le code.

1. **« Bloquer les mauvais avis, pousser les bons sur TripAdvisor » est interdit.** TripAdvisor et Google proscrivent le *review gating* (ne solliciter un avis public qu'auprès des clients satisfaits) ; un hôtel peut être pénalisé dans son classement. **Solution :** le lien public est proposé à tous. La valeur est ailleurs : une note ≤ 3 alerte la direction sur WhatsApp **pendant que le client est encore là**, ce qui permet de rattraper l'expérience avant son départ. C'est aussi un meilleur argument de vente.
2. **L'URL lisible `lalla.app/h/terroubi/chambre/304` est une faille.** On peut deviner toutes les chambres, et un ancien client (ou quiconque a photographié le QR) peut commander depuis chez lui sur la note de la chambre. **Solution :** le QR contient un **jeton opaque** (`/c/k7Qm2xPa9fRt`) révocable depuis l'espace hôtel, et les commandes exigent un **séjour actif** (créé en un clic à l'arrivée, clos au départ). Bonus : l'URL est plus courte, donc le QR est moins dense et se scanne mieux.
3. **WhatsApp n'accepte pas de message libre à l'initiative de l'entreprise.** Hors fenêtre de 24 h, Meta impose un **modèle (template) pré-approuvé**. Lalla utilise un modèle « Utility » unique ; sans identifiants, un mode console permet de tout développer et démontrer.
4. **Le RAG seul ne suffit pas pour les commandes.** Un prix ou un plat ne doit jamais être « retrouvé » approximativement. **Solution hybride :** le **catalogue structuré** (articles, prix, horaires) vit en base relationnelle et est injecté intégralement dans le contexte ; le RAG vectoriel sert la documentation libre (livret, règles, recommandations). Les prix sont toujours recalculés côté serveur.
5. **L'IA ne doit jamais commander seule.** Toute action passe par une **carte de confirmation** affichée au client (grand bouton tactile). Rien n'est transmis à la réception sans ce geste.
6. **Les modèles cités sont dépassés.** GPT-4o-mini et Claude 3.5 Sonnet sont remplacés par **Claude Sonnet 5.5** (rapide, multilingue, 1M de contexte), configurable par variable d'environnement.

### 1.3 Risques résiduels

| Risque | Mitigation |
|---|---|
| Hallucination | Sources fermées (prompt + catalogue + RAG), seuil de pertinence, consigne « je vérifie auprès de la réception », outils validés côté serveur |
| Injection de prompt par un client | Règles dans le prompt système (autorité opérateur), contexte en message `system`, aucune donnée d'autres chambres accessible, toute action revalidée côté serveur |
| WhatsApp indisponible | La demande reste visible et actualisée en direct dans l'espace hôtel |
| Coût IA incontrôlé | Limiteur de débit par chambre, cache de prompt, effort de réflexion bas, plafond d'itérations d'outils |
| Adoption par le personnel | Aucun compte requis : le lien WhatsApp suffit pour prendre en charge une demande |

---

## 2. Langues, services et modèle par défaut

### 2.1 Langues

| Qui | Langues | Comportement |
|---|---|---|
| **Client** | Français (par défaut), English, Wolof, Español, Italiano, Deutsch, Português, العربية | Un bouton en haut de l'écran ouvre le choix de la langue. Le changement est **instantané et global** : interface, carte, cartes de demande, réponses déjà affichées (retraduites puis mises en cache sur chaque message) et réponses suivantes de l'assistant. L'arabe passe l'écran en droite-à-gauche, avec une police arabe dédiée. Le choix est mémorisé sur le téléphone. |
| **Équipe** | Français ou anglais (bascule FR/EN, mémorisée par cookie) | Toute demande s'affiche dans la langue de l'équipe, **quelle que soit la langue du client**. Le personnel voit aussi la langue parlée par le client (« Le client parle wolof »). |

**Principe :** l'assistant rédige chaque demande en **français, en anglais et dans la langue du client**. Les noms d'articles viennent des traductions de la carte, jamais d'une traduction improvisée. Les avis rédigés dans une autre langue sont traduits pour l'équipe, et l'original reste visible.

### 2.2 Services et routage

Six services reprennent l'organisation réelle d'un hôtel : réception, étages, restauration, technique, conciergerie et bien-être.

- Chaque rubrique de la carte est rattachée à un service ; chaque demande hors carte est routée selon sa nature. Le linge et le ménage vont aux étages, une panne va à la technique, un taxi à la conciergerie.
- Une commande mixte (un plat et un massage) est **découpée** : chaque service reçoit uniquement ce qui le concerne.
- Chaque service peut avoir son propre numéro WhatsApp. Sinon, tout arrive à la réception, ce qui est le cas d'un petit hôtel.
- Dans l'espace de l'équipe, des filtres par service permettent à chaque équipe de ne voir que ce qui la concerne.

### 2.3 Modèle par défaut

`src/lib/modele/` contient l'hôtel type issu de la recherche :

- **Carte complète** avec prix indicatifs, traduite dans les 8 langues.
- **Excursions et transfert aéroport adaptés à la zone** : Dakar, Petite Côte, Saint-Louis, Sine-Saloum, Casamance.
- **Livret d'accueil, règles de la maison et recommandations régionales.**

`creerHotelDepuisModele()` crée un hôtel prêt à l'emploi. Tout ce qui vient du modèle porte la mention **« À vérifier »** jusqu'à validation par le gérant, une par une ou en un seul geste.

### 2.4 Paiement

Hors périmètre pour cette version. Les prix sont affichés à titre indicatif et aucune transaction n'est gérée.

---

## 3. Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Interface client | **Next.js 16** (App Router, React 19), **Tailwind CSS 4**, PWA | Rendu serveur : premier affichage instantané après le scan, sans écran de chargement |
| Back-end | Route handlers + Server Actions Next.js (Node) | Un seul déploiement, typage de bout en bout |
| Base relationnelle | **PostgreSQL 17** + **Prisma 7** | Multi-tenant, transactions, migrations |
| Base vectorielle | **pgvector** (index HNSW, cosinus) dans le même PostgreSQL | Pas de second fournisseur ; filtre par hôtel et similarité dans **une seule requête SQL** |
| Embeddings | **Voyage AI `voyage-3.5`** (1024 dim., multilingue) | Une question en anglais retrouve un passage rédigé en français. Repli plein texte PostgreSQL si non configuré |
| LLM | **Claude Sonnet 5.5** via SDK Anthropic, streaming, outils | Qualité multilingue (dont wolof), outils fiables, cache de prompt |
| Notifications | **WhatsApp Cloud API** (Meta) | Le canal que le personnel hôtelier utilise déjà |
| Hébergement cible | Vercel (app) + Supabase ou Neon (PostgreSQL + pgvector) | Mêmes outils que les projets existants |

---

## 4. Vue d'ensemble

```
 Client (téléphone)                         Personnel
 ──────────────────                         ─────────
  scan QR ─► /c/{jeton}                      WhatsApp ─► /p/{jetonDemande}
      │      (rendu serveur)                 Espace ─► /espace/demandes · chambres · avis
      ▼
 ┌──────────────────────────── Next.js ─────────────────────────────┐
 │  POST /api/conversation ──► moteur de conversation (flux NDJSON) │
 │       │                         │                                │
 │       │                         ├── Claude Sonnet 5.5 (streaming)│
 │       │                         └── outils :                     │
 │       │                              rechercher_informations ──► RAG (pgvector)
 │       │                              proposer_commande ─────► catalogue (prix serveur)
 │       │                              demander_service              │
 │       │                              proposer_avis_sejour          │
 │  POST /api/demandes/{id} ──► confirmation ──► WhatsApp réception  │
 │  POST /api/avis ──► note ≤ 3 ──► WhatsApp direction               │
 └──────────────────────────────┬────────────────────────────────────┘
                                ▼
              PostgreSQL 17 + pgvector (multi-tenant, hotelId partout)
```

### 4.1 Parcours « commande »

1. Le client écrit « un thiéboudienne et un bissap » (ou touche **+** dans *La carte*).
2. Claude appelle `proposer_commande` avec des références courtes (`A4`, `A12`).
3. Le serveur valide les références, la disponibilité, **recalcule les prix**, crée une `Demande` au statut `PROPOSEE` et émet une carte dans le flux.
4. Le client touche **Confirmer** → `CONFIRMEE`, message WhatsApp au service concerné (ou à la réception), dans la langue de l'équipe, avec un lien d'action.
5. Le serveur d'étage touche **Je m'en occupe** puis **Marquer comme livrée** ; le client voit l'avancement en direct (Transmise → En cours → Terminée).

Une proposition non confirmée expire au bout de 30 minutes.

### 4.2 Parcours « avis »

- Déclencheurs : la veille et le jour du départ (carte affichée à l'ouverture), ou l'IA quand le client donne une appréciation globale ou annonce son départ.
- Note ≥ 4 : remerciement + bouton vers l'avis public (le clic est mesuré).
- Note ≤ 3 : message privé → alerte WhatsApp à la direction (« client encore présent, à recontacter ») ; le lien public reste accessible, discrètement.

---

## 5. Modèle de données relationnel

Stratégie multi-tenant : **schéma partagé**, colonne `hotelId` sur chaque table métier, filtrée systématiquement. Les accès client passent par le jeton de chambre ; les accès personnel par la session, qui porte le `hotelId`. Étape suivante possible : Row Level Security PostgreSQL en défense en profondeur.

| Table | Rôle | Champs clés |
|---|---|---|
| `Hotel` | Locataire | `slug`, `zone`, `couleurAccent`, `nomAssistant`, `langueEquipe`, `whatsappReception`, `whatsappDirection`, `lienAvisPublic`, `lienReservation`, `codeFidelite`, `wifi*`, `exigerSejourActif` |
| `ServiceHotel` | Services de l'hôtel | `departement` (RECEPTION, ETAGES, RESTAURATION, TECHNIQUE, CONCIERGERIE, BIEN_ETRE), `whatsapp` dédié facultatif |
| `Chambre` | Point d'entrée QR | `numero`, `jetonQr` (unique, opaque, révocable) |
| `Sejour` | Occupation | `arrivee`, `depart`, `statut`, `nomClient`, `avisSollicite` |
| `CategorieCatalogue` | Rubriques de la carte | `type`, `departement` (destinataire), `horaires`, `traductions`, `aVerifier` |
| `ArticleCatalogue` | **Source de vérité des prix** | `prix` (entier, FCFA, indicatif), `disponible`, `traductions` (7 langues), `aVerifier` |
| `Document` | Connaissance libre | `type` (livret, menu, consignes, FAQ, recommandations), `contenu` |
| `FragmentDocument` | Fragments indexés | `contenu`, `embedding vector(1024)`, `hotelId` dénormalisé |
| `Conversation` | Fil d'un séjour | `chambreId`, `sejourId`, `langue` |
| `Message` | Historique rejoué au modèle | `rang` (ordre strict), `role` (CLIENT / ASSISTANT / SYSTEME), `contenu` (blocs Anthropic exacts), `texte`, `traductions` (cache), jetons consommés |
| `Demande` | Commande / service / incident | `type`, `departement`, `statut`, `langueClient`, `resume` (fr), `traductions` (fr, en, langue du client), `montantTotal`, `urgent`, `jetonPersonnel`, horodatages du cycle |
| `LigneDemande` | Lignes de commande | `libelle`, `quantite`, `prixUnitaire`, `remarque`, `traductions` |
| `Avis` | E-réputation | `note`, `commentaire`, `langueClient`, `traductions` (pour l'équipe), `lienPublicOuvert`, `traite` |
| `Personnel` | Accès à l'espace hôtel | `email`, `motDePasseHash` (bcrypt), `role` (DIRECTION / RECEPTION) |

Schéma complet : [`prisma/schema.prisma`](../prisma/schema.prisma).

---

## 6. Base vectorielle

- **Stockage :** `FragmentDocument.embedding vector(1024)`, index **HNSW** `vector_cosine_ops`.
- **Découpage :** par sections (titres, paragraphes), environ 900 caractères, chaque fragment préfixé du titre de son document. Les livrets d'hôtel sont courts et structurés ; des fragments par section donnent les meilleurs résultats.
- **Requête :** `WHERE "hotelId" = $1 ORDER BY embedding <=> $2 LIMIT 4`, puis un **seuil de score (0,35)** : sous ce seuil, le passage est ignoré, et le modèle répond « je vérifie auprès de la réception » au lieu d'improviser.
- **Requêtes en français :** le modèle reformule chaque recherche en français, la langue des documents. La recherche reste précise même quand le client écrit en wolof ou en anglais, et le repli plein texte reste utilisable.
- **Pourquoi pas Pinecone ou Weaviate :** les volumes sont faibles (quelques centaines de fragments par hôtel) ; pgvector évite un fournisseur de plus, une synchronisation et une fuite possible entre locataires.
- **Réindexation :** `pnpm rag:indexer` (idempotent, document par document).

> ⚠ Prisma ne sait pas décrire l'index HNSW (colonne `Unsupported`). Chaque `prisma migrate dev` propose un `DROP INDEX "FragmentDocument_embedding_idx"` : il faut **supprimer cette ligne** des migrations générées.

---

## 7. Moteur IA

**Prompt en deux parties**

- **Prompt stable**, mis en cache : identité, règles, informations de l'hôtel, catalogue complet avec références courtes. Il est identique octet pour octet d'un tour à l'autre.
- **Contexte du tour** : heure locale, état du séjour, autorisation de commander. Il est ajouté après chaque message du client sous forme de message `system` en milieu de conversation, et jamais réécrit. L'historique est donc **en ajout seul** : le cache de prompt reste efficace et les blocs de réflexion rejoués restent valides.

**Outils**

| Outil | Effet | Garde-fous serveur |
|---|---|---|
| `rechercher_informations` | RAG sur la documentation de l'hôtel | Filtre `hotelId`, seuil de pertinence |
| `proposer_commande` | Carte de commande à confirmer | Références → identifiants, disponibilité, prix recalculés, séjour actif |
| `demander_service` | Carte de service ou d'incident | Résumé **en français** pour le personnel ; un incident urgent passe même sans séjour |
| `proposer_avis_sejour` | Carte d'avis | — |

Chaque entrée d'outil est revalidée avec Zod : avec le streaming anticipé des entrées, l'API ne la valide plus elle-même.

**Paramètres :** `claude-sonnet-5-5`, effort `low` (la réactivité prime en conversation), réflexion adaptative, `fallbacks: "default"` (repli automatique si un classifieur de sécurité refuse), blocs de réflexion invalides ignorés (`drop_block`) plutôt que de provoquer une erreur 400.

**Robustesse :** un tour est **atomique**. En cas d'échec, tous les messages qu'il a écrits sont supprimés, pour qu'un appel d'outil sans résultat ne casse pas la conversation suivante. Côté client, une carte « Réessayer » s'affiche.

**Estimation de coût (à valider sur données réelles) :** environ 3 500 jetons de prompt en cache, 1 000 à 2 000 jetons d'historique et environ 150 jetons de réponse, soit **0,5 à 1 centime de dollar par message**. Pour 15 messages par séjour, cela fait environ 0,10 à 0,15 $ par séjour. Un hôtel de 50 chambres revient à quelques dizaines de dollars par mois. `LALLA_MODELE_IA=claude-haiku-5-5` divise ce coût par environ 20, avec une qualité moindre et sans repli serveur.

---

## 8. Sécurité

- Jeton QR de 12 caractères (alphabet de 57 symboles, environ 70 bits), non énumérable, régénérable par la direction.
- Commandes possibles uniquement pendant un séjour actif. Une conversation ne peut être reprise que dans le même séjour : le client suivant ne voit jamais l'historique du précédent.
- Lien WhatsApp du personnel : jeton de 16 caractères propre à une seule demande, sans aucun autre droit.
- Session du personnel : JWT HS256 en cookie `httpOnly`, 12 h ; chaque action revérifie la session et filtre par `hotelId`.
- Limiteur de débit : 20 messages par 10 min et par chambre, 8 tentatives de connexion par 15 min. Il est en mémoire : en production multi-instance, passer à Upstash Redis.
- Mots de passe bcrypt, comparaison en temps constant, y compris pour un e-mail inconnu.

---

## 9. Structure du projet

```
lalla/
├── docs/ARCHITECTURE.md          ← ce document
├── docker-compose.yml            PostgreSQL 17 + pgvector (port 5436)
├── prisma/
│   ├── schema.prisma             modèle de données
│   ├── migrations/               SQL versionné (dont l'extension vector et l'index HNSW)
│   └── semence.ts                hôtel de démonstration complet
├── scripts/indexer-documents.ts  réindexation RAG
└── src/
    ├── app/
    │   ├── page.tsx              page produit (démo commerciale)
    │   ├── c/[jeton]/            ★ interface client (QR)
    │   ├── p/[jeton]/            action du personnel depuis WhatsApp
    │   ├── espace/               espace hôtel (FR/EN) : demandes par service, chambres (+ QR imprimable),
    │   │                         carte, informations, avis, réglages
    │   └── api/                  conversation (flux NDJSON), demandes, avis
    ├── composants/
    │   ├── concierge/            Accueil, Fil, CarteDemande, CarteAvis, FeuilleCarte, Compositeur…
    │   └── espace/               composants de l'espace hôtel
    └── lib/
        ├── ia/                   moteur, prompt système, outils, traduction, client partagé
        ├── modele/               modèle par défaut : carte, documents, création d'un hôtel
        ├── rag/                  découpage, embeddings, indexation, recherche
        ├── notifications/        WhatsApp
        ├── demandes.ts           cycle de vie des demandes
        ├── avis.ts               passerelle d'e-réputation
        ├── contexte-chambre.ts   jeton QR → hôtel, chambre, séjour
        ├── langues.ts            langues client (8) et équipe (2), repli des traductions
        └── i18n/                 dictionnaires : client.ts (8 langues), equipe.ts (FR/EN)
```

---

## 10. Design system

- **Fond** `#f7f8f3`, surfaces blanches, encre `#1a1b17`, une seule couleur d'accent : **celle de l'hôtel** (`Hotel.couleurAccent`, injectée en variable CSS ; les déclinaisons pâle et profonde sont calculées avec `color-mix`).
- **Typographie :** Instrument Serif (titres, nom de l'hôtel) et Manrope (texte). Taille minimale de 16 px dans les champs, pour éviter le zoom automatique d'iOS.
- **Interactions :** boutons de confirmation de 56 px, retour haptique à la confirmation, animations d'apparition douces, respect de `prefers-reduced-motion`.
- **Lisibilité :** l'assistant n'a pas de bulle (texte éditorial avec monogramme) ; le client a une bulle encre. Le gras et les listes sont rendus sans HTML injecté.

---

## 11. Démarrage local

```bash
pnpm install
cp .env.example .env.local        # renseigner ANTHROPIC_API_KEY (et VOYAGE_API_KEY si possible)
pnpm bdd:demarrer                 # docker compose : PostgreSQL + pgvector
pnpm bdd:deployer                 # migrations
pnpm bdd:semer                    # hôtel de démo « Hôtel & Spa » (sans nom propre)
pnpm dev
```

- Client : http://localhost:3000/c/chambre304
- Espace hôtel : http://localhost:3000/espace (`direction@hotel-saly.sn` / `lalla2026`)

---

## 12. Feuille de route

**MVP (ce dépôt)** :
- interface client complète en 8 langues ;
- moteur IA avec outils et RAG hybride ;
- routage des demandes par service et WhatsApp ;
- avis traduits pour l'équipe ;
- modèle par défaut adapté à la zone ;
- espace hôtel en FR/EN : demandes en direct par service, arrivées et départs, QR imprimable, carte modifiable, informations, avis, réglages.

**V1 — pilote hôtel**

- Relecture des traductions en wolof et en arabe par des locuteurs natifs.
- Inscription d'un nouvel hôtel en libre-service (formulaire branché sur `creerHotelDepuisModele`).
- Modèle WhatsApp soumis à Meta ; numéro WhatsApp Business de l'hôtel.
- Saisie vocale (le wolof est surtout parlé).
- Mode nuit (écran sombre entre 22 h et 7 h).
- Statistiques : questions fréquentes (que l'hôtel doit documenter), langues, heures de pointe.
- Row Level Security PostgreSQL, Upstash Redis, Sentry.

**V2 — échelle**

- Intégration PMS (Opera, Mews…) : séjours automatiques, facturation sur la note.
- Offres de réservation directe personnalisées en fin de séjour.
- Tableau de bord multi-hôtels pour les groupes.
