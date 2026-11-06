import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma-service.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService integration', () => {
  let moduleRef: TestingModule;
  let service: UsersService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        UsersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('checks uniqueness through the repository before persisting a user', async () => {
    const user = {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.com',
      passwordHash: 'stored-hash',
    };
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce(user);

    await expect(
      service.create({
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
      }),
    ).resolves.toBe(user);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: user.email },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
      },
    });
  });

  it('returns the safe current-user projection from the repository', async () => {
    const user = { id: 'user-1', name: 'Ana', email: 'ana@example.com' };
    prisma.user.findUnique.mockResolvedValueOnce(user);

    await expect(service.me('user-1')).resolves.toBe(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, name: true, email: true },
    });
  });
});
