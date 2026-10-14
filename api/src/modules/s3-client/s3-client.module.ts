import { Module } from '@nestjs/common';
import { S3ClientService } from './s3-client.service';
import { S3ClientProvider } from './s3.provider';

@Module({
  providers: [S3ClientService, S3ClientProvider],
  exports: [S3ClientService],
})
export class S3ClientModule {}
