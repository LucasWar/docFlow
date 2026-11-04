import { prisma } from "../clients.mjs";
import { config } from "../config.mjs";
import { toErrorMessage } from "../errors.mjs";
import { withRetry } from "../lib/retry.mjs";
import { toVectorLiteral } from "../lib/vector.mjs";

/**
 * Reivindica o documento para (re)processamento. Aceita PROCESSING (fluxo normal, vindo da
 * lambda de extração) e FAILED (nova entrega após falha). COMPLETED/inexistente → false.
 */
export async function claimDocument(documentId) {
  const { count } = await withRetry(
    () =>
      prisma.document.updateMany({
        where: { id: documentId, status: { in: ["PROCESSING", "FAILED"] } },
        data: { status: "PROCESSING", errorMessage: null },
      }),
    { label: "db:claimDocument" },
  );
  return count > 0;
}

/** Chunks ainda sem embedding: o que torna o reprocessamento retomável e idempotente. */
export function findPendingChunks(documentId) {
  return withRetry(
    () => prisma.$queryRaw`
      SELECT id::text AS id, content
      FROM document_chunks
      WHERE document_id = ${documentId}::uuid
        AND embedding IS NULL
      ORDER BY chunk_index
    `,
    { label: "db:findPendingChunks" },
  );
}

/** Grava o lote inteiro numa transação: ou todos os vetores do lote entram, ou nenhum. */
export function saveEmbeddings(batch, embeddings) {
  const modelLabel = config.modelLabel;

  return withRetry(
    () =>
      prisma.$transaction(
        batch.map(
          (chunk, i) => prisma.$executeRaw`
            UPDATE document_chunks
            SET embedding = ${toVectorLiteral(embeddings[i])}::vector(384),
                embedding_model = ${modelLabel}
            WHERE id = ${chunk.id}::uuid
              AND embedding IS NULL
          `,
        ),
      ),
    { label: "db:saveEmbeddings" },
  );
}

export function markCompleted(documentId) {
  return withRetry(
    () =>
      prisma.document.update({
        where: { id: documentId },
        data: { status: "COMPLETED", errorMessage: null },
      }),
    { label: "db:markCompleted" },
  );
}

/** Marca FAILED + errorMessage. Nunca lança: não pode mascarar o erro original. */
export async function markFailed(documentId, err) {
  try {
    await withRetry(
      () =>
        prisma.document.update({
          where: { id: documentId },
          data: { status: "FAILED", errorMessage: toErrorMessage(err) },
        }),
      { label: "db:markFailed", attempts: 4 },
    );
  } catch (dbErr) {
    console.error(`Não foi possível marcar o documento ${documentId} como FAILED:`, dbErr);
  }
}
