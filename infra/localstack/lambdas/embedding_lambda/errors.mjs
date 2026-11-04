import { config } from "./config.mjs";

/** Base de todos os erros conhecidos do processamento. */
export class ProcessingError extends Error {
  constructor(message, { cause, retryable = false } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.retryable = retryable;
  }
}

/** Erro permanente (mensagem inválida, requisição rejeitada com 4xx). Reprocessar não adianta. */
export class ValidationError extends ProcessingError {}

/** Erro temporário (rede, 429/5xx, banco). Pode ser repetido. */
export class TransientError extends ProcessingError {
  constructor(message, { retryAfterMs, ...opts } = {}) {
    super(message, { ...opts, retryable: true });
    this.retryAfterMs = retryAfterMs;
  }
}

/** O serviço respondeu 200, mas com formato/quantidade/dimensões inesperados. */
export class InvalidResponseError extends ProcessingError {}

/** Tempo da Lambda quase esgotado. O progresso já gravado é retomado na próxima entrega. */
export class TimeBudgetError extends ProcessingError {}

/** Texto que será gravado em Document.errorMessage. */
export function toErrorMessage(err) {
  let message;
  if (err instanceof ValidationError) {
    message = err.message;
  } else if (err instanceof ProcessingError) {
    message = `Falha no processamento: ${err.message}`;
  } else {
    message = `Erro inesperado: ${err?.message ?? String(err)}`;
  }
  return message.slice(0, config.maxErrorMessageLength);
}
