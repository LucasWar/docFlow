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

  async searchHybrid(
    userId: string,
    vector: string,
    searchText: string,
    limit = 10,
  ) {
    const semanticWeight = 1.0;
    const lexicalWeight = 1.0;

    try {
      return await this.prismaService.$queryRaw<
        Array<{
          id: string;
          document_id: string;
          file_name: string;
          content: string;
          page_number: number | null;
          score: number;
          similarity: number | null;
          semantic_rank: number | null;
          lexical_rank: number | null;
        }>
      >`
      WITH q AS (
        SELECT
          ${vector}::vector AS v,
          -- plainto_tsquery usa AND; trocamos por OR para perguntas naturais.
          -- O ts_rank_cd depois favorece chunks que casam mais termos.
          NULLIF(
            replace(
              plainto_tsquery('portuguese', immutable_unaccent(${searchText}::text))::text,
              '&', '|'
            ),
            ''
          )::tsquery AS tsq
      ),
      scoped AS (
        SELECT c.id, c.document_id, c.page_id, c.content, c.embedding, c.content_tsv
        FROM document_chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.user_id = ${userId}::uuid
      ),
      semantic AS (
        SELECT id,
               row_number() OVER (ORDER BY embedding <=> (SELECT v FROM q)) AS rnk
        FROM scoped
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> (SELECT v FROM q)
        LIMIT 30
      ),
      lexical AS (
        SELECT id,
               row_number() OVER (
                 ORDER BY ts_rank_cd(content_tsv, (SELECT tsq FROM q)) DESC
               ) AS rnk
        FROM scoped
        WHERE content_tsv @@ (SELECT tsq FROM q)
        ORDER BY ts_rank_cd(content_tsv, (SELECT tsq FROM q)) DESC
        LIMIT 30
      )
      SELECT
        c.id::text,
        c.document_id::text,
        c.content,
        d.file_name,
        p.page_number,
        (
          ${semanticWeight}::float8 * COALESCE(1.0 / (60 + s.rnk), 0) +
          ${lexicalWeight}::float8  * COALESCE(1.0 / (60 + l.rnk), 0)
        )::float8 AS score,
        (1 - (c.embedding <=> (SELECT v FROM q)))::float8 AS similarity,
        s.rnk::int AS semantic_rank,
        l.rnk::int AS lexical_rank
      FROM scoped AS c
      JOIN documents AS d ON d.id = c.document_id
      JOIN documents_pages p ON p.id = c.page_id
      LEFT JOIN semantic s ON s.id = c.id
      LEFT JOIN lexical  l ON l.id = c.id

      WHERE s.id IS NOT NULL OR l.id IS NOT NULL
      ORDER BY score DESC
      LIMIT ${limit}::int
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
