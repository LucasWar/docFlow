import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma-service.service';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

describe('AuthService integration', () => {
  let moduleRef: TestingModule;
  let service: AuthService;
  let jwt: JwtService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    session: {
      create: jest.fn(),
    },
  };
  const jwtAdapter = {
    signAsync: jest.fn(async (payload: object) => JSON.stringify(payload)),
    verifyAsync: jest.fn(async (token: string) => JSON.parse(token) as object),
  };
  const originalAccessSecret = process.env.JWT_ACCESS_TOKEN_SECRET;
  const originalRefreshSecret = process.env.JWT_REFRESH_TOKEN_SECRET;

  beforeAll(() => {
    process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_TOKEN_SECRET = 'test-refresh-secret';
  });

  afterAll(() => {
    if (originalAccessSecret === undefined) {
      delete process.env.JWT_ACCESS_TOKEN_SECRET;
    } else {
      process.env.JWT_ACCESS_TOKEN_SECRET = originalAccessSecret;
    }
    if (originalRefreshSecret === undefined) {
      delete process.env.JWT_REFRESH_TOKEN_SECRET;
    } else {
      process.env.JWT_REFRESH_TOKEN_SECRET = originalRefreshSecret;
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        AuthRepository,
        UsersService,
        UsersRepository,
        { provide: JwtService, useValue: jwtAdapter },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    jwt = moduleRef.get(JwtService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('authenticates through the users/repository chain and generates access and refresh tokens', async () => {
    const passwordHash = await bcrypt.hash('password', 7);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'ana@example.com',
      passwordHash,
    });
    prisma.session.create.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
    });

    const tokens = await service.authenticate({
      email: 'ana@example.com',
      password: 'password',
    });

    await expect(jwt.verifyAsync(tokens.accessToken)).resolves.toMatchObject({
      email: 'ana@example.com',
      sub: 'user-1',
      sessionId: 'session-1',
      type: 'access',
    });
    await expect(jwt.verifyAsync(tokens.refreshToken)).resolves.toMatchObject({
      sub: 'user-1',
      sessionId: 'session-1',
      type: 'refresh',
    });
    expect(jwtAdapter.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'access', sub: 'user-1' }),
      expect.objectContaining({
        secret: process.env.JWT_ACCESS_TOKEN_SECRET,
        expiresIn: '15min',
      }),
    );
    expect(jwtAdapter.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'refresh', sub: 'user-1' }),
      expect.objectContaining({
        secret: process.env.JWT_REFRESH_TOKEN_SECRET,
        expiresIn: '7d',
      }),
    );
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        refreshTokenJti: expect.any(String),
        refreshExpiresAt: expect.any(Date),
      }),
    });
  });
});
