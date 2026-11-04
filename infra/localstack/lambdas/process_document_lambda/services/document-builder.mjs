import { randomUUID } from "node:crypto";
import { config } from "../config.mjs";
import { ValidationError } from "../errors.mjs";
import { chunkText, cleanText } from "../lib/text.mjs";

/** Transforma o texto bruto das páginas em registros de página e chunk prontos para inserir. */
export function buildPagesAndChunks(documentId, rawPages) {
  const pages = [];
  const chunks = [];
  let chunkCounter = 0;
  let totalChars = 0;

  rawPages.forEach((rawText, i) => {
    const content = cleanText(rawText);
    if (!content) return;

    totalChars += content.length;
    if (totalChars > config.maxTotalChars) {
      throw new ValidationError(`Texto extraído excede o limite de ${config.maxTotalChars} caracteres`);
    }

    const pageId = randomUUID();
    pages.push({ id: pageId, documentId, pageNumber: i + 1, content });

    for (const piece of chunkText(content, config.chunkSize, config.chunkOverlap)) {
      chunks.push({
        id: randomUUID(),
        documentId,
        pageId,
        chunkIndex: String(chunkCounter++),
        content: piece,
      });
    }
  });

  return { pages, chunks };
}
