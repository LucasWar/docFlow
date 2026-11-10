import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsRepository } from './document.repository';
import { StatusDocument } from './type/status-documents.enum';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { S3ClientService } from '../s3-client/s3-client.service';
import { DocumentFilter } from './type/filter-document.type';
import { AppException } from 'src/shared/exception/app.exception';
import { ErrorCode } from 'src/shared/enum/ErroCode.enum';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentRepository: DocumentsRepository,
    private readonly embeddingsService: EmbeddingsService,
    private readonly s3ClientService: S3ClientService,
  ) {}

  async upload(createDocumentDto: CreateDocumentDto, userId: string) {
    const { fileName, size } = createDocumentDto;

    const fileId = crypto.randomUUID();
    const keyFile = `uploads/${fileId}-${fileName}`;
    const url = await this.s3ClientService.presigned(keyFile);

    if (!url) {
      throw new AppException(
        'Error presigned URL',
        ErrorCode.PRESIGNED_URL_ERROR,
        400,
      );
    }

    const document = await this.documentRepository.createDocument(
      {
        fileName,
        fileKey: keyFile,
        size,
        storageKey: 'uploads',
        userId,
        status: StatusDocument.UPLOADED,
      },
      fileId,
    );

    if (!document) {
      throw new BadRequestException('Document is not create');
    }

    return { url };
  }

  async resume(userId: string) {
    const numDocuments = await this.documentRepository.count(userId);

    const numChuncks = await this.documentRepository.countChuncks(userId);

    const numPages = await this.documentRepository.countPages(userId);

    return {
      numDocuments,
      numChuncks,
      numPages,
    };
  }

  async listDocuments(filter: DocumentFilter, userId: string) {
    const documents = await this.documentRepository.findMany(filter, userId);

    const totalDocuments = await this.documentRepository.count(userId, filter);

    const totalPages = Math.ceil(totalDocuments / filter.limit);

    return {
      documents,
      pagination: {
        totalPages,
        total: totalDocuments,
        perPage: filter.limit,
        page: filter.page,
        hasNext: filter.page < totalPages,
        hasPrev: filter.page > 1,
      },
    };
  }

  async findDocument(userId: string, documentId: string) {
    return await this.documentRepository.findDocumentById(userId, documentId);
  }

  async search(userId: string, question: string) {
    if (question == '' || question == undefined) {
      return [];
    }

    const embedding = await this.embeddingsService.embedQuery(question);

    const vector = `[${embedding.join(',')}]`;

    const results = await this.documentRepository.searchHybrid(
      userId,
      vector,
      question,
    );

    return results.map((result) => {
      return {
        id: result.id,
        documentId: result.document_id,
        pageNumber: result.page_number,
        fileName: result.file_name,
        content: result.content,
      };
    });
  }

  async deleteDocument(userId: string, documentId: string) {
    const document = await this.documentRepository.findDocumentById(
      userId,
      documentId,
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.s3ClientService.deleteObjectS3(document.fileKey);

    await this.documentRepository.deleteDocumentById(userId, documentId);
  }

  async downloadDocument(userId: string, documentId: string) {
    const document = await this.documentRepository.findDocumentById(
      userId,
      documentId,
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const url = await this.s3ClientService.dowloadObjectS3(
      document.fileKey,
      document.fileName,
    );

    return { url };
  }
}
