import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma-service.service';

describe('PrismaService integration', () => {
  let moduleRef: TestingModule;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const connect = jest
    .spyOn(PrismaService.prototype, '$connect')
    .mockResolvedValue(undefined);
  const disconnect = jest
    .spyOn(PrismaService.prototype, '$disconnect')
    .mockResolvedValue(undefined);

  beforeAll(() => {
    process.env.DATABASE_URL ??=
      'postgresql://test:test@127.0.0.1:1/docflow_test';
  });

  afterAll(() => {
    connect.mockRestore();
    disconnect.mockRestore();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('wires the Prisma provider lifecycle without connecting to a database', async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    await moduleRef.init();

    expect(connect).toHaveBeenCalledTimes(1);

    await moduleRef.close();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
