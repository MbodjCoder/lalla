-- Santé des modèles d'IA partagée entre les instances (quota épuisé, lenteur)
CREATE TABLE "EtatModeleIA" (
    "modele" TEXT NOT NULL,
    "indisponibleJusqua" TIMESTAMP(3),
    "lentJusqua" TIMESTAMP(3),
    "latenceMs" INTEGER,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtatModeleIA_pkey" PRIMARY KEY ("modele")
);
