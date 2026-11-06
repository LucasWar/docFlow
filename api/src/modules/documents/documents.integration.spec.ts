import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma-service.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { S3ClientService } from '../s3-client/s3-client.service';
import { DocumentsRepository } from './document.repository';
import { DocumentsService } from './documents.service';
import { StatusDocument } from './type/status-documents.enum';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

describe('DocumentsService integration', () => {
  let moduleRef: TestingModule;
  let service: DocumentsService;
  const prisma = {
    document: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const s3 = {
    presigned: jest.fn(),
    deleteObjectS3: jest.fn(),
    dowloadObjectS3: jest.fn(),
  };
  const embeddings = { embedQuery: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        DocumentsService,
        DocumentsRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: S3ClientService, useValue: s3 },
        { provide: EmbeddingsService, useValue: embeddings },
      ],
    }).compile();
    service = moduleRef.get(DocumentsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('persists an upload request and signs the exact object key', async () => {
    prisma.document.create.mockImplementation(async ({ data }) => data);
    s3.presigned.mockResolvedValueOnce('upload-url');

    await expect(
      service.upload(
        { fileName: 'report.pdf', size: 512, type: 'pdf' },
        'user-1',
      ),
    ).resolves.toEqual({ url: 'upload-url' });

    const createCall = prisma.document.create.mock.calls[0][0];
    expect(createCall.data).toEqual(
      expect.objectContaining({
        fileName: 'report.pdf',
        fileKey: expect.stringMatching(/^uploads\/.+-report\.pdf$/),
        storageKey: 'uploads',
        size: 512,
        status: StatusDocument.QUEUED,
        userId: 'user-1',
      }),
    );
    expect(s3.presigned).toHaveBeenCalledWith(createCall.data.fileKey);
  });

  it('combines repository results and total count into a paginated response', async () => {
    const rows = [{ id: 'doc-1', fileName: 'report.pdf' }];
    prisma.document.findMany.mockResolvedValueOnce(rows);
    prisma.document.count.mockResolvedValueOnce(1);

    await expect(
      service.listDocuments(
        { page: 1, limit: 10, fileName: '', status: undefined },
        'user-1',
      ),
    ).resolves.toMatchObject({
      documents: rows,
      pagination: {
        total: 1,
        totalPages: 1,
        page: 1,
        perPage: 10,
        hasNext: false,
        hasPrev: false,
      },
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { equals: 'user-1' },
        }),
      }),
    );
    expect(prisma.document.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: { equals: 'user-1' },
      }),
    });
  });
});
