-- Verrou de tour par conversation (bail daté)
ALTER TABLE "Conversation" ADD COLUMN "tourVerrouilleJusqua" TIMESTAMP(3);
