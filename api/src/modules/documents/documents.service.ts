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
    const document = await this.documentRepository.createDocument(
      {
        fileName,
        fileKey: keyFile,
        size,
        storageKey: 'uploads',
        userId,
        status: StatusDocument.QUEUED,
      },
      fileId,
    );

    if (!document) {
      throw new BadRequestException('Document is not create');
    }

    const url = await this.s3ClientService.presigned(keyFile);

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
    const result = await this.embeddingsService.embedQuery(question);

    const vector = `[${result.join(',')}]`;

    return await this.documentRepository.searchHybrid(userId, vector, question);
  }

  async deleteDocument(userId: string, documentId: string) {
    const document = await this.documentRepository.findDocumentById(
      userId,
      documentId,
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.s3ClientService.deleteObjectS3(document.fileName);

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
