import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma-service.service';
import { CreateDocumentType } from './type/create-document.type';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/wasm-compiler-edge';

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async createDocument(createDocument: CreateDocumentType, fileId: string) {
    try {
      return await this.prismaService.document.create({
        data: {
          id: fileId,
          ...createDocument,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async searchByVectot(userId: string, vector: string) {
    try {
      return await this.prismaService.$queryRaw<
        Array<{
          id: string;
          document_id: string;
          content: string;
          page_number: number | null;
          similarity: number;
        }>
      >`
        SELECT
          c.id::text,
          c.document_id::text,
          c.content,
          p.page_number,
          1 - (c.embedding <=> ${vector}::vector) AS similarity
        FROM document_chunks c
        JOIN documents d ON d.id = c.document_id
        JOIN documents_pages p ON p.id = c.page_id
        WHERE d.user_id = ${userId}::uuid
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${vector}::vector
        LIMIT 5
      `;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async findMany(userId: string) {
    try {
      return await this.prismaService.document.findMany({
        where: {
          userId,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async findDocumentById(userId: string, documentId: string) {
    try {
      return await this.prismaService.document.findUnique({
        where: {
          id: documentId,
          userId,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }
}
