import { ValidationError } from "../errors.mjs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extrai e valida o documentId de um record do SQS. */
export function parseDocumentId(record) {
  let message;
  try {
    message = JSON.parse(record.body);
  } catch {
    throw new ValidationError("Corpo da mensagem não é um JSON válido");
  }

  const { documentId } = message ?? {};
  if (!documentId) throw new ValidationError("documentId ausente na mensagem");
  if (typeof documentId !== "string" || !UUID_REGEX.test(documentId)) {
    throw new ValidationError(`documentId inválido: ${String(documentId).slice(0, 64)}`);
  }
  return documentId.toLowerCase();
}
