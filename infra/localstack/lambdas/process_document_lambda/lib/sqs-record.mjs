import { ValidationError } from "../errors.mjs";

/** Converte um record do SQS em uma lista de { bucket, key } vindos da notificação do S3. */
export function parseS3Objects(record) {
  let body;
  try {
    body = JSON.parse(record.body);
  } catch {
    throw new ValidationError("Corpo da mensagem não é um JSON válido");
  }

  if (!Array.isArray(body.Records)) {
    console.log("Evento ignorado:", body.Event ?? "sem Records");
    return [];
  }

  return body.Records.map((r) => {
    try {
      return {
        bucket: r.s3.bucket.name,
        key: decodeURIComponent(r.s3.object.key.replace(/\+/g, " ")),
      };
    } catch {
      throw new ValidationError("Key do S3 com encoding inválido ou evento malformado");
    }
  });
}
