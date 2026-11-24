-- L'hôtel de démonstration n'a plus de nom propre : son logo (emblème, « Hôtel & Spa », Saly) suffit.
-- Ses identifiants suivent : lien de chambre, adresses de connexion, réseau Wi-Fi, code fidélité.
UPDATE "Hotel"
SET "nom" = 'Hôtel & Spa',
    "sousTitre" = NULL,
    "logoUrl" = '/images/logos/logo-hotel.svg',
    "slug" = 'hotel-saly',
    "lienReservation" = REPLACE("lienReservation", 'maison-kelen.example', 'hotel-saly.example'),
    "codeFidelite" = REPLACE("codeFidelite", 'KELEN', 'SEJOUR'),
    "wifiReseau" = REPLACE("wifiReseau", 'Kelen-', 'Hotel-')
WHERE "slug" = 'domaine-corniche';

UPDATE "Chambre" SET "jetonQr" = 'chambre304'
WHERE "jetonQr" = 'corniche304' AND NOT EXISTS (SELECT 1 FROM "Chambre" WHERE "jetonQr" = 'chambre304');

UPDATE "Personnel" SET "email" = REPLACE("email", '@domaine-corniche.sn', '@hotel-saly.sn')
WHERE "email" LIKE '%@domaine-corniche.sn';

-- Les conversations déjà tenues : le nom devient « l'hôtel »
UPDATE "Message"
SET "texte" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("texte",
      'au sein du Maison Kelen', 'au sein de l''hôtel'),
      'à la Maison Kelen', 'à l''hôtel'),
      'within the Maison Kelen', 'within the hotel'),
      'داخل Maison Kelen', 'داخل الفندق'),
      'Maison Kelen', 'l''hôtel'),
      'Kelen-Invites', 'Hotel-Invites'),
      'maison-kelen.example', 'hotel-saly.example'),
      'KELEN10', 'SEJOUR10'),
    "contenu" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("contenu"::text,
      'au sein du Maison Kelen', 'au sein de l''hôtel'),
      'à la Maison Kelen', 'à l''hôtel'),
      'within the Maison Kelen', 'within the hotel'),
      'داخل Maison Kelen', 'داخل الفندق'),
      'Maison Kelen', 'l''hôtel'),
      'Kelen-Invites', 'Hotel-Invites'),
      'maison-kelen.example', 'hotel-saly.example'),
      'KELEN10', 'SEJOUR10')::jsonb,
    "traductions" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("traductions"::text,
      'au sein du Maison Kelen', 'au sein de l''hôtel'),
      'à la Maison Kelen', 'à l''hôtel'),
      'within the Maison Kelen', 'within the hotel'),
      'داخل Maison Kelen', 'داخل الفندق'),
      'Maison Kelen', 'l''hôtel'),
      'Kelen-Invites', 'Hotel-Invites'),
      'maison-kelen.example', 'hotel-saly.example'),
      'KELEN10', 'SEJOUR10')::jsonb
WHERE "texte" ILIKE '%kelen%' OR "contenu"::text ILIKE '%kelen%' OR "traductions"::text ILIKE '%kelen%';
