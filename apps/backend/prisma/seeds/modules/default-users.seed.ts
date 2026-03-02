import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_MASTER_TENANT,
  DEFAULT_USERS,
  resolveAdminPassword,
  resolveUserPassword,
} from '../defaults';
import { SeedModuleDefinition, SeedSummary } from '../types';

const BCRYPT_ROUNDS = 12;

export const defaultUsersSeed: SeedModuleDefinition = {
  key: 'default-users',
  version: 1,
  description: 'Cria usuarios padrao iniciais sem sobrescrever alteracoes manuais.',
  async run({ tx, force }) {
    const summary: SeedSummary = { created: 0, updated: 0, skipped: 0, notes: [] };

    const tenant = await tx.tenant.findUnique({
      where: { email: DEFAULT_MASTER_TENANT.email },
      select: { id: true, email: true },
    });

    if (!tenant) {
      throw new Error(`Tenant mestre nao encontrado para seed de usuarios: ${DEFAULT_MASTER_TENANT.email}`);
    }

    const adminPasswordHash = await bcrypt.hash(resolveAdminPassword(), BCRYPT_ROUNDS);
    const userPasswordHash = await bcrypt.hash(resolveUserPassword(), BCRYPT_ROUNDS);

    await ensureUser(
      tx,
      {
        email: DEFAULT_USERS.superAdminEmail,
        name: DEFAULT_USERS.superAdminName,
        role: Role.SUPER_ADMIN,
        tenantId: tenant.id,
        passwordHash: adminPasswordHash,
      },
      force,
      summary,
    );

    await ensureUser(
      tx,
      {
        email: DEFAULT_USERS.tenantAdminEmail,
        name: DEFAULT_USERS.tenantAdminName,
        role: Role.ADMIN,
        tenantId: tenant.id,
        passwordHash: adminPasswordHash,
      },
      force,
      summary,
    );

    await ensureUser(
      tx,
      {
        email: DEFAULT_USERS.tenantUserEmail,
        name: DEFAULT_USERS.tenantUserName,
        role: Role.USER,
        tenantId: tenant.id,
        passwordHash: userPasswordHash,
      },
      force,
      summary,
    );

    return summary;
  },
};

type EnsureUserInput = {
  email: string;
  name: string;
  role: Role;
  tenantId: string;
  passwordHash: string;
};

async function ensureUser(
  tx: Prisma.TransactionClient,
  input: EnsureUserInput,
  force: boolean,
  summary: SeedSummary,
): Promise<void> {
  const existing = await tx.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (!existing) {
    await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        tenantId: input.tenantId,
        password: input.passwordHash,
      },
    });
    summary.created += 1;
    return;
  }

  if (!force) {
    summary.skipped += 1;
    return;
  }

  await tx.user.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      role: input.role,
      tenantId: input.tenantId,
      password: input.passwordHash,
      isLocked: false,
      loginAttempts: 0,
      lockedUntil: null,
    },
  });
  summary.updated += 1;
}
