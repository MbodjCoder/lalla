// (Ré)indexation d'un document : découpage + embeddings + écriture.
// Idempotent : les anciens fragments du document sont remplacés.
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { decouperDocument } from "@/lib/rag/decoupage";
import { calculerEmbeddings, embeddingsDisponibles, versLitteralVecteur } from "@/lib/rag/embeddings";

export async function indexerDocument(bdd: PrismaClient, documentId: string): Promise<number> {
  const document = await bdd.document.findUniqueOrThrow({ where: { id: documentId } });
  const fragments = decouperDocument(document.titre, document.contenu);
  const vecteurs = embeddingsDisponibles() ? await calculerEmbeddings(fragments, "document") : null;

  await bdd.$transaction(async (tx) => {
    await tx.fragmentDocument.deleteMany({ where: { documentId } });
    for (const [ordre, contenu] of fragments.entries()) {
      const vecteur = vecteurs ? versLitteralVecteur(vecteurs[ordre]) : null;
      await tx.$executeRaw`
        INSERT INTO "FragmentDocument" (id, "hotelId", "documentId", ordre, contenu, embedding)
        VALUES (${randomUUID()}, ${document.hotelId}, ${documentId}, ${ordre}, ${contenu}, ${vecteur}::vector)
      `;
    }
  });

  return fragments.length;
}
