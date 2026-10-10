import { BadRequestException, Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsRepository } from './document.repository';
import { StatusDocument } from './type/status-documents.enum';
import { EmbeddingsService } from '../embeddings/embeddings.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentRepository: DocumentsRepository,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async upload(createDocumentDto: CreateDocumentDto, userId: string) {
    const { fileName, size, storageKey } = createDocumentDto;
    const fileId = crypto.randomUUID();
    const keyFile = `uploads/${fileId}-${fileName}`;
    const document = await this.documentRepository.createDocument(
      {
        fileName: keyFile,
        size,
        storageKey,
        userId,
        status: StatusDocument.QUEUED,
      },
      fileId,
    );

    if (!document) {
      throw new BadRequestException('Document is not create');
    }

    const url = await this.presigend(keyFile);

    return { url };
  }

  async listDocuments(userId: string) {
    return await this.documentRepository.findMany(userId);
  }

  async findDocument(userId: string, documentId: string) {
    return await this.documentRepository.findDocumentById(userId, documentId);
  }

  async search(userId: string, question: string) {
    const result = await this.embeddingsService.embedQuery(question);

    const vector = `[${result.join(',')}]`;

    return await this.documentRepository.searchByVectot(userId, vector);
  }

  private async presigend(keyFile: string) {
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const accessKeyId = process.env.S3_ACCESS_ID;

    if (!secretAccessKey || !accessKeyId) {
      throw new BadRequestException('Incorrent credentials');
    }

    const s3Client = new S3Client({
      endpoint: 'http://localhost:4566',
      forcePathStyle: true,
      region: 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: 'documentsflows3',
      Key: keyFile,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 60 });
  }
}
