import { config } from "../config.mjs";
import { InvalidResponseError, TimeBudgetError, TransientError, ValidationError } from "../errors.mjs";
import { withRetry } from "../lib/retry.mjs";
import { normalize } from "../lib/vector.mjs";

function parseRetryAfter(response) {
  const seconds = Number(response.headers.get("retry-after"));
  return seconds > 0 ? seconds * 1000 : undefined;
}

function assertValidEmbeddings(result, expectedCount) {
  const isValidVector = (v) =>
    Array.isArray(v) && v.length === config.dimensions && v.every(Number.isFinite);

  if (
    !Array.isArray(result?.embeddings) ||
    result.embeddings.length !== expectedCount ||
    !result.embeddings.every(isValidVector)
  ) {
    throw new InvalidResponseError(
      `Resposta de embeddings inválida (esperado ${expectedCount} vetores de ${config.dimensions} dimensões)`,
    );
  }
}

async function requestEmbeddings(texts, expectedCount, deadline) {
  // Nunca deixa uma requisição passar do tempo restante da Lambda.
  const timeoutMs = Math.min(config.requestTimeoutMs, deadline - Date.now());
  if (timeoutMs <= 0) throw new TimeBudgetError("Tempo da Lambda esgotado ao chamar o serviço de embeddings");

  let response;
  try {
    response = await fetch(config.embeddingsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, kind: 'passage' }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new TransientError(
      `Falha de rede ao chamar o serviço de embeddings: ${err.cause?.code ?? err.message}`,
      { cause: err },
    );
  }

  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    throw new TransientError(`Serviço de embeddings retornou HTTP ${response.status}`, {
      retryAfterMs: parseRetryAfter(response),
    });
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new ValidationError(
      `Serviço de embeddings rejeitou a requisição (HTTP ${response.status}): ${detail}`,
    );
  }

  let result;
  try {
    result = await response.json();
  } catch (err) {
    throw new TransientError("Resposta do serviço de embeddings não é um JSON válido", { cause: err });
  }

  assertValidEmbeddings(result, expectedCount);
  return result.embeddings.map(normalize);
}

/** Gera embeddings normalizados para até `batchSize` textos, com retry em falhas transitórias. */
export async function generateEmbeddings(texts, { deadline = Infinity } = {}) {
  if (texts.length === 0) return [];
  if (texts.length > config.batchSize) {
    throw new Error(`Máximo de ${config.batchSize} textos por chamada`);
  }

  const body = JSON.stringify({ texts });

  return withRetry(() => requestEmbeddings(texts, texts.length, deadline), {
    label: "embeddings:request",
    attempts: config.maxRetries + 1,
    baseDelayMs: 1000,
    maxDelayMs: 30_000,
    deadline,
  });
}
