
-- AlterTable
ALTER TABLE "Avis" ADD COLUMN     "langueClient" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "traductions" JSONB NOT NULL DEFAULT '{}';
