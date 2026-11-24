-- Police, taille et couleur de chaque texte, réglées par la direction
ALTER TABLE "Hotel" ADD COLUMN "typographie" JSONB NOT NULL DEFAULT '{}';
