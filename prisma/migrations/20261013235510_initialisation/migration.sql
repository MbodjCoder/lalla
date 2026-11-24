-- Extension pgvector (recherche sémantique)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "StatutSejour" AS ENUM ('EN_COURS', 'TERMINE');

-- CreateEnum
CREATE TYPE "TypeCategorie" AS ENUM ('RESTAURATION', 'BOISSONS', 'BIEN_ETRE', 'TRANSPORT', 'EXPERIENCE', 'SERVICE');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('LIVRET_ACCUEIL', 'MENU', 'CONSIGNES', 'FAQ', 'RECOMMANDATIONS', 'AUTRE');

-- CreateEnum
CREATE TYPE "RoleMessage" AS ENUM ('CLIENT', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "TypeDemande" AS ENUM ('COMMANDE', 'SERVICE', 'INCIDENT');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('PROPOSEE', 'CONFIRMEE', 'PRISE_EN_CHARGE', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "RolePersonnel" AS ENUM ('DIRECTION', 'RECEPTION');

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "couleurAccent" TEXT NOT NULL DEFAULT '#6f7d5c',
    "logoUrl" TEXT,
    "nomAssistant" TEXT NOT NULL DEFAULT 'Lalla',
    "langueParDefaut" TEXT NOT NULL DEFAULT 'fr',
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "fuseauHoraire" TEXT NOT NULL DEFAULT 'Africa/Dakar',
    "telephoneReception" TEXT,
    "whatsappReception" TEXT,
    "whatsappDirection" TEXT,
    "lienAvisPublic" TEXT,
    "lienReservation" TEXT,
    "codeFidelite" TEXT,
    "wifiReseau" TEXT,
    "wifiMotDePasse" TEXT,
    "heureCheckout" TEXT NOT NULL DEFAULT '12:00',
    "exigerSejourActif" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chambre" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "etage" INTEGER,
    "jetonQr" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sejour" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "chambreId" TEXT NOT NULL,
    "nomClient" TEXT,
    "arrivee" TIMESTAMP(3) NOT NULL,
    "depart" TIMESTAMP(3) NOT NULL,
    "statut" "StatutSejour" NOT NULL DEFAULT 'EN_COURS',
    "avisSollicite" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sejour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorieCatalogue" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypeCategorie" NOT NULL,
    "horaires" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategorieCatalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleCatalogue" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "prix" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArticleCatalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "TypeDocument" NOT NULL,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "contenu" TEXT NOT NULL,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FragmentDocument" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "contenu" TEXT NOT NULL,
    "embedding" vector(1024),

    CONSTRAINT "FragmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "chambreId" TEXT NOT NULL,
    "sejourId" TEXT,
    "langue" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dernierMessageLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "RoleMessage" NOT NULL,
    "contenu" JSONB NOT NULL,
    "texte" TEXT,
    "jetonsEntree" INTEGER,
    "jetonsSortie" INTEGER,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demande" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "chambreId" TEXT NOT NULL,
    "sejourId" TEXT,
    "conversationId" TEXT,
    "type" "TypeDemande" NOT NULL,
    "statut" "StatutDemande" NOT NULL DEFAULT 'PROPOSEE',
    "resume" TEXT NOT NULL,
    "details" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "montantTotal" INTEGER NOT NULL DEFAULT 0,
    "jetonPersonnel" TEXT NOT NULL,
    "notifiee" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmeeLe" TIMESTAMP(3),
    "priseEnChargeLe" TIMESTAMP(3),
    "termineeLe" TIMESTAMP(3),

    CONSTRAINT "Demande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneDemande" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "articleId" TEXT,
    "libelle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" INTEGER NOT NULL,
    "remarque" TEXT,

    CONSTRAINT "LigneDemande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avis" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "chambreId" TEXT NOT NULL,
    "sejourId" TEXT,
    "note" INTEGER NOT NULL,
    "commentaire" TEXT,
    "lienPublicOuvert" BOOLEAN NOT NULL DEFAULT false,
    "traite" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" "RolePersonnel" NOT NULL DEFAULT 'RECEPTION',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_slug_key" ON "Hotel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Chambre_jetonQr_key" ON "Chambre"("jetonQr");

-- CreateIndex
CREATE UNIQUE INDEX "Chambre_hotelId_numero_key" ON "Chambre"("hotelId", "numero");

-- CreateIndex
CREATE INDEX "Sejour_hotelId_statut_idx" ON "Sejour"("hotelId", "statut");

-- CreateIndex
CREATE INDEX "Sejour_chambreId_statut_idx" ON "Sejour"("chambreId", "statut");

-- CreateIndex
CREATE INDEX "CategorieCatalogue_hotelId_idx" ON "CategorieCatalogue"("hotelId");

-- CreateIndex
CREATE INDEX "ArticleCatalogue_hotelId_disponible_idx" ON "ArticleCatalogue"("hotelId", "disponible");

-- CreateIndex
CREATE INDEX "Document_hotelId_idx" ON "Document"("hotelId");

-- CreateIndex
CREATE INDEX "FragmentDocument_hotelId_idx" ON "FragmentDocument"("hotelId");

-- CreateIndex
CREATE INDEX "Conversation_hotelId_creeLe_idx" ON "Conversation"("hotelId", "creeLe");

-- CreateIndex
CREATE INDEX "Message_conversationId_creeLe_idx" ON "Message"("conversationId", "creeLe");

-- CreateIndex
CREATE UNIQUE INDEX "Demande_jetonPersonnel_key" ON "Demande"("jetonPersonnel");

-- CreateIndex
CREATE INDEX "Demande_hotelId_statut_creeLe_idx" ON "Demande"("hotelId", "statut", "creeLe");

-- CreateIndex
CREATE INDEX "Avis_hotelId_creeLe_idx" ON "Avis"("hotelId", "creeLe");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_email_key" ON "Personnel"("email");

-- CreateIndex
CREATE INDEX "Personnel_hotelId_idx" ON "Personnel"("hotelId");

-- AddForeignKey
ALTER TABLE "Chambre" ADD CONSTRAINT "Chambre_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sejour" ADD CONSTRAINT "Sejour_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sejour" ADD CONSTRAINT "Sejour_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "Chambre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorieCatalogue" ADD CONSTRAINT "CategorieCatalogue_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCatalogue" ADD CONSTRAINT "ArticleCatalogue_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCatalogue" ADD CONSTRAINT "ArticleCatalogue_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieCatalogue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FragmentDocument" ADD CONSTRAINT "FragmentDocument_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FragmentDocument" ADD CONSTRAINT "FragmentDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "Chambre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_sejourId_fkey" FOREIGN KEY ("sejourId") REFERENCES "Sejour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "Chambre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_sejourId_fkey" FOREIGN KEY ("sejourId") REFERENCES "Sejour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDemande" ADD CONSTRAINT "LigneDemande_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "Demande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDemande" ADD CONSTRAINT "LigneDemande_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "ArticleCatalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avis" ADD CONSTRAINT "Avis_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avis" ADD CONSTRAINT "Avis_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "Chambre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avis" ADD CONSTRAINT "Avis_sejourId_fkey" FOREIGN KEY ("sejourId") REFERENCES "Sejour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index HNSW (similarité cosinus) sur les embeddings
CREATE INDEX "FragmentDocument_embedding_idx" ON "FragmentDocument" USING hnsw ("embedding" vector_cosine_ops);
