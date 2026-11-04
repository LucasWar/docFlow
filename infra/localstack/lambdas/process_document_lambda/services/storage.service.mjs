import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../clients.mjs";
import { config } from "../config.mjs";
import { ObjectChangedError, ValidationError } from "../errors.mjs";
import { withRetry } from "../lib/retry.mjs";

const statusOf = (err) => err.$metadata?.httpStatusCode;

/** HEAD + validações de tamanho e content-type. (O SDK já faz retry interno do HEAD.) */
export async function getValidatedMetadata(bucket, key) {
  let head;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    if (err.name === "NotFound" || statusOf(err) === 404) {
      throw new ValidationError("Objeto não encontrado no S3");
    }
    throw err;
  }

  const size = head.ContentLength ?? 0;
  if (size <= 0) throw new ValidationError("Arquivo vazio");
  if (size > config.maxFileSize) {
    throw new ValidationError(`Arquivo excede o limite: ${size} bytes (máx ${config.maxFileSize})`);
  }

  const contentType = (head.ContentType ?? "").split(";")[0].trim().toLowerCase();
  if (!config.allowedContentTypes.has(contentType)) {
    throw new ValidationError(`Content-Type não permitido: ${contentType || "vazio"}`);
  }

  return { etag: head.ETag, size };
}

/**
 * Baixa o objeto inteiro. O retry envolve também a leitura do stream, pois o SDK
 * não repete falhas ocorridas no meio do download do body.
 */
export function downloadObject(bucket, key, etag) {
  return withRetry(
    async () => {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: etag }));
        const bytes = await res.Body.transformToByteArray();
        if (bytes.length > config.maxFileSize) {
          throw new ValidationError("Arquivo baixado excede o limite de tamanho");
        }
        return bytes;
      } catch (err) {
        if (err.name === "PreconditionFailed" || statusOf(err) === 412) {
          throw new ObjectChangedError("O arquivo foi alterado no S3 durante o processamento", { cause: err });
        }
        if (err.name === "NoSuchKey" || statusOf(err) === 404) {
          throw new ValidationError("Objeto não encontrado no S3");
        }
        throw err;
      }
    },
    { label: "s3:GetObject" },
  );
}
