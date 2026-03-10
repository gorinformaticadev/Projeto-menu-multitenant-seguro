import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolvePlatformLogoFilePath } from '@core/common/paths/paths.service';
import { PlatformConfigService } from './platform-config.service';

describe('PlatformConfigService logo management', () => {
  let tempUploadsDir: string;
  let previousUploadsDir: string | undefined;

  beforeEach(() => {
    tempUploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-logo-'));
    previousUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tempUploadsDir;
  });

  afterEach(() => {
    fs.rmSync(tempUploadsDir, { recursive: true, force: true });
    if (previousUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = previousUploadsDir;
    }
  });

  it('returns public platform logo URL when a configured logo exists on disk', async () => {
    const fileName = 'platform-logo-test.png';
    fs.writeFileSync(resolvePlatformLogoFilePath(fileName), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const prismaMock = {
      securityConfig: {
        findFirst: jest.fn().mockResolvedValue({
          platformName: 'Sistema',
          platformLogoUrl: fileName,
          platformEmail: 'contato@sistema.com',
          platformPhone: '(11) 99999-9999',
        }),
      },
    };

    const service = new PlatformConfigService(prismaMock as any);
    const config = await service.getPlatformConfig();

    expect(config.platformLogoUrl).toBe('/api/platform-config/logo-file');
  });

  it('persists uploaded platform logo file and updates configuration', async () => {
    let storedLogo: string | null = null;

    const prismaMock = {
      securityConfig: {
        findFirst: jest.fn().mockImplementation(async () => ({
          id: 'cfg-1',
          platformName: 'Sistema',
          platformLogoUrl: storedLogo,
          platformEmail: 'contato@sistema.com',
          platformPhone: '(11) 99999-9999',
        })),
        create: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          if (typeof data.platformLogoUrl === 'string' || data.platformLogoUrl === null) {
            storedLogo = data.platformLogoUrl;
          }

          return {
            id: 'cfg-1',
            platformName: 'Sistema',
            platformLogoUrl: storedLogo,
            platformEmail: 'contato@sistema.com',
            platformPhone: '(11) 99999-9999',
          };
        }),
      },
    };

    const service = new PlatformConfigService(prismaMock as any);
    const config = await service.updatePlatformLogo(
      { buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), extension: '.png' },
      'super-admin-1',
    );

    expect(storedLogo).toBeTruthy();
    expect(storedLogo).toMatch(/\.png$/);
    expect(fs.existsSync(resolvePlatformLogoFilePath(storedLogo!))).toBe(true);
    expect(config.platformLogoUrl).toBe('/api/platform-config/logo-file');
  });
});
