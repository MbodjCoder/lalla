-- Logo de démonstration sans « Saly » : nouvelle adresse pour contourner le cache des navigateurs (1 jour)
UPDATE "Hotel" SET "logoUrl" = '/images/logos/logo-hotel.svg?v=2'
WHERE "logoUrl" = '/images/logos/logo-hotel.svg';
