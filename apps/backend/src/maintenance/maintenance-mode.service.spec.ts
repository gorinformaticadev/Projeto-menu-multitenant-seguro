import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MaintenanceModeService } from './maintenance-mode.service';

describe('MaintenanceModeService audit instrumentation', () => {
  const auditServiceMock = {
    log: jest.fn(),
  };
  const notificationServiceMock = {
    emitSystemAlert: jest.fn(),
  };
  const pathsServiceMock = {
    getProjectRoot: jest.fn(),
  };

  let tempDir: string;
  let previousBaseDir: string | undefined;

  const createService = () =>
    new MaintenanceModeService(
      pathsServiceMock as any,
      auditServiceMock as any,
      notificationServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-audit-'));
    previousBaseDir = process.env.APP_BASE_DIR;
    process.env.APP_BASE_DIR = tempDir;
    pathsServiceMock.getProjectRoot.mockReturnValue(tempDir);
  });

  afterEach(() => {
    if (previousBaseDir === undefined) {
      delete process.env.APP_BASE_DIR;
    } else {
      process.env.APP_BASE_DIR = previousBaseDir;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates MAINTENANCE_ENABLED audit log when maintenance is enabled', async () => {
    const service = createService();
    auditServiceMock.log.mockResolvedValue(null);
    notificationServiceMock.emitSystemAlert.mockResolvedValue(null);

    await service.writeState(
      {
        enabled: true,
        reason: 'Atualizacao em andamento',
        startedAt: '2026-03-06T12:00:00.000Z',
        etaSeconds: 300,
        allowedRoles: ['SUPER_ADMIN'],
        bypassHeader: 'X-Maintenance-Bypass',
      },
      {
        actor: {
          userId: 'user-1',
          email: 'admin@example.com',
          role: 'SUPER_ADMIN',
        },
      },
    );

    expect(auditServiceMock.log).toHaveBeenCalledTimes(1);
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MAINTENANCE_ENABLED',
        severity: 'warning',
        metadata: expect.objectContaining({
          reason: 'Atualizacao em andamento',
          etaSeconds: 300,
          source: 'admin',
        }),
      }),
    );
  });
});
