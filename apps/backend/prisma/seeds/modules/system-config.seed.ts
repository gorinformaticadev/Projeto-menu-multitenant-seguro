import { DEFAULT_SECURITY_CONFIG } from '../defaults';
import { SeedModuleDefinition } from '../types';

export const systemConfigSeed: SeedModuleDefinition = {
  key: 'system-config',
  version: 1,
  description: 'Cria configuracao global de seguranca padrao.',
  async run({ tx, force }) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const current = await tx.securityConfig.findFirst({
      orderBy: { updatedAt: 'asc' },
      select: { id: true },
    });

    if (!current) {
      await tx.securityConfig.create({
        data: DEFAULT_SECURITY_CONFIG,
      });
      created += 1;
      return { created, updated, skipped };
    }

    if (!force) {
      skipped += 1;
      return { created, updated, skipped };
    }

    await tx.securityConfig.update({
      where: { id: current.id },
      data: DEFAULT_SECURITY_CONFIG,
    });
    updated += 1;

    return { created, updated, skipped };
  },
};
