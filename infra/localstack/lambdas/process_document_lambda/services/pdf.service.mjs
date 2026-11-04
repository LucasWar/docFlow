import { getDocumentProxy, extractText } from "unpdf";
import { config } from "../config.mjs";
import { ValidationError } from "../errors.mjs";

export function assertPdfMagicBytes(bytes) {
  const header = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (!header.includes("%PDF-")) {
    throw new ValidationError("Conteúdo não é um PDF válido (assinatura %PDF- ausente)");
  }
}

/** Retorna { totalPages, pages: string[] } com o texto bruto de cada página. */
export async function extractPdfPages(bytes) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > config.maxPages) {
      throw new ValidationError(
        `PDF excede o limite de páginas: ${pdf.numPages} (máx ${config.maxPages})`,
      );
    }
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    return { totalPages, pages: text };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(`Falha ao interpretar o PDF: ${err.message}`, { cause: err });
  }
}
