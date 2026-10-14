import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = 'S3_CLIENT';

export const S3ClientProvider: Provider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const accessKeyId = config.getOrThrow<string>('S3_ACCESS_ID');
    const secretAccessKey = config.getOrThrow<string>('S3_SECRET_ACCESS_KEY');

    return new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT', 'http://localhost:4566'),
      forcePathStyle: true,
      region: config.get<string>('S3_REGION', 'us-east-1'),
      credentials: { accessKeyId, secretAccessKey },
    });
  },
};
