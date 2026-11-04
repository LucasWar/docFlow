import { config } from "../config.mjs";
import { ValidationError } from "../errors.mjs";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KEY_REGEX = new RegExp(
  `^${escapeRegex(config.uploadPrefix)}` +
    `([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})` +
    `-([^/]+)\\.pdf$`,
  "i",
);

export function extractDocumentId(key) {
  const match = key.match(KEY_REGEX);
  if (!match) {
    throw new ValidationError(
      `Key inválida: esperado "${config.uploadPrefix}<documentId>-arquivo.pdf"`,
    );
  }
  return match[1].toLowerCase();
}

export function validateBucket(bucket) {
  const { allowedBuckets } = config;
  if (allowedBuckets.length > 0 && !allowedBuckets.includes(bucket)) {
    throw new ValidationError(`Bucket não permitido: ${bucket}`);
  }
}
