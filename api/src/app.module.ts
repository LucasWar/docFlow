import { Module, ValidationPipe } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './modules/database/prisma-service.module';
import { APP_PIPE } from '@nestjs/core';
import { DocumentsModule } from './modules/documents/documents.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { S3ClientModule } from './modules/s3-client/s3-client.module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PrismaModule,
    DocumentsModule,
    EmbeddingsModule,
    S3ClientModule,
    ConfigModule.forRoot({
      isGlobal: true, // Torna o módulo disponível globalmente em toda a aplicação
    }),
    RedisModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
