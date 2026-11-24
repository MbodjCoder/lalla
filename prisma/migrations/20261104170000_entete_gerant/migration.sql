-- En-tête du gérant aligné sur celui du client, rubriques de l'accueil agrandies :
-- le nom de l'hôtel et les noms des rubriques reprennent leurs nouveaux styles d'origine
UPDATE "Hotel" SET "typographie" = "typographie" - 'nomHotel' - 'rubriquesTableau';
