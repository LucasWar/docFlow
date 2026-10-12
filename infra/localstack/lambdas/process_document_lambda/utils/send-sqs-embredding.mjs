import {
  SQSClient,
  GetQueueUrlCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";

export const sqs = new SQSClient({
  region: "us-east-1",
  endpoint: "http://host.docker.internal:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

export async function getChunksQueueUrl() {
  const queueName = 'embeddingqueue';

  if (!queueName) {
    throw new Error("SQS_CHUNKS_QUEUE_NAME não configurada");
  }

  const response = await sqs.send(
    new GetQueueUrlCommand({ QueueName: queueName }),
  );

  if (!response.QueueUrl) {
    throw new Error(`Fila ${queueName} não encontrada`);
  }

  return response.QueueUrl;
}

export async function sendDocumentIdToSqs(documentId) {
  const queueUrl = await getChunksQueueUrl();

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        documentId,
      }),
    }),
  );

  console.log('documentId enviado com sucesso');
}