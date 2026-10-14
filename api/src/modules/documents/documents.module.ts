import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './document.repository';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { S3ClientModule } from '../s3-client/s3-client.module';

@Module({
  imports: [EmbeddingsModule, S3ClientModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository],
})
export class DocumentsModule {}
