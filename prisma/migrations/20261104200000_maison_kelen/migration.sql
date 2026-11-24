-- L'hôtel de démonstration prend un nom inventé, « Maison Kelen » : « Domaine de la Corniche » est le nom
-- d'un hôtel réel. Nouveau logo (emblème et nom), et le nom remplacé partout où le client peut le lire,
-- y compris dans les conversations déjà tenues. Les identifiants techniques (lien de chambre, adresses de
-- connexion) restent inchangés.
UPDATE "Hotel"
SET "nom" = 'Maison Kelen',
    "sousTitre" = 'Hôtel & Spa',
    "logoUrl" = '/images/logos/maison-kelen.svg',
    "lienReservation" = REPLACE("lienReservation", 'domaine-corniche.example', 'maison-kelen.example'),
    "codeFidelite" = REPLACE("codeFidelite", 'CORNICHE', 'KELEN'),
    "wifiReseau" = REPLACE("wifiReseau", 'Corniche-', 'Kelen-')
WHERE "slug" = 'domaine-corniche';

UPDATE "Message"
SET "texte" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("texte",
      'au Domaine de la Corniche', 'à la Maison Kelen'),
      'Domaine de la Corniche', 'Maison Kelen'),
      'Corniche-Invites', 'Kelen-Invites'),
      'domaine-corniche.example', 'maison-kelen.example'),
      'CORNICHE10', 'KELEN10'),
      'the Maison Kelen', 'Maison Kelen'),
    "contenu" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("contenu"::text,
      'au Domaine de la Corniche', 'à la Maison Kelen'),
      'Domaine de la Corniche', 'Maison Kelen'),
      'Corniche-Invites', 'Kelen-Invites'),
      'domaine-corniche.example', 'maison-kelen.example'),
      'CORNICHE10', 'KELEN10'),
      'the Maison Kelen', 'Maison Kelen')::jsonb,
    "traductions" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("traductions"::text,
      'au Domaine de la Corniche', 'à la Maison Kelen'),
      'Domaine de la Corniche', 'Maison Kelen'),
      'Corniche-Invites', 'Kelen-Invites'),
      'domaine-corniche.example', 'maison-kelen.example'),
      'CORNICHE10', 'KELEN10'),
      'the Maison Kelen', 'Maison Kelen')::jsonb
WHERE "texte" ILIKE '%corniche%' OR "contenu"::text ILIKE '%corniche%' OR "traductions"::text ILIKE '%corniche%';
