CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "embedding" vector(384),
ADD COLUMN     "embeddingModel" TEXT;
