import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsRepository } from './document.repository';
import { DocumentsService } from './documents.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { S3ClientService } from '../s3-client/s3-client.service';
import { StatusDocument } from './type/status-documents.enum';
import { DocumentFilter } from './type/filter-document.type';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

describe('DocumentsService', () => {
  let moduleRef: TestingModule;
  let service: DocumentsService;
  let repository: jest.Mocked<
    Pick<
      DocumentsRepository,
      | 'createDocument'
      | 'count'
      | 'countChuncks'
      | 'countPages'
      | 'findMany'
      | 'findDocumentById'
      | 'searchHybrid'
      | 'deleteDocumentById'
    >
  >;
  let embeddings: jest.Mocked<Pick<EmbeddingsService, 'embedQuery'>>;
  let s3: jest.Mocked<
    Pick<S3ClientService, 'presigned' | 'deleteObjectS3' | 'dowloadObjectS3'>
  >;

  beforeEach(async () => {
    jest.clearAllMocks();
    repository = {
      createDocument: jest.fn(),
      count: jest.fn(),
      countChuncks: jest.fn(),
      countPages: jest.fn(),
      findMany: jest.fn(),
      findDocumentById: jest.fn(),
      searchHybrid: jest.fn(),
      deleteDocumentById: jest.fn(),
    };
    embeddings = { embedQuery: jest.fn() };
    s3 = {
      presigned: jest.fn(),
      deleteObjectS3: jest.fn(),
      dowloadObjectS3: jest.fn(),
    };
    moduleRef = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: DocumentsRepository, useValue: repository },
        { provide: EmbeddingsService, useValue: embeddings },
        { provide: S3ClientService, useValue: s3 },
      ],
    }).compile();
    service = moduleRef.get(DocumentsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates a queued upload and returns its presigned URL', async () => {
    repository.createDocument.mockImplementationOnce(
      async (input, id) =>
        ({
          id,
          ...input,
        }) as never,
    );
    s3.presigned.mockResolvedValueOnce('upload-url');

    await expect(
      service.upload(
        { fileName: 'report.pdf', size: 123, type: 'pdf' },
        'user-1',
      ),
    ).resolves.toEqual({ url: 'upload-url' });
    expect(repository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'report.pdf',
        fileKey: expect.stringMatching(/^uploads\/.+-report\.pdf$/),
        size: 123,
        storageKey: 'uploads',
        userId: 'user-1',
        status: StatusDocument.QUEUED,
      }),
      expect.any(String),
    );
    expect(s3.presigned).toHaveBeenCalledWith(
      expect.stringMatching(/^uploads\/.+-report\.pdf$/),
    );
  });

  it('rejects an upload when the repository does not create a document', async () => {
    repository.createDocument.mockResolvedValueOnce(null as never);

    await expect(
      service.upload(
        { fileName: 'report.pdf', size: 123, type: 'pdf' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s3.presigned).not.toHaveBeenCalled();
  });

  it('aggregates document, chunk, and page counts for the resume view', async () => {
    repository.count.mockResolvedValueOnce(4);
    repository.countChuncks.mockResolvedValueOnce(12);
    repository.countPages.mockResolvedValueOnce(9);

    await expect(service.resume('user-1')).resolves.toEqual({
      numDocuments: 4,
      numChuncks: 12,
      numPages: 9,
    });
    expect(repository.count).toHaveBeenCalledWith('user-1');
    expect(repository.countChuncks).toHaveBeenCalledWith('user-1');
    expect(repository.countPages).toHaveBeenCalledWith('user-1');
  });

  it('builds list pagination metadata for the requested page', async () => {
    const filter = Object.assign(new DocumentFilter(), { page: 2, limit: 5 });
    const documents = [{ id: 'doc-1' }];
    repository.findMany.mockResolvedValueOnce(documents as never);
    repository.count.mockResolvedValueOnce(11);

    await expect(service.listDocuments(filter, 'user-1')).resolves.toEqual({
      documents,
      pagination: {
        totalPages: 3,
        total: 11,
        perPage: 5,
        page: 2,
        hasNext: true,
        hasPrev: true,
      },
    });
    expect(repository.findMany).toHaveBeenCalledWith(filter, 'user-1');
    expect(repository.count).toHaveBeenCalledWith('user-1', filter);
  });

  it('returns the document lookup result for the specified user', async () => {
    const document = { id: 'doc-1' };
    repository.findDocumentById.mockResolvedValueOnce(document as never);

    await expect(service.findDocument('user-1', 'doc-1')).resolves.toBe(
      document,
    );
    expect(repository.findDocumentById).toHaveBeenCalledWith('user-1', 'doc-1');
  });

  it('does not call embeddings or storage for an empty search', async () => {
    await expect(service.search('user-1', '')).resolves.toEqual([]);
    await expect(service.search('user-1', undefined as never)).resolves.toEqual(
      [],
    );
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
    expect(repository.searchHybrid).not.toHaveBeenCalled();
  });

  it('embeds a question and maps hybrid-search rows to the public result shape', async () => {
    embeddings.embedQuery.mockResolvedValueOnce([0.25, 0.75]);
    const rows = [
      {
        id: 'chunk-1',
        document_id: 'doc-1',
        page_number: 3,
        file_name: 'report.pdf',
        content: 'Relevant passage',
        score: 0.2,
      },
    ];
    repository.searchHybrid.mockResolvedValueOnce(rows as never);

    await expect(
      service.search('user-1', 'What is relevant?'),
    ).resolves.toEqual([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        pageNumber: 3,
        fileName: 'report.pdf',
        content: 'Relevant passage',
      },
    ]);
    expect(repository.searchHybrid).toHaveBeenCalledWith(
      'user-1',
      '[0.25,0.75]',
      'What is relevant?',
    );
  });

  it('deletes the storage object before deleting its document record', async () => {
    repository.findDocumentById.mockResolvedValueOnce({
      fileKey: 'uploads/report.pdf',
    } as never);
    const order: string[] = [];
    s3.deleteObjectS3.mockImplementationOnce(async () => {
      order.push('storage');
    });
    repository.deleteDocumentById.mockImplementationOnce(async () => {
      order.push('repository');
      return null as never;
    });

    await service.deleteDocument('user-1', 'doc-1');

    expect(order).toEqual(['storage', 'repository']);
    expect(repository.deleteDocumentById).toHaveBeenCalledWith(
      'user-1',
      'doc-1',
    );
  });

  it('does not delete storage or a record when the document is missing', async () => {
    repository.findDocumentById.mockResolvedValueOnce(null as never);

    await expect(
      service.deleteDocument('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s3.deleteObjectS3).not.toHaveBeenCalled();
    expect(repository.deleteDocumentById).not.toHaveBeenCalled();
  });

  it('returns a download URL and fails when the document is missing', async () => {
    repository.findDocumentById.mockResolvedValueOnce({
      fileKey: 'uploads/report.pdf',
      fileName: 'report.pdf',
    } as never);
    s3.dowloadObjectS3.mockResolvedValueOnce('download-url');
    await expect(service.downloadDocument('user-1', 'doc-1')).resolves.toEqual({
      url: 'download-url',
    });
    expect(s3.dowloadObjectS3).toHaveBeenCalledWith(
      'uploads/report.pdf',
      'report.pdf',
    );

    repository.findDocumentById.mockResolvedValueOnce(null as never);
    await expect(
      service.downloadDocument('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s3.dowloadObjectS3).toHaveBeenCalledTimes(1);
  });
});
