import { config } from "../config.mjs";
import { TimeBudgetError } from "../errors.mjs";
import { batches } from "../lib/batches.mjs";
import { claimDocument, findPendingChunks, markCompleted, markFailed, saveEmbeddings } from "./document.repository.mjs";
import { generateEmbeddings } from "./embedding.client.mjs";

/** Retorna a quantidade de chunks processados, ou null se o documento foi ignorado. */
export async function processDocument(documentId, { deadline }) {
  const claimed = await claimDocument(documentId);
  if (!claimed) {
    console.log(`Documento ${documentId} inexistente ou já concluído. Ignorando.`);
    return null;
  }

  // A partir daqui qualquer falha fica registrada no documento.
  try {
    const chunks = await findPendingChunks(documentId);

    for (const batch of batches(chunks, config.batchSize)) {
      // O progresso já gravado é preservado (embedding IS NULL): a próxima entrega retoma daqui.
      if (Date.now() >= deadline) {
        throw new TimeBudgetError("Tempo da Lambda quase esgotado; o processamento será retomado de onde parou");
      }

      const embeddings = await generateEmbeddings(
        batch.map((chunk) => chunk.content),
        { deadline },
      );
      await saveEmbeddings(batch, embeddings);
    }

    await markCompleted(documentId);
    return chunks.length;
  } catch (err) {
    await markFailed(documentId, err);
    throw err; // o handler decide se a mensagem volta para a fila
  }
}
