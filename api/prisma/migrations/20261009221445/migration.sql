/*
  Warnings:

  - You are about to drop the column `embeddingModel` on the `document_chunks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "document_chunks" DROP COLUMN "embeddingModel",
ADD COLUMN     "embedding_model" TEXT;
