-- Couleur des composants de l'interface de l'équipe (tableau de bord, cercles, pastilles)
ALTER TABLE "Hotel" ADD COLUMN "couleursEquipe" JSONB NOT NULL DEFAULT '{}';
