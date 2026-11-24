-- Index HNSW (similarité cosinus) sur les embeddings.
-- ⚠ Prisma ne sait pas décrire cet index (colonne Unsupported) : chaque
-- `prisma migrate dev` proposera un « DROP INDEX FragmentDocument_embedding_idx ».
-- Supprimer cette ligne des migrations générées avant de les appliquer.
CREATE INDEX IF NOT EXISTS "FragmentDocument_embedding_idx"
  ON "FragmentDocument" USING hnsw ("embedding" vector_cosine_ops);
