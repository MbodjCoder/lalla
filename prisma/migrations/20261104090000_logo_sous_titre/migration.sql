-- Mention sous le nom de l'hôtel (en-tête du client), ex. « Hôtel & Spa »
ALTER TABLE "Hotel" ADD COLUMN "sousTitre" TEXT;

-- Hôtel de démonstration : son logo et sa mention
UPDATE "Hotel"
SET "logoUrl" = '/images/logos/domaine-corniche.svg', "sousTitre" = 'Hôtel & Spa'
WHERE "slug" = 'domaine-corniche';
