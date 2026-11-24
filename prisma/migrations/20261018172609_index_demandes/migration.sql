-- CreateIndex
CREATE INDEX "Demande_hotelId_statut_termineeLe_idx" ON "Demande"("hotelId", "statut", "termineeLe");

-- CreateIndex
CREATE INDEX "Demande_conversationId_statut_idx" ON "Demande"("conversationId", "statut");

-- CreateIndex
CREATE INDEX "Demande_sejourId_idx" ON "Demande"("sejourId");
