
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMBEDDINGS_URL = process.env.API_KEY_MODEL;

const MODEL_NAME = process.env.EMBEDDING_MODEL;

const DIMENSIONS = 384;

// O endpoint Python aceita até 32 textos por chamada.
const BATCH_SIZE = 32;
const MAX_RETRIES = 5;
const REQUEST_TIMEOUT_MS = 60_000;

const MODEL_LABEL = `${MODEL_NAME}@${DIMENSIONS}`;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function normalize(vector) {
  const norm = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );

  return norm === 0
    ? vector
    : vector.map((value) => value / norm);
}

async function generateEmbeddings(texts) {
  if (!EMBEDDINGS_URL) {
    throw new Error("EMBEDDINGS_URL não configurada");
  }

  if (texts.length === 0) {
    return [];
  }

  if (texts.length > BATCH_SIZE) {
    throw new Error(
      `Máximo de ${BATCH_SIZE} textos por chamada`,
    );
  }

  const body = JSON.stringify({ texts });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt === MAX_RETRIES) {
          throw new Error(
            `Serviço de embeddings retornou HTTP ${response.status}`,
          );
        }

        const retryAfter = Number(
          response.headers.get("retry-after"),
        );

        const delay =
          retryAfter > 0
            ? retryAfter * 1000
            : Math.min(1000 * 2 ** attempt, 30_000);

        console.warn(
          `Embeddings HTTP ${response.status}; ` +
          `nova tentativa em ${delay}ms`,
        );

        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const detail = await response.text();

        throw new Error(
          `Embeddings HTTP ${response.status}: ${detail}`,
        );
      }

      const result = await response.json();

      if (
        !Array.isArray(result.embeddings) ||
        result.embeddings.length !== texts.length ||
        result.embeddings.some(
          (vector) =>
            !Array.isArray(vector) ||
            vector.length !== DIMENSIONS ||
            !vector.every(Number.isFinite),
        )
      ) {
        throw new Error("Resposta de embeddings inválida");
      }

      return result.embeddings.map(normalize);
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }

      // Não repete erros HTTP permanentes nem respostas inválidas.
      // O serviço deve receber novamente apenas falhas transitórias.
      if (
        error.message.startsWith("Embeddings HTTP 4") ||
        error.message === "Resposta de embeddings inválida"
      ) {
        throw error;
      }

      const delay = Math.min(
        1000 * 2 ** attempt,
        30_000,
      );

      console.warn(
        `Falha na chamada de embeddings; ` +
        `tentativa ${attempt + 1}/${MAX_RETRIES}, ` +
        `aguardando ${delay}ms`,
        error.message,
      );

      await sleep(delay);
    }
  }

  throw new Error("Falha inesperada ao gerar embeddings");
}

async function processDocument(documentId) {
  const chunks = await prisma.$queryRaw`
    SELECT id::text AS id, content
    FROM document_chunks
    WHERE document_id = ${documentId}::uuid
      AND embedding IS NULL
    ORDER BY chunk_index
  `;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const embeddings = await generateEmbeddings(
      batch.map((chunk) => chunk.content),
    );

    // Persiste somente depois que o lote inteiro foi gerado.
    for (let j = 0; j < batch.length; j++) {
      const vector = `[${embeddings[j].join(",")}]`;

      await prisma.$executeRaw`
        UPDATE document_chunks
        SET embedding = ${vector}::vector(384),
            embedding_model = ${MODEL_LABEL}
        WHERE id = ${batch[j].id}::uuid
          AND embedding IS NULL
      `;
    }
  }

  return chunks.length;
}

export const handler = async (event) => {
  const failures = [];

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);

      if (!message.documentId) {
        throw new Error("documentId ausente na mensagem");
      }

      const processed = await processDocument(
        message.documentId,
      );

      console.info("Documento processado", {
        documentId: message.documentId,
        chunks: processed,
        model: MODEL_LABEL,
      });
    } catch (error) {
      console.error("Falha ao processar mensagem SQS", {
        messageId: record.messageId,
        error: error.message,
      });

      failures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  return { batchItemFailures: failures };
};
