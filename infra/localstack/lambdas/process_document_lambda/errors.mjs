import { config } from "./config.mjs";

/** Base de todos os erros conhecidos do processamento. */
export class ProcessingError extends Error {
  constructor(message, { cause, retryable = false } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.retryable = retryable;
  }
}

/** Erro permanente (entrada inválida). Reprocessar não adianta: não volta pra fila. */
export class ValidationError extends ProcessingError {}

/** Erro temporário (rede, throttling, banco). Pode ser reprocessado. */
export class TransientError extends ProcessingError {
  constructor(message, opts = {}) {
    super(message, { ...opts, retryable: true });
  }
}

/** O objeto mudou no S3 entre o HEAD e o GET (ETag diferente). Só um novo ciclo resolve. */
export class ObjectChangedError extends ProcessingError {}

/** Texto amigável que será gravado em Document.errorMessage. */
export function toErrorMessage(err) {
  let message;
  if (err instanceof ValidationError) {
    message = err.message;
  } else if (err instanceof ProcessingError) {
    message = `Falha no processamento (nova tentativa agendada): ${err.message}`;
  } else {
    message = `Erro inesperado (nova tentativa agendada): ${err?.message ?? String(err)}`;
  }
  return message.slice(0, config.maxErrorMessageLength);
}
