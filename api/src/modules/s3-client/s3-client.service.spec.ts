import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3ClientService } from './s3-client.service';
import { S3_CLIENT } from './s3.provider';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('signed-url'),
}));

describe('S3ClientService', () => {
  let moduleRef: TestingModule;
  let service: S3ClientService;
  let client: jest.Mocked<Pick<S3Client, 'send'>>;
  let config: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    client = { send: jest.fn().mockResolvedValue({}) };
    config = { get: jest.fn().mockReturnValue('test-bucket') };
    moduleRef = await Test.createTestingModule({
      providers: [
        S3ClientService,
        { provide: S3_CLIENT, useValue: client },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(S3ClientService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates an upload URL for the configured bucket and key', async () => {
    await expect(service.presigned('uploads/file.pdf')).resolves.toBe(
      'signed-url',
    );

    const [signedClient, command, options] =
      jest.mocked(getSignedUrl).mock.calls[0];
    expect(signedClient).toBe(client);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toEqual({
      Bucket: 'test-bucket',
      Key: 'uploads/file.pdf',
    });
    expect(options).toEqual({ expiresIn: 60 });
  });

  it('sends a delete command for the configured object', async () => {
    await service.deleteObjectS3('uploads/file.pdf');

    const command = client.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect((command as DeleteObjectCommand).input).toEqual({
      Bucket: 'test-bucket',
      Key: 'uploads/file.pdf',
    });
  });

  it('signs downloads with an encoded attachment name and five-minute expiry', async () => {
    await expect(
      service.dowloadObjectS3('uploads/file.pdf', 'a file.pdf'),
    ).resolves.toBe('signed-url');

    const [, command, options] = jest.mocked(getSignedUrl).mock.calls[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect((command as GetObjectCommand).input).toEqual({
      Bucket: 'test-bucket',
      Key: 'uploads/file.pdf',
      ResponseContentDisposition: 'attachment; filename="a%20file.pdf"',
    });
    expect(options).toEqual({ expiresIn: 300 });
  });
});
