import { assertConfig, config } from "./config.mjs";
import { ValidationError } from "./errors.mjs";
import { parseDocumentId } from "./lib/sqs-message.mjs";
import { processDocument } from "./services/process-document.mjs";

export const handler = async (event, context) => {
  assertConfig();

  // Prazo interno: tempo restante da Lambda menos uma folga para fechar o processamento.
  const remainingMs = context?.getRemainingTimeInMillis?.() ?? 15 * 60 * 1000;
  const deadline = Date.now() + remainingMs - config.safetyMarginMs;

  const batchItemFailures = [];

  for (const record of event.Records) {
    // Sem tempo nem para começar: devolve à fila sem tocar no documento.
    if (Date.now() >= deadline) {
      console.warn(`Mensagem ${record.messageId} devolvida à fila: tempo da Lambda esgotado`);
      batchItemFailures.push({ itemIdentifier: record.messageId });
      continue;
    }

    try {
      const documentId = parseDocumentId(record);
      const processed = await processDocument(documentId, { deadline });

      if (processed !== null) {
        console.info("Documento processado", {
          documentId,
          chunks: processed,
          model: config.modelLabel,
        });
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        // Erro permanente: já registrado no documento (quando há um); reenviar não adianta.
        console.warn(`Mensagem ${record.messageId} rejeitada: ${err.message}`);
        continue;
      }
      console.error(`Erro ao processar mensagem ${record.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
