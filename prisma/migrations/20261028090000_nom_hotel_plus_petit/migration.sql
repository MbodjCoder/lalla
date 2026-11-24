-- Nom de l'hôtel (barre du haut de l'équipe) : 18 px au lieu de 22 px ; les réglages restés à l'ancienne taille d'origine suivent
UPDATE "Hotel"
SET "typographie" = jsonb_set("typographie", '{nomHotel,taille}', '18')
WHERE "typographie"->'nomHotel'->>'taille' = '22';
