import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CLIENT } from './s3.provider';

@Injectable()
export class S3ClientService {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3Client: S3Client,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('S3_BUCKET', 'documentsflows3');
  }

  async presigned(keyFile: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: keyFile,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 60 });
  }

  async deleteObjectS3(keyFile: string) {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: keyFile,
      }),
    );
  }

  async dowloadObjectS3(keyFile: string, fileName: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: keyFile,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }
}
