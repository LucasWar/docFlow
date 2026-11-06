import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { AppException } from 'src/shared/exception/app.exception';
import { ErrorCode } from 'src/shared/enum/ErroCode.enum';

describe('UsersService', () => {
  let moduleRef: TestingModule;
  let service: UsersService;
  let repository: jest.Mocked<
    Pick<
      UsersRepository,
      'findEmail' | 'createUser' | 'findMany' | 'findUserById' | 'findOneById'
    >
  >;

  beforeEach(async () => {
    jest.clearAllMocks();
    repository = {
      findEmail: jest.fn(),
      createUser: jest.fn(),
      findMany: jest.fn(),
      findUserById: jest.fn(),
      findOneById: jest.fn(),
    };
    moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('checks email uniqueness before creating a user', async () => {
    const newUser = {
      name: 'Ana',
      email: 'ana@example.com',
      passwordHash: 'hash',
    };
    const createdUser = { id: 'user-1', ...newUser };
    repository.findEmail.mockResolvedValueOnce(null as never);
    repository.createUser.mockResolvedValueOnce(createdUser as never);

    await expect(service.create(newUser)).resolves.toBe(createdUser);
    expect(repository.findEmail).toHaveBeenCalledWith('ana@example.com');
    expect(repository.createUser).toHaveBeenCalledWith(newUser);
  });

  it('rejects creation when the email is already registered', async () => {
    repository.findEmail.mockResolvedValueOnce({
      id: 'existing-user',
    } as never);

    await expect(
      service.create({
        name: 'Ana',
        email: 'ana@example.com',
        passwordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createUser).not.toHaveBeenCalled();
  });

  it('returns all users and the current user projection', async () => {
    const users = [{ id: 'user-1', email: 'ana@example.com' }];
    repository.findMany.mockResolvedValueOnce(users as never);
    repository.findUserById.mockResolvedValueOnce(users[0] as never);

    await expect(service.findAll()).resolves.toBe(users);
    await expect(service.me('user-1')).resolves.toBe(users[0]);
    expect(repository.findUserById).toHaveBeenCalledWith('user-1');
  });

  it('returns the requested user or throws when it does not exist', async () => {
    const user = { id: 'user-1', email: 'ana@example.com' };
    repository.findOneById.mockResolvedValueOnce(user as never);
    await expect(service.findOneUserById('user-1')).resolves.toBe(user);

    repository.findOneById.mockResolvedValueOnce(null as never);
    await expect(service.findOneUserById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('accepts credentials when the stored password hash matches', async () => {
    const user = {
      id: 'user-1',
      email: 'ana@example.com',
      passwordHash: 'stored-hash',
    };
    repository.findEmail.mockResolvedValueOnce(user as never);
    jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);

    await expect(
      service.validateCredentials({
        email: user.email,
        password: 'correct-password',
      }),
    ).resolves.toBe(user);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'correct-password',
      'stored-hash',
    );
  });

  it('reports an unregistered email without comparing a password', async () => {
    repository.findEmail.mockResolvedValueOnce(null as never);

    const error = await service
      .validateCredentials({
        email: 'missing@example.com',
        password: 'password',
      })
      .catch((reason: AppException) => reason);

    expect(error).toBeInstanceOf(AppException);
    if (!(error instanceof AppException)) {
      throw new Error('Expected AppException');
    }
    expect(error.errorCode).toBe(ErrorCode.EMAIL_NOT_REGISTRED);
    expect(error.getStatus()).toBe(404);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('rejects a password mismatch with the invalid-credentials error', async () => {
    repository.findEmail.mockResolvedValueOnce({
      email: 'ana@example.com',
      passwordHash: 'stored-hash',
    } as never);
    jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false as never);

    const error = await service
      .validateCredentials({
        email: 'ana@example.com',
        password: 'wrong-password',
      })
      .catch((reason: AppException) => reason);

    expect(error).toBeInstanceOf(AppException);
    if (!(error instanceof AppException)) {
      throw new Error('Expected AppException');
    }
    expect(error.errorCode).toBe(ErrorCode.INVALID_CREDENTIALS);
    expect(error.getStatus()).toBe(401);
  });

  it('returns successfully when an email is not registered', async () => {
    repository.findEmail.mockResolvedValueOnce(null as never);

    await expect(
      service.validateUniqueEmail('new@example.com'),
    ).resolves.toBeUndefined();
  });
});
