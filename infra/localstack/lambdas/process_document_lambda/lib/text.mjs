const BREAKERS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];
const isSpace = (c) => c === undefined || /\s/.test(c);

export function cleanText(text) {
  return text
    .normalize("NFKC") // ligaduras (ﬁ → fi), espaços especiais
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u00AD\u200B]/g, "") // controle e soft-hyphen
    .replace(/\r\n?/g, "\n")
    .replace(/(\p{L})-\n(\p{L})/gu, "$1$2") // une palavras hifenizadas na quebra de linha
    .replace(/([^\n])\n(?!\n)/g, "$1 ") // quebra simples → espaço (mantém parágrafos)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findBreak(text, end, minPos) {
  for (const sep of BREAKERS) {
    const idx = text.lastIndexOf(sep, end - sep.length);
    if (idx >= minPos) return idx + sep.length;
  }
  return end; // nenhum ponto bom: corta no limite (palavra gigante)
}

export function chunkText(text, size, overlap) {
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
