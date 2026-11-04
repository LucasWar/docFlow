import { extractDocumentId, validateBucket } from "../lib/s3-key.mjs";
import { buildPagesAndChunks } from "./document-builder.mjs";
import { claimDocument, markFailed, replaceDocumentContent, savePageCount } from "./document.repository.mjs";
import { enqueueEmbedding } from "./embedding-queue.mjs";
import { assertPdfMagicBytes, extractPdfPages } from "./pdf.service.mjs";
import { downloadObject, getValidatedMetadata } from "./storage.service.mjs";

export async function processPdf(bucket, key) {
  console.log(`Validando s3://${bucket}/${key}`);

  // Validações que ainda não identificam um documento: se falharem, não há o que marcar.
  validateBucket(bucket);
  const documentId = extractDocumentId(key);

  const claimed = await claimDocument(documentId);
  if (!claimed) {
    console.log(`Documento ${documentId} inexistente ou já processado/em processamento. Ignorando.`);
    return;
  }

  // A partir daqui qualquer falha fica registrada no documento.
  try {
    const { etag } = await getValidatedMetadata(bucket, key);

    const bytes = await downloadObject(bucket, key, etag);
    assertPdfMagicBytes(bytes);

    const { totalPages, pages: rawPages } = await extractPdfPages(bytes);
    console.log(`PDF com ${totalPages} página(s)`);
    await savePageCount(documentId, totalPages);

    const { pages, chunks } = buildPagesAndChunks(documentId, rawPages);
    await replaceDocumentContent(documentId, pages, chunks);
    await enqueueEmbedding(documentId);

    console.log(`Documento ${documentId}: ${pages.length} páginas e ${chunks.length} chunks salvos`);
  } catch (err) {
    await markFailed(documentId, err);
    throw err; // o handler decide se a mensagem volta para a fila
  }
}
