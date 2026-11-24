/*
  Warnings:

  - Added the required column `departement` to the `Demande` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Departement" AS ENUM ('RECEPTION', 'ETAGES', 'RESTAURATION', 'TECHNIQUE', 'CONCIERGERIE', 'BIEN_ETRE');

-- CreateEnum
CREATE TYPE "ZoneTouristique" AS ENUM ('DAKAR', 'PETITE_COTE', 'SAINT_LOUIS', 'SINE_SALOUM', 'CASAMANCE', 'AUTRE');

-- AlterTable
ALTER TABLE "ArticleCatalogue" ADD COLUMN     "aVerifier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "traductions" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "CategorieCatalogue" ADD COLUMN     "aVerifier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "departement" "Departement" NOT NULL DEFAULT 'RESTAURATION',
ADD COLUMN     "traductions" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Demande" ADD COLUMN     "departement" "Departement" NOT NULL DEFAULT 'RECEPTION',
ADD COLUMN     "langueClient" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "traductions" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "aVerifier" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "langueEquipe" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "zone" "ZoneTouristique" NOT NULL DEFAULT 'DAKAR';

-- AlterTable
ALTER TABLE "LigneDemande" ADD COLUMN     "traductions" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "traductions" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "ServiceHotel" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "departement" "Departement" NOT NULL,
    "whatsapp" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceHotel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceHotel_hotelId_departement_key" ON "ServiceHotel"("hotelId", "departement");

-- CreateIndex
CREATE INDEX "Demande_hotelId_departement_statut_idx" ON "Demande"("hotelId", "departement", "statut");

-- AddForeignKey
ALTER TABLE "ServiceHotel" ADD CONSTRAINT "ServiceHotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Valeur par défaut temporaire, uniquement pour les demandes existantes
ALTER TABLE "Demande" ALTER COLUMN "departement" DROP DEFAULT;
