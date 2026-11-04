import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { PrismaClient } from "@prisma/client";
import { config } from "./config.mjs";

// Região e credenciais vêm do ambiente (AWS_REGION / role da Lambda).
// Localmente, defina AWS_REGION, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY.
// O SDK já faz retry com backoff nas chamadas (maxAttempts).
export const s3 = new S3Client({ forcePathStyle: true, maxAttempts: 4 });

export const sqs = new SQSClient({
  maxAttempts: 4,
  ...(config.sqsEndpoint && { endpoint: config.sqsEndpoint }),
});

export const prisma = new PrismaClient();
