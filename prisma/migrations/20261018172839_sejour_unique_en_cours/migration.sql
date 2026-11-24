-- Un seul séjour en cours par chambre, garanti par la base (deux arrivées simultanées)
-- Index partiel : inexprimable dans schema.prisma, à préserver si une migration générée propose de le supprimer
CREATE UNIQUE INDEX "Sejour_chambreId_en_cours_unique" ON "Sejour"("chambreId") WHERE "statut" = 'EN_COURS';
