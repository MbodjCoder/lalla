-- DropIndex
DROP INDEX "Message_conversationId_creeLe_idx";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "rang" SERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "Message_conversationId_rang_idx" ON "Message"("conversationId", "rang");
