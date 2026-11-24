# Lalla

Concierge IA de chambre d'hôtel, accessible par QR code, pensé pour l'hôtellerie sénégalaise. Aucune application à installer, aucun compte à créer : le client scanne le QR, écrit dans sa langue, et Lalla répond, prend ses commandes et veille à sa satisfaction, au nom de l'hôtel.

## Démarrage

```bash
pnpm install
cp .env.example .env.local   # ANTHROPIC_API_KEY requis pour converser
pnpm bdd:demarrer            # PostgreSQL 17 + pgvector (Docker, port 5436)
pnpm bdd:deployer && pnpm bdd:semer
pnpm dev
```

| | URL |
|---|---|
| Client, chambre 304 | http://localhost:3000/c/chambre304 |
| Espace hôtel, direction | http://localhost:3000/espace (`direction@hotel-saly.sn` / `lalla2026`) |
| Espace hôtel, réception | `reception@hotel-saly.sn` / `lalla2026` |

Sans `WHATSAPP_JETON`, les notifications s'affichent dans la console du serveur. Sans `VOYAGE_API_KEY`, la recherche documentaire bascule en plein texte PostgreSQL.

## Langues

Côté client, l'interface s'ouvre en français et propose 8 langues ; un bouton en haut de l'écran bascule tout, assistant compris. Côté équipe, l'interface est en français ou en anglais, quelle que soit la langue du client.

## Déploiement (gratuit)

En ligne : **https://lalla-five.vercel.app** — Vercel (fonctions à Francfort, `fra1`) et
PostgreSQL Neon (Francfort, pgvector), créé depuis Vercel (intégration Neon, offre gratuite).

- **Mettre en ligne** : `vercel deploy --prod`. La construction (`pnpm vercel-build`) génère le
  client Prisma, applique les migrations (connexion directe `DATABASE_URL_UNPOOLED`), puis compile.
- **Variables** (projet Vercel) : `DATABASE_URL` (poolée) et `DATABASE_URL_UNPOOLED` (fournies par
  Neon), `SECRET_SESSION`, `URL_PUBLIQUE`, `GEMINI_API_KEY`, `BDD_CONNEXIONS_MAX`. Jamais dans le code.
- **Limite de durée des requêtes** : posée sur le rôle de la base (`ALTER ROLE … SET statement_timeout = '15s'`),
  le pooler refusant ce paramètre à la connexion.
- **Démo en ligne** : `SEMENCE_MOT_DE_PASSE=… pnpm bdd:semer` avec les variables de production ; le mot de
  passe de démo local est refusé sur une base en ligne. Identifiants : `.env.identifiants` (local, ignoré par Git).

## Documentation

L'architecture, le modèle de données, la base vectorielle, le moteur IA, la sécurité et la feuille de route sont décrits dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). L'étude du marché hôtelier sénégalais qui fonde le modèle par défaut se trouve dans [docs/RECHERCHE-HOTELLERIE-SENEGAL.md](docs/RECHERCHE-HOTELLERIE-SENEGAL.md).
