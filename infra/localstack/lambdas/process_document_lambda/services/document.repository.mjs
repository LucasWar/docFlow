import { prisma } from "../clients.mjs";
import { config } from "../config.mjs";
import { toErrorMessage } from "../errors.mjs";
import { withRetry } from "../lib/retry.mjs";

function* batches(arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

/** Reivindica o documento atomicamente. Retorna false se não existe ou já está em andamento/processado. */
export async function claimDocument(documentId) {
  const { count } = await withRetry(
    () =>
      prisma.document.updateMany({
        where: { id: documentId, status: { in: ["QUEUED", "FAILED"] } },
        data: { status: "PROCESSING", errorMessage: null },
      }),
    { label: "db:claimDocument" },
  );
  return count > 0;
}

export function savePageCount(documentId, pageCount) {
  return withRetry(
    () => prisma.document.update({ where: { id: documentId }, data: { pageCount } }),
    { label: "db:savePageCount" },
  );
}

/**
 * Substitui páginas e chunks do documento numa única transação.
 * É idempotente (apaga antes de inserir), então o retry da transação inteira é seguro.
 */
export function replaceDocumentContent(documentId, pages, chunks) {
  return withRetry(
    () =>
      prisma.$transaction(
        async (tx) => {
          await tx.documentChunk.deleteMany({ where: { documentId } });
          await tx.documentPage.deleteMany({ where: { documentId } });

          for (const batch of batches(pages, config.insertBatch)) {
            await tx.documentPage.createMany({ data: batch });
          }
          for (const batch of batches(chunks, config.insertBatch)) {
            await tx.documentChunk.createMany({ data: batch });
          }
        },
        { timeout: 60_000 },
      ),
    { label: "db:replaceDocumentContent" },
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
