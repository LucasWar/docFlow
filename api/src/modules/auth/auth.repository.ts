import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma-service.service';
import { CreateSession } from './types/create-session.type';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { RefreshTokenPayloadType } from './types/payload-authenticate.type';
import { RevokedReason } from './types/revoked-reason.enum';

@Injectable()
export class AuthRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async createSession(sessionData: CreateSession) {
    try {
      return await this.prismaService.session.create({
        data: {
          ...sessionData,
          refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async updateRevokedAtSession(
    refreshTokenJti: string,
    revokedReason: RevokedReason,
  ) {
    try {
      return await this.prismaService.session.update({
        where: {
          refreshTokenJti,
        },
        data: {
          revokedAt: new Date(Date.now()),
          revokedReason,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async findOneByJti(jti: string) {
    try {
      return await this.prismaService.session.findUnique({
        where: {
          refreshTokenJti: jti,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }

  async updateSession(payload: RefreshTokenPayloadType & { newJti: string }) {
    try {
      return await this.prismaService.session.updateMany({
        where: {
          id: payload.sessionId,
          userId: payload.sub,
          refreshTokenJti: payload.jti,
          revokedAt: null,
          refreshExpiresAt: { gt: new Date() },
        },
        data: {
          refreshTokenJti: payload.newJti,
          previousRefreshTokenJti: payload.jti,
          refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Erro do Prisma:', error.code);
      }

      throw error;
    }
  }
}
