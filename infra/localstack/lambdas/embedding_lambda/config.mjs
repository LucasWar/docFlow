const num = (value, fallback) => Number(value ?? fallback);

export const config = {
  // EMBEDDINGS_URL é o nome correto; API_KEY_MODEL continua aceito por compatibilidade.
  embeddingsUrl: process.env.EMBEDDINGS_URL ?? process.env.API_KEY_MODEL,
  modelName: process.env.EMBEDDING_MODEL,

  // Precisa bater com a coluna `embedding vector(384)` (o SQL usa o literal 384).
  dimensions: 384,

  // O endpoint Python aceita até 32 textos por chamada.
  batchSize: 32,
  maxRetries: num(process.env.MAX_RETRIES, 5),
  requestTimeoutMs: num(process.env.REQUEST_TIMEOUT_MS, 60_000),

  // Folga reservada antes do timeout da Lambda (para gravar FAILED e encerrar limpo).
  safetyMarginMs: num(process.env.LAMBDA_SAFETY_MARGIN_MS, 15_000),

  maxErrorMessageLength: 1000,

  get modelLabel() {
    return `${this.modelName}@${this.dimensions}`;
  },
};

/** Erro de configuração do deploy: derruba a invocação (não é culpa de nenhum documento). */
export function assertConfig() {
  const missing = [];
  if (!config.embeddingsUrl) missing.push("EMBEDDINGS_URL");
  if (!config.modelName) missing.push("EMBEDDING_MODEL");
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente não configuradas: ${missing.join(", ")}`);
  }
}
