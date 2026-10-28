import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import bcrypt from 'bcrypt';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenPayloadType,
  AuthenticatePayloadType,
  RefreshTokenPayloadType,
} from './types/payload-authenticate.type';
import { randomUUID } from 'crypto';
import { AuthRepository } from './auth.repository';
import { RevokedReason } from './types/revoked-reason.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly authRepository: AuthRepository,
  ) {}

  private async generateTokens(payload: AuthenticatePayloadType) {
    const { email, jtiAccess, jtiRefresh, sessionId, sub } = payload;
    const accessTokenPayload: AccessTokenPayloadType = {
      email,
      jti: jtiAccess,
      sessionId,
      sub,
      type: 'access',
    };

    const refreshTokenPayload: RefreshTokenPayloadType = {
      jti: jtiRefresh,
      sessionId,
      sub,
      type: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: process.env.JWT_ACCESS_TOKEN_SECRET,
      expiresIn: '15min',
    });

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: process.env.JWT_REFRESH_TOKEN_SECRET,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async register(registerUserDto: RegisterUserDto) {
    const { passworld, email, name } = registerUserDto;
    const passworldHash = await bcrypt.hash(passworld, 7);

    const newUser = await this.userService.create({
      name,
      email,
      passworldHash,
    });

    return newUser;
  }

  async authenticate(loginUserDto: LoginUserDto) {
    const user = await this.userService.validateCredentials(loginUserDto);

    const jtiAccess = randomUUID();
    const jtiRefresh = randomUUID();

    const session = await this.authRepository.createSession({
      refreshTokenJti: jtiRefresh,
      userId: user.id,
    });

    const { accessToken, refreshToken } = await this.generateTokens({
      email: user.email,
      sub: user.id,
      jtiAccess,
      jtiRefresh,
      sessionId: session.id,
    });

    return { refreshToken, accessToken };
  }

  async refresh(refreshTokenReq: string) {
    const newJtiAccess = randomUUID();
    const newJtiRefresh = randomUUID();

    const { payloadRefreshToken } =
      await this.validateRefreshToken(refreshTokenReq);

    const user = await this.userService.findOneUserById(
      payloadRefreshToken.sub,
    );

    const result = await this.authRepository.updateSession({
      ...payloadRefreshToken,
      jti: payloadRefreshToken.jti,
      newJti: newJtiRefresh,
    });

    if (result.count !== 1) {
      throw new UnauthorizedException();
    }

    const { accessToken, refreshToken } = await this.generateTokens({
      jtiAccess: newJtiAccess,
      jtiRefresh: newJtiRefresh,
      sessionId: payloadRefreshToken.sessionId,
      email: user.email,
      sub: payloadRefreshToken.sub,
    });

    return { accessToken, refreshToken };
  }

  async closeSession(refreshTokenReq: string | undefined) {
    if (!refreshTokenReq) return;
    const payload =
      this.jwtService.decode<RefreshTokenPayloadType>(refreshTokenReq);

    const session = await this.authRepository.findOneByJti(payload.jti);

    if (!session) return;

    await this.authRepository.updateRevokedAtSession(
      payload.jti,
      RevokedReason.LOGOUT,
    );
  }

  private async validateRefreshToken(refreshTokenReq: string) {
    const payloadRefreshToken =
      await this.jwtService.verifyAsync<RefreshTokenPayloadType>(
        refreshTokenReq,
        {
          secret: process.env.JWT_REFRESH_TOKEN_SECRET,
        },
      );

    if (!payloadRefreshToken) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const recordRefreshToken = await this.authRepository.findOneByJti(
      payloadRefreshToken.jti,
    );

    if (!recordRefreshToken) {
      throw new UnauthorizedException('Seção invalida');
    }

    if (
      recordRefreshToken.refreshExpiresAt.getTime() ===
      new Date(Date.now()).getTime()
    ) {
      throw new UnauthorizedException('Seção expirou');
    }

    if (recordRefreshToken.revokedAt) {
      throw new UnauthorizedException('Seção foi encerrada');
    }

    return { payloadRefreshToken };
  }
}
