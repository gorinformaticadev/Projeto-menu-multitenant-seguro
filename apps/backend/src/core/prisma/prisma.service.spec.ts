import { PrismaReconnectFailed, PrismaService } from './prisma.service';

describe('PrismaService reconnect', () => {
  const originalTimeout = process.env.PRISMA_RECONNECT_TIMEOUT_MS;
  const originalBackoff = process.env.PRISMA_RECONNECT_BACKOFF_MS;

  const createService = (): PrismaService => {
    const service = Object.create(PrismaService.prototype) as PrismaService;
    (service as any).cutoverBlocked = true;
    (service as any).connected = false;
    (service as any).logger = {
      warn: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    };
    return service;
  };

  afterEach(() => {
    if (originalTimeout === undefined) {
      delete process.env.PRISMA_RECONNECT_TIMEOUT_MS;
    } else {
      process.env.PRISMA_RECONNECT_TIMEOUT_MS = originalTimeout;
    }

    if (originalBackoff === undefined) {
      delete process.env.PRISMA_RECONNECT_BACKOFF_MS;
    } else {
      process.env.PRISMA_RECONNECT_BACKOFF_MS = originalBackoff;
    }

    jest.restoreAllMocks();
  });

  it('reconecta apos falhas iniciais', async () => {
    process.env.PRISMA_RECONNECT_TIMEOUT_MS = '20000';
    process.env.PRISMA_RECONNECT_BACKOFF_MS = '1000';

    const service = createService();
    let now = 0;

    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const connectMock = jest
      .spyOn(service, '$connect')
      .mockRejectedValueOnce(new Error('db not ready'))
      .mockRejectedValueOnce(new Error('dns pending'))
      .mockResolvedValue(undefined);
    const waitMock = jest.spyOn(service as any, 'wait').mockImplementation(async (ms: number) => {
      now += ms;
    });

    await expect(service.resumeAfterCutover()).resolves.toBeUndefined();
    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(waitMock).toHaveBeenCalledTimes(2);
    expect((service as any).cutoverBlocked).toBe(false);
  });

  it('lanca PrismaReconnectFailed quando reconexao excede timeout', async () => {
    process.env.PRISMA_RECONNECT_TIMEOUT_MS = '3000';
    process.env.PRISMA_RECONNECT_BACKOFF_MS = '1000';

    const service = createService();
    let now = 0;

    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const connectMock = jest.spyOn(service, '$connect').mockRejectedValue(new Error('db offline'));
    jest.spyOn(service as any, 'wait').mockImplementation(async (ms: number) => {
      now += ms;
    });

    await expect(service.resumeAfterCutover()).rejects.toBeInstanceOf(PrismaReconnectFailed);
    expect(connectMock).toHaveBeenCalled();
    expect((service as any).cutoverBlocked).toBe(false);
  });
});
