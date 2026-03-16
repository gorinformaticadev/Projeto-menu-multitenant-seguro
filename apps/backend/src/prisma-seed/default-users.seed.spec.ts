import { seedRegistry } from '../../prisma/seeds/registry';
import { resolveAdminPassword } from '../../prisma/seeds/defaults';
import { defaultUsersSeed } from '../../prisma/seeds/modules/default-users.seed';
import * as bcrypt from 'bcrypt';

describe('default users seed hardening', () => {
  const originalInstallAdminPassword = process.env.INSTALL_ADMIN_PASSWORD;
  const originalAdminDefaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  const originalUserDefaultPassword = process.env.USER_DEFAULT_PASSWORD;

  afterEach(() => {
    if (originalInstallAdminPassword === undefined) {
      delete process.env.INSTALL_ADMIN_PASSWORD;
    } else {
      process.env.INSTALL_ADMIN_PASSWORD = originalInstallAdminPassword;
    }

    if (originalAdminDefaultPassword === undefined) {
      delete process.env.ADMIN_DEFAULT_PASSWORD;
    } else {
      process.env.ADMIN_DEFAULT_PASSWORD = originalAdminDefaultPassword;
    }

    if (originalUserDefaultPassword === undefined) {
      delete process.env.USER_DEFAULT_PASSWORD;
    } else {
      process.env.USER_DEFAULT_PASSWORD = originalUserDefaultPassword;
    }

    jest.restoreAllMocks();
  });

  it('runs system-config before creating default users', () => {
    const keys = seedRegistry.map((seed) => seed.key);

    expect(keys.indexOf('system-config')).toBeLessThan(keys.indexOf('default-users'));
  });

  it('never falls back to the weak hardcoded admin123 password', () => {
    delete process.env.INSTALL_ADMIN_PASSWORD;
    delete process.env.ADMIN_DEFAULT_PASSWORD;

    const resolved = resolveAdminPassword();

    expect(resolved.source).toBe('generated');
    expect(resolved.value).not.toBe('admin123');
    expect(resolved.value).toMatch(/[A-Z]/);
    expect(resolved.value).toMatch(/[a-z]/);
    expect(resolved.value).toMatch(/[0-9]/);
    expect(resolved.value).toMatch(/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]]/);
  });

  it('rejects bootstrap passwords that violate the active security policy', async () => {
    process.env.INSTALL_ADMIN_PASSWORD = 'Fraca1!';
    process.env.USER_DEFAULT_PASSWORD = 'Fraca1!';

    const tx = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          email: 'empresa1@example.com',
        }),
      },
      securityConfig: {
        findFirst: jest.fn().mockResolvedValue({
          passwordMinLength: 12,
          passwordRequireUppercase: true,
          passwordRequireLowercase: true,
          passwordRequireNumbers: true,
          passwordRequireSpecial: true,
        }),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    await expect(defaultUsersSeed.run({ tx: tx as any, force: false } as any)).rejects.toThrow(
      /viola a politica ativa/i,
    );
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('remediates legacy weak default password hashes even without force', async () => {
    process.env.INSTALL_ADMIN_PASSWORD = 'SenhaForte#2026Aa';

    const weakHash = await bcrypt.hash('admin123', 4);
    const tx = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          email: 'empresa1@example.com',
        }),
      },
      securityConfig: {
        findFirst: jest.fn().mockResolvedValue({
          passwordMinLength: 8,
          passwordRequireUppercase: true,
          passwordRequireLowercase: true,
          passwordRequireNumbers: true,
          passwordRequireSpecial: true,
        }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'legacy-super-admin', password: weakHash })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const summary = await defaultUsersSeed.run({ tx: tx as any, force: false } as any);

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'legacy-super-admin' },
        data: expect.objectContaining({
          isLocked: false,
          loginAttempts: 0,
        }),
      }),
    );
    expect(summary.updated).toBeGreaterThan(0);
    expect(summary.notes.join(' ')).toMatch(/senha fraca legada corrigida/i);
  });
});
