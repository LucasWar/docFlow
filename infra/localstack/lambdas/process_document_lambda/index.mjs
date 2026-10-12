import { randomUUID } from "node:crypto";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getDocumentProxy, extractText } from "unpdf";
import { PrismaClient } from "@prisma/client";
import { sendDocumentIdToSqs } from "./utils/send-sqs-embredding.mjs";

const s3 = new S3Client({ forcePathStyle: true });
const prisma = new PrismaClient();

const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 500);
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP ?? 80);
const INSERT_BATCH = 1000;

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES ?? 20 * 1024 * 1024); // 20 MB
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 500);
const MAX_TOTAL_CHARS = Number(process.env.MAX_TOTAL_CHARS ?? 5_000_000);
const ALLOWED_BUCKETS = (process.env.ALLOWED_BUCKETS ?? "")
  .split(",")
  .map((b) => b.trim())
  .filter(Boolean);
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
]);

const BREAKERS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];
const isSpace = (c) => c === undefined || /\s/.test(c);

const UPLOAD_PREFIX = process.env.UPLOAD_PREFIX ?? "uploads/";

const KEY_REGEX = new RegExp(
  `^${UPLOAD_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` +
    `([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})` +
    `-([^/]+)\\.pdf$`,
  "i",
);


class ValidationError extends Error {}

export const handler = async (event) => {
  const batchItemFailures = [];

  for (const record of event.Records) {
    try {
      let body;
      try {
        body = JSON.parse(record.body);
      } catch {
        throw new ValidationError("Corpo da mensagem não é um JSON válido");
      }

      if (!Array.isArray(body.Records)) {
        console.log("Evento ignorado:", body.Event ?? "sem Records");
        continue;
      }

      for (const s3Record of body.Records) {
        const bucket = s3Record.s3.bucket.name;
        let key;
        try {
          key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, " "));
        } catch {
          throw new ValidationError("Key do S3 com encoding inválido");
        }
        await processPdf(bucket, key);
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        console.warn(`Mensagem ${record.messageId} rejeitada: ${err.message}`);
        continue;
      }
      console.error(`Erro ao processar mensagem ${record.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};

function extractDocumentId(key) {
  const match = key.match(KEY_REGEX);
  if (!match) {
    throw new ValidationError(
      `Key inválida: esperado "<documentId>/arquivo.pdf" com extensão .pdf`,
    );
  }
  return match[1].toLowerCase();
}

function validateBucket(bucket) {
  if (ALLOWED_BUCKETS.length > 0 && !ALLOWED_BUCKETS.includes(bucket)) {
    throw new ValidationError(`Bucket não permitido: ${bucket}`);
  }
}

async function validateMetadata(bucket, key) {
  let head;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      throw new ValidationError("Objeto não encontrado no S3");
    }
    throw err;
  }

  const size = head.ContentLength ?? 0;
  if (size <= 0) throw new ValidationError("Arquivo vazio");
  if (size > MAX_FILE_SIZE) {
    throw new ValidationError(
      `Arquivo excede o limite: ${size} bytes (máx ${MAX_FILE_SIZE})`,
    );
  }

  const contentType = (head.ContentType ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new ValidationError(`Content-Type não permitido: ${contentType || "vazio"}`);
  }

  return { etag: head.ETag, size };
}

function assertPdfMagicBytes(bytes) {
  const header = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (!header.includes("%PDF-")) {
    throw new ValidationError("Conteúdo não é um PDF válido (assinatura %PDF- ausente)");
  }
}

async function processPdf(bucket, key) {
  console.log(`Validando s3://${bucket}/${key}`);

  validateBucket(bucket);
  const documentId = extractDocumentId(key);
  const { etag } = await validateMetadata(bucket, key);

  const claimed = await prisma.document.updateMany({
    where: { id: documentId, status: { in: ["QUEUED", "FAILED"] } },
    data: { status: "PROCESSING" },
  });
  if (claimed.count === 0) {
    console.log(`Documento ${documentId} inexistente ou já processado/em processamento. Ignorando.`);
    return;
  }

  try {
    await extractAndSave(bucket, key, documentId, etag);
  } catch (err) {
    if (err instanceof ValidationError) {
      await prisma.document
        .update({ where: { id: documentId }, data: { status: "FAILED" } })
        .catch((e) => console.error("Falha ao marcar FAILED:", e));
    } else {
      await prisma.document
        .update({ where: { id: documentId }, data: { status: "QUEUED" } })
        .catch((e) => console.error("Falha ao reverter status:", e));
    }
    throw err;
  }
}

async function extractAndSave(bucket, key, documentId, etag) {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: etag }),
  );
  const bytes = await res.Body.transformToByteArray();

  if (bytes.length > MAX_FILE_SIZE) {
    throw new ValidationError("Arquivo baixado excede o limite de tamanho");
  }
  assertPdfMagicBytes(bytes);

  let totalPages, text;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > MAX_PAGES) {
      throw new ValidationError(`PDF excede o limite de páginas: ${pdf.numPages} (máx ${MAX_PAGES})`);
    }
    ({ totalPages, text } = await extractText(pdf, { mergePages: false }));
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(`Falha ao interpretar o PDF: ${err.message}`);
  }
  console.log(`PDF com ${totalPages} página(s)`);

  const pages = [];
  const chunks = [];
  let chunkCounter = 0;
  let totalChars = 0;

  text.forEach((rawText, i) => {
    const content = cleanText(rawText);
    if (!content) return;
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      throw new ValidationError(`Texto extraído excede o limite de ${MAX_TOTAL_CHARS} caracteres`);
    }

    const pageId = randomUUID();
    pages.push({ id: pageId, documentId, pageNumber: i + 1, content });

    for (const piece of chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP)) {
      chunks.push({
        id: randomUUID(),
        documentId,
        pageId,
        chunkIndex: String(chunkCounter++),
        content: piece,
      });
    }
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.documentPage.deleteMany({ where: { documentId } });

      for (const batch of batches(pages, INSERT_BATCH)) {
        await tx.documentPage.createMany({ data: batch });
      }
      for (const batch of batches(chunks, INSERT_BATCH)) {
        await tx.documentChunk.createMany({ data: batch });
      }

      await tx.document.update({
        where: { id: documentId },
        data: { pageCount: totalPages, status: "COMPLETED" },
      });
    },
    { timeout: 60_000 },
  );
  await sendDocumentIdToSqs(documentId)
  console.log(
    `Documento ${documentId}: ${pages.length} páginas e ${chunks.length} chunks salvos`,
  );
}

