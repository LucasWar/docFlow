import { ValidationError } from "../errors.mjs";

const PRISMA_TRANSIENT = new Set([
  "P1001", // banco inacessível
  "P1002", // timeout ao alcançar o banco
  "P1008", // timeout de operação
  "P1017", // conexão encerrada pelo servidor
  "P2024", // timeout aguardando conexão do pool
  "P2028", // erro na API de transação
  "P2034", // conflito de escrita/deadlock
]);
const NETWORK_CODES = new Set([
  "ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND",
]);
const TRANSIENT_NAMES = new Set([
  "TimeoutError", "RequestTimeout", "ThrottlingException", "SlowDown",
  "InternalError", "ServiceUnavailable", "TooManyRequestsException",
]);

export function isTransient(err) {
  if (!err || err instanceof ValidationError) return false;
  if (err.retryable === true) return true;
  if (err.$retryable) return true;
  if (PRISMA_TRANSIENT.has(err.code)) return true;
  if (NETWORK_CODES.has(err.code)) return true;
  if (TRANSIENT_NAMES.has(err.name)) return true;
  const status = err.$metadata?.httpStatusCode;
  return status === 429 || status >= 500;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa `fn` com retry + backoff exponencial com full jitter.
 * Só repete erros considerados transitórios (ver isTransient).
 * Atenção: o tempo total precisa caber no timeout da Lambda.
 */
export async function withRetry(
  fn,
  { label = "operação", attempts = 3, baseDelayMs = 300, maxDelayMs = 5000, shouldRetry = isTransient } = {},
) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= attempts || !shouldRetry(err)) throw err;
      const delay = Math.random() * Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      console.warn(
        `[retry] ${label} falhou (tentativa ${attempt}/${attempts}): ${err.message}. Nova tentativa em ${Math.round(delay)}ms`,
      );
      await sleep(delay);
    }
  }
}
