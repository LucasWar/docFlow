import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma-service.service';
import { CreateDocumentType } from './type/create-document.type';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/wasm-compiler-edge';
import { BuilderFilterDocuments } from './build-filter';
import { DocumentFilter } from './type/filter-document.type';
import { DocumentWhereInput } from 'src/generated/prisma/models';

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

  async deleteDocumentById(userId: string, id: string) {
    try {
      return await this.prismaService.document.delete({
        where: {
          id,
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

  async searchHybrid(userId: string, vector: string, searchText: string) {
    try {
      return await this.prismaService.$queryRaw<
        Array<{
          id: string;
          document_id: string;
          content: string;
          page_number: number | null;
          score: number;
          similarity: number | null;
        }>
      >`
        WITH q AS (
          SELECT
            ${vector}::vector AS v,
            regexp_replace(unaccent(lower(${searchText}::text)), '[^a-z0-9]', '', 'g') AS t
        ),
        base AS (
          SELECT
            c.id,
            c.document_id,
            c.content,
            c.embedding,
            p.page_number,
            regexp_replace(unaccent(lower(c.content)), '[^a-z0-9]', '', 'g') AS norm
          FROM document_chunks c
          JOIN documents d ON d.id = c.document_id
          JOIN documents_pages p ON p.id = c.page_id
          WHERE d.user_id = ${userId}::uuid
        ),
        semantic AS (
          SELECT id,
                row_number() OVER (ORDER BY embedding <=> (SELECT v FROM q)) AS rnk
          FROM base
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> (SELECT v FROM q)
          LIMIT 30
        ),
        lexical AS (
          SELECT id,
                row_number() OVER (ORDER BY length(norm)) AS rnk
          FROM base
          WHERE length((SELECT t FROM q)) >= 4
            AND norm LIKE '%' || (SELECT t FROM q) || '%'
          LIMIT 30
        )
        SELECT
          b.id::text,
          b.document_id::text,
          b.content,
          b.page_number,
          (COALESCE(1.0 / (60 + s.rnk), 0) + COALESCE(1.0 / (60 + l.rnk), 0))::float8 AS score,
          (1 - (b.embedding <=> (SELECT v FROM q)))::float8 AS similarity
        FROM base b
        LEFT JOIN semantic s ON s.id = b.id
        LEFT JOIN lexical  l ON l.id = b.id
        WHERE s.id IS NOT NULL OR l.id IS NOT NULL
        ORDER BY score DESC
        LIMIT 5
      `;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async findMany(filter: DocumentFilter, userId: string) {
    const query = new BuilderFilterDocuments(filter, userId).build();

    try {
      return await this.prismaService.document.findMany(query);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async count(userId: string, filter?: DocumentFilter) {
    let query: DocumentWhereInput | undefined = {};
    if (filter) {
      query = new BuilderFilterDocuments(filter, userId).build().where;
    }

    try {
      return await this.prismaService.document.count({
        where: query,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async countChuncks(userId: string) {
    try {
      return await this.prismaService.documentChunk.count({
        where: {
          document: {
            userId,
          },
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async countPages(userId: string) {
    try {
      return await this.prismaService.documentPage.count({
        where: {
          document: {
            userId,
          },
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
