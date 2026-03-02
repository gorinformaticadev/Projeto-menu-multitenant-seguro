import { DEFAULT_MASTER_TENANT } from '../defaults';
import { SeedModuleDefinition } from '../types';

export const initialTenantsSeed: SeedModuleDefinition = {
  key: 'initial-tenants',
  version: 1,
  description: 'Cria tenant mestre inicial quando ausente.',
  async run({ tx, force }) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const existingMaster = await tx.tenant.findUnique({
      where: { email: DEFAULT_MASTER_TENANT.email },
      select: {
        id: true,
        email: true,
        cnpjCpf: true,
        nomeFantasia: true,
        nomeResponsavel: true,
        telefone: true,
        isMasterTenant: true,
      },
    });

    if (!existingMaster) {
      await tx.tenant.create({
        data: {
          email: DEFAULT_MASTER_TENANT.email,
          cnpjCpf: DEFAULT_MASTER_TENANT.cnpjCpf,
          nomeFantasia: DEFAULT_MASTER_TENANT.nomeFantasia,
          nomeResponsavel: DEFAULT_MASTER_TENANT.nomeResponsavel,
          telefone: DEFAULT_MASTER_TENANT.telefone,
          isMasterTenant: true,
        },
      });
      created += 1;
      return { created, updated, skipped };
    }

    if (!force) {
      skipped += 1;
      return { created, updated, skipped };
    }

    await tx.tenant.update({
      where: { id: existingMaster.id },
      data: {
        cnpjCpf: DEFAULT_MASTER_TENANT.cnpjCpf,
        nomeFantasia: DEFAULT_MASTER_TENANT.nomeFantasia,
        nomeResponsavel: DEFAULT_MASTER_TENANT.nomeResponsavel,
        telefone: DEFAULT_MASTER_TENANT.telefone,
        isMasterTenant: true,
      },
    });
    updated += 1;

    return { created, updated, skipped };
  },
};
