-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "page_count" DROP NOT NULL,
ALTER COLUMN "error_message" DROP NOT NULL,
ALTER COLUMN "processed_at" DROP NOT NULL;
