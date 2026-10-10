CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "embedding" vector(384),
ADD COLUMN     "embeddingModel" TEXT;
