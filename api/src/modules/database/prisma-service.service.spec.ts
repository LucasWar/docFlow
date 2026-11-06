import { PrismaService } from './prisma-service.service';

describe('PrismaService', () => {
  function serviceWithoutConnecting(): PrismaService {
    const service = Object.create(PrismaService.prototype) as PrismaService;
    Object.defineProperty(service, '$connect', {
      value: jest.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(service, '$disconnect', {
      value: jest.fn().mockResolvedValue(undefined),
    });
    return service;
  }

  it('connects during module initialization', async () => {
    const service = serviceWithoutConnecting();

    await service.onModuleInit();

    expect(service.$connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects during module destruction', async () => {
    const service = serviceWithoutConnecting();

    await service.onModuleDestroy();

    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });
});
