import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { S3_CLIENT } from './s3.provider';
import { S3ClientService } from './s3-client.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

describe('S3ClientService integration', () => {
  let moduleRef: TestingModule;
  let service: S3ClientService;
  const send = jest.fn().mockResolvedValue({});

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        S3ClientService,
        { provide: S3_CLIENT, useValue: { send } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('integration-bucket') },
        },
      ],
    }).compile();
    service = moduleRef.get(S3ClientService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('routes a delete operation through the injected S3 SDK client', async () => {
    await service.deleteObjectS3('uploads/integration.pdf');

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect((command as DeleteObjectCommand).input).toEqual({
      Bucket: 'integration-bucket',
      Key: 'uploads/integration.pdf',
    });
  });
});