function cleanText(text) {
  return text
    .normalize("NFKC")                                // ligaduras (ﬁ → fi), espaços especiais
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u00AD\u200B]/g, "") // controle e soft-hyphen
    .replace(/\r\n?/g, "\n")
    .replace(/(\p{L})-\n(\p{L})/gu, "$1$2")           // une palavras hifenizadas na quebra de linha
    .replace(/([^\n])\n(?!\n)/g, "$1 ")               // quebra simples → espaço (mantém parágrafos)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function* batches(arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

function findBreak(text, end, minPos) {
  for (const sep of BREAKERS) {
    const idx = text.lastIndexOf(sep, end - sep.length);
    if (idx >= minPos) return idx + sep.length;
  }
  return end; // nenhum ponto bom: corta no limite (palavra gigante)
}

function chunkText(text, size, overlap) {
  const result = [];
  const len = text.length;
  let start = 0;

  while (start < len) {
    let end = Math.min(start + size, len);

    if (end < len && !isSpace(text[end])) {
      end = findBreak(text, end, start + Math.floor(size * 0.6));
    }

    const piece = text.slice(start, end).trim();
    if (piece) result.push(piece);

    if (end >= len) break;

    // início do próximo chunk: recua o overlap e avança até o começo de uma palavra
    let next = Math.max(end - overlap, start + 1);
    while (next < end && !isSpace(text[next - 1])) next++;
    while (next < end && isSpace(text[next])) next++;

    start = next >= end ? end : next;
  }

  return result;
}