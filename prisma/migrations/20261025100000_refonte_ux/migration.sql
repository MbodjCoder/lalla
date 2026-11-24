-- Refonte UX : articles non ajoutés et heure d'arrivée annoncée sur les demandes,
-- délais habituels des services sur l'hôtel
ALTER TABLE "Demande" ADD COLUMN "articlesRefuses" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "prevueLe" TIMESTAMP(3);

ALTER TABLE "Hotel" ADD COLUMN "delaiRestauration" INTEGER DEFAULT 30,
ADD COLUMN "delaiEtages" INTEGER DEFAULT 15,
ADD COLUMN "delaiTechnique" INTEGER DEFAULT 20;
