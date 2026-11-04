const num = (value, fallback) => Number(value ?? fallback);
const list = (value) =>
  (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);

export const config = {
  chunkSize: num(process.env.CHUNK_SIZE, 500),
  chunkOverlap: num(process.env.CHUNK_OVERLAP, 80),
  insertBatch: 1000,

  maxFileSize: num(process.env.MAX_FILE_SIZE_BYTES, 20 * 1024 * 1024), // 20 MB
  maxPages: num(process.env.MAX_PAGES, 500),
  maxTotalChars: num(process.env.MAX_TOTAL_CHARS, 5_000_000),

  allowedBuckets: list(process.env.ALLOWED_BUCKETS),
  allowedContentTypes: new Set([
    "application/pdf",
    "application/x-pdf",
    "application/octet-stream",
  ]),
  uploadPrefix: process.env.UPLOAD_PREFIX ?? "uploads/",

  // Fila de embeddings: prefira SQS_QUEUE_URL; senão resolve pelo nome (1x por cold start).
  sqsQueueUrl: process.env.SQS_QUEUE_URL,
  sqsQueueName: process.env.SQS_QUEUE_NAME ?? "embeddingqueue",
  sqsEndpoint: process.env.SQS_ENDPOINT, // só para ambiente local (LocalStack)

  maxErrorMessageLength: 1000,
};
