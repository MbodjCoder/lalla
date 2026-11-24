-- AlterEnum
ALTER TYPE "TypeDemande" ADD VALUE 'QUESTION';

-- AlterTable
ALTER TABLE "Demande" ADD COLUMN     "reponse" TEXT,
ADD COLUMN     "reponseMessageId" TEXT,
ADD COLUMN     "reponseTraductions" JSONB NOT NULL DEFAULT '{}';
