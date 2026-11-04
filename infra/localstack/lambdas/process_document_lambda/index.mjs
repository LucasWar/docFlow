import { ValidationError } from "./errors.mjs";
import { parseS3Objects } from "./lib/sqs-record.mjs";
import { processPdf } from "./services/process-pdf.mjs";

async function processRecord(record) {
  for (const { bucket, key } of parseS3Objects(record)) {
    await processPdf(bucket, key);
  }
}

export const handler = async (event) => {
  const batchItemFailures = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (err) {
      if (err instanceof ValidationError) {
        // Erro permanente: já registrado no documento; reenviar não adianta.
        console.warn(`Mensagem ${record.messageId} rejeitada: ${err.message}`);
        continue;
      }
      console.error(`Erro ao processar mensagem ${record.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
