export function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

/** Formato literal aceito pelo pgvector: "[0.1,0.2,...]". */
export const toVectorLiteral = (vector) => `[${vector.join(",")}]`;
