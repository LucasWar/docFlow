-- CreateEnum
CREATE TYPE "RevokedReason" AS ENUM ('LOGOUT', 'EXPIRES', 'REFRESH');

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "revoked_reason" "RevokedReason";
