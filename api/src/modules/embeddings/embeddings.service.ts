import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';

interface LocalEmbeddingResponse {
  embeddings?: number[][];
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  private readonly url =
    process.env.MODEL_URL ?? 'http://localhost:8000/embeddings';

  private readonly dimensions = 384;

  private static readonly MAX_RETRIES = 2;
  private static readonly TIMEOUT_MS = 10_000;

  /** Gera o embedding normalizado de uma query de busca. */
  async embedQuery(text: string): Promise<number[]> {
    if (!text?.trim()) {
      throw new Error('O texto da busca não pode ser vazio');
    }

    for (let attempt = 0; attempt <= EmbeddingsService.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ texts: [text] }),
          signal: AbortSignal.timeout(EmbeddingsService.TIMEOUT_MS),
        });

        if (response.ok) {
          const result = (await response.json()) as LocalEmbeddingResponse;

          const vector = result.embeddings?.[0];

          if (
            !Array.isArray(vector) ||
            vector.length !== this.dimensions ||
            !vector.every(Number.isFinite)
          ) {
            this.logger.error('O serviço local retornou um embedding inválido');

            throw new ServiceUnavailableException(
              'Falha ao gerar embedding da busca',
            );
          }

          return EmbeddingsService.normalize(vector);
        }

        const retryable = response.status === 429 || response.status >= 500;

        if (!retryable || attempt >= EmbeddingsService.MAX_RETRIES) {
          this.logger.error(
            `Serviço de embeddings HTTP ${response.status}: ` +
              (await response.text()),
          );

          throw new ServiceUnavailableException(
            'Falha ao gerar embedding da busca',
          );
        }

        const retryAfter = Number(response.headers.get('retry-after'));

        const delay =
          retryAfter > 0
            ? retryAfter * 1000
            : Math.min(1000 * 2 ** attempt, 5000);

        this.logger.warn(
          `Embeddings HTTP ${response.status}; nova tentativa em ${delay}ms`,
        );

        await sleep(delay);
      } catch (error) {
        if (error instanceof ServiceUnavailableException) {
          throw error;
        }

        if (attempt >= EmbeddingsService.MAX_RETRIES) {
          this.logger.error(
            'Não foi possível acessar o serviço local de embeddings',
            error instanceof Error ? error.stack : String(error),
          );

          throw new ServiceUnavailableException(
            'Serviço de embeddings indisponível',
          );
        }

        const delay = Math.min(1000 * 2 ** attempt, 5000);

        this.logger.warn(
          `Falha de conexão ou timeout; nova tentativa em ${delay}ms`,
        );

        await sleep(delay);
      }
    }

    throw new ServiceUnavailableException('Falha ao gerar embedding da busca');
  }

  private static normalize(vector: number[]): number[] {
    const norm = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );

    return norm === 0 ? vector : vector.map((value) => value / norm);
  }
}
