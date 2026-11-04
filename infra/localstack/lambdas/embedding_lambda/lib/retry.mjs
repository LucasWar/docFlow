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
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET",
]);
const TRANSIENT_NAMES = new Set(["TimeoutError", "AbortError"]);

export function isTransient(err) {
  if (!err || err instanceof ValidationError) return false;
  if (err.retryable === true) return true;
  if (PRISMA_TRANSIENT.has(err.code)) return true;
  if (NETWORK_CODES.has(err.code) || NETWORK_CODES.has(err.cause?.code)) return true;
  return TRANSIENT_NAMES.has(err.name);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa `fn` com retry + backoff exponencial (equal jitter).
 * - Só repete erros transitórios (ver isTransient).
 * - Respeita `err.retryAfterMs` (header Retry-After), limitado a maxDelayMs.
 * - Respeita `deadline` (timestamp em ms): sem tempo para esperar, propaga o erro.
 */
export async function withRetry(
  fn,
  {
    label = "operação",
    attempts = 3,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    shouldRetry = isTransient,
    deadline,
  } = {},
) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= attempts || !shouldRetry(err)) throw err;

      const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const delay =
        err.retryAfterMs > 0 ? Math.min(err.retryAfterMs, maxDelayMs) : cap / 2 + Math.random() * (cap / 2);

      if (deadline && Date.now() + delay >= deadline) throw err;

      console.warn(
        `[retry] ${label} falhou (tentativa ${attempt}/${attempts}): ${err.message}. Nova tentativa em ${Math.round(delay)}ms`,
      );
      await sleep(delay);
    }
  }
}
