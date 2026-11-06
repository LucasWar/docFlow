import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RevokedReason } from './types/revoked-reason.enum';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

describe('AuthService', () => {
  let moduleRef: TestingModule;
  let service: AuthService;
  let users: jest.Mocked<
    Pick<UsersService, 'create' | 'validateCredentials' | 'findOneUserById'>
  >;
  let jwt: jest.Mocked<
    Pick<JwtService, 'signAsync' | 'verifyAsync' | 'decode'>
  >;
  let authRepository: jest.Mocked<
    Pick<
      AuthRepository,
      | 'createSession'
      | 'updateSession'
      | 'findOneByJti'
      | 'updateRevokedAtSession'
    >
  >;

  beforeEach(async () => {
    jest.clearAllMocks();
    users = {
      create: jest.fn(),
      validateCredentials: jest.fn(),
      findOneUserById: jest.fn(),
    };
    jwt = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    };
    authRepository = {
      createSession: jest.fn(),
      updateSession: jest.fn(),
      findOneByJti: jest.fn(),
      updateRevokedAtSession: jest.fn(),
    };
    moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: AuthRepository, useValue: authRepository },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('hashes the password and returns only public registration fields', async () => {
    const user = {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.com',
      passwordHash: 'secret-hash',
    };
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('secret-hash' as never);
    users.create.mockResolvedValueOnce(user as never);

    await expect(
      service.register({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'password',
      }),
    ).resolves.toEqual({ id: 'user-1', name: 'Ana', email: 'ana@example.com' });
    expect(bcrypt.hash).toHaveBeenCalledWith('password', 7);
    expect(users.create).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana@example.com',
      passwordHash: 'secret-hash',
    });
  });

  it('propagates registration failures from the users service', async () => {
    const error = new Error('registration failed');
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hash' as never);
    users.create.mockRejectedValueOnce(error);

    await expect(
      service.register({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'password',
      }),
    ).rejects.toBe(error);
  });

  it('creates a refresh-token session and returns both signed tokens', async () => {
    users.validateCredentials.mockResolvedValueOnce({
      id: 'user-1',
      email: 'ana@example.com',
    } as never);
    authRepository.createSession.mockResolvedValueOnce({
      id: 'session-1',
    } as never);
    jwt.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    await expect(
      service.authenticate({ email: 'ana@example.com', password: 'password' }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(authRepository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        refreshTokenJti: expect.any(String),
      }),
    );
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        email: 'ana@example.com',
        sub: 'user-1',
        sessionId: 'session-1',
        type: 'access',
      }),
      { secret: process.env.JWT_ACCESS_TOKEN_SECRET, expiresIn: '15min' },
    );
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sub: 'user-1',
        sessionId: 'session-1',
        type: 'refresh',
      }),
      { secret: process.env.JWT_REFRESH_TOKEN_SECRET, expiresIn: '7d' },
    );
  });

  it('does not create a session when credentials are rejected', async () => {
    const error = new Error('invalid credentials');
    users.validateCredentials.mockRejectedValueOnce(error);

    await expect(
      service.authenticate({
        email: 'ana@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBe(error);
    expect(authRepository.createSession).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and persists the new JTI', async () => {
    const payload = {
      jti: 'old-refresh-jti',
      sessionId: 'session-1',
      sub: 'user-1',
      type: 'refresh' as const,
    };
    const session = {
      id: 'session-1',
      refreshExpiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    };
    jwt.verifyAsync.mockResolvedValueOnce(payload as never);
    authRepository.findOneByJti.mockResolvedValueOnce(session as never);
    users.findOneUserById.mockResolvedValueOnce({
      id: 'user-1',
      email: 'ana@example.com',
    } as never);
    authRepository.updateSession.mockResolvedValueOnce({ count: 1 } as never);
    jwt.signAsync
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh');

    await expect(service.refresh('old-refresh')).resolves.toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    expect(users.findOneUserById).toHaveBeenCalledWith('user-1');
    expect(authRepository.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        ...payload,
        newJti: expect.any(String),
      }),
    );
  });

  it('rejects refresh when the session cannot be atomically rotated', async () => {
    const payload = {
      jti: 'old-jti',
      sessionId: 'session-1',
      sub: 'user-1',
      type: 'refresh' as const,
    };
    jwt.verifyAsync.mockResolvedValueOnce(payload as never);
    authRepository.findOneByJti.mockResolvedValueOnce({
      refreshExpiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as never);
    users.findOneUserById.mockResolvedValueOnce({
      email: 'ana@example.com',
    } as never);
    authRepository.updateSession.mockResolvedValueOnce({ count: 0 } as never);

    await expect(service.refresh('old-refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens whose session is missing, revoked, or expired', async () => {
    const payload = {
      jti: 'refresh-jti',
      sessionId: 'session-1',
      sub: 'user-1',
      type: 'refresh' as const,
    };
    jwt.verifyAsync.mockResolvedValue(payload as never);
    authRepository.findOneByJti.mockResolvedValueOnce(null);
    await expect(service.refresh('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    authRepository.findOneByJti.mockResolvedValueOnce({
      refreshExpiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    } as never);
    await expect(service.refresh('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.findOneUserById).not.toHaveBeenCalled();
  });

  it('does nothing when closing a session without a token or known session', async () => {
    await expect(service.closeSession(undefined)).resolves.toBeUndefined();
    jwt.decode.mockReturnValueOnce({ jti: 'unknown-jti' } as never);
    authRepository.findOneByJti.mockResolvedValueOnce(null);
    await expect(service.closeSession('token')).resolves.toBeUndefined();
    expect(authRepository.updateRevokedAtSession).not.toHaveBeenCalled();
  });

  it('revokes a known refresh-token session on logout', async () => {
    jwt.decode.mockReturnValueOnce({ jti: 'refresh-jti' } as never);
    authRepository.findOneByJti.mockResolvedValueOnce({
      id: 'session-1',
    } as never);

    await service.closeSession('token');

    expect(authRepository.updateRevokedAtSession).toHaveBeenCalledWith(
      'refresh-jti',
      RevokedReason.LOGOUT,
    );
  });
});
