/*
  Warnings:

  - You are about to drop the column `content_tsv` on the `document_chunks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "document_chunks_tsv_idx";

-- AlterTable
ALTER TABLE "document_chunks" DROP COLUMN "content_tsv";
