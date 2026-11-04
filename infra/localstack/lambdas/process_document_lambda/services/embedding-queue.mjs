import { GetQueueUrlCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqs } from "../clients.mjs";
import { config } from "../config.mjs";

let cachedQueueUrl = config.sqsQueueUrl;

async function getQueueUrl() {
  if (cachedQueueUrl) return cachedQueueUrl;

  const { QueueUrl } = await sqs.send(
    new GetQueueUrlCommand({ QueueName: config.sqsQueueName }),
  );
  if (!QueueUrl) throw new Error(`Fila ${config.sqsQueueName} não encontrada`);

  cachedQueueUrl = QueueUrl;
  return QueueUrl;
}

/**
 * Envia o documento para a fila de embeddings.
 * O retry fica por conta do SDK (maxAttempts). Se o envio falhar, o documento vira
 * FAILED e a mensagem original volta ao SQS; o consumidor deve ser idempotente.
 */
export async function enqueueEmbedding(documentId) {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: await getQueueUrl(),
      MessageBody: JSON.stringify({ documentId }),
    }),
  );
  console.log(`documentId ${documentId} enviado para a fila de embeddings`);
}
