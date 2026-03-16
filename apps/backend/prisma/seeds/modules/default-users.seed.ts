import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_MASTER_TENANT,
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_USERS,
  resolveAdminPassword,
  resolveUserPassword,
} from '../defaults';
import { SeedModuleDefinition, SeedSummary } from '../types';
import { validatePasswordAgainstPolicy } from '../../../src/common/utils/password-policy.util';

const BCRYPT_ROUNDS = 12;
const LEGACY_WEAK_DEFAULT_PASSWORDS = ['admin123'];

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

    const securityConfig = await tx.securityConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        passwordMinLength: true,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecial: true,
      },
    });
    const passwordPolicy = {
      minLength: securityConfig?.passwordMinLength ?? DEFAULT_SECURITY_CONFIG.passwordMinLength,
      requireUppercase:
        securityConfig?.passwordRequireUppercase ?? DEFAULT_SECURITY_CONFIG.passwordRequireUppercase,
      requireLowercase:
        securityConfig?.passwordRequireLowercase ?? DEFAULT_SECURITY_CONFIG.passwordRequireLowercase,
      requireNumbers:
        securityConfig?.passwordRequireNumbers ?? DEFAULT_SECURITY_CONFIG.passwordRequireNumbers,
      requireSpecial:
        securityConfig?.passwordRequireSpecial ?? DEFAULT_SECURITY_CONFIG.passwordRequireSpecial,
    };

    const adminPassword = resolveAdminPassword();
    const userPassword = resolveUserPassword(adminPassword);

    assertPasswordMatchesPolicy(
      adminPassword.value,
      passwordPolicy,
      adminPassword.envKey || 'generated-admin-password',
    );
    assertPasswordMatchesPolicy(
      userPassword.value,
      passwordPolicy,
      userPassword.envKey || 'generated-user-password',
    );

    const adminPasswordHash = await bcrypt.hash(adminPassword.value, BCRYPT_ROUNDS);
    const userPasswordHash = await bcrypt.hash(userPassword.value, BCRYPT_ROUNDS);

    if (adminPassword.source === 'generated') {
      summary.notes.push(
        'Senha inicial do bootstrap foi gerada dinamicamente. Consulte o log do seed atual e altere-a imediatamente apos o primeiro acesso.',
      );
      console.warn(
        `[seed][security] Senha inicial gerada para ${DEFAULT_USERS.superAdminEmail}: ${adminPassword.value}`,
      );
    }

    if (userPassword.source === 'generated' && userPassword.value !== adminPassword.value) {
      console.warn(
        `[seed][security] Senha inicial gerada para usuarios padrao de tenant: ${userPassword.value}`,
      );
    }

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

function assertPasswordMatchesPolicy(
  password: string,
  policy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecial: boolean;
  },
  sourceLabel: string,
) {
  const errors = validatePasswordAgainstPolicy(password, policy);
  if (errors.length > 0) {
    throw new Error(
      `Senha inicial do seed (${sourceLabel}) viola a politica ativa: ${errors.join(' ')}`,
    );
  }
}

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
    select: { id: true, password: true },
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

  const shouldRemediateWeakPassword = await hasLegacyWeakDefaultPassword(existing.password);

  if (!force && !shouldRemediateWeakPassword) {
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

  if (shouldRemediateWeakPassword) {
    summary.notes.push(
      `Senha fraca legada corrigida automaticamente para ${input.email}.`,
    );
  }
}

async function hasLegacyWeakDefaultPassword(passwordHash: string): Promise<boolean> {
  for (const weakPassword of LEGACY_WEAK_DEFAULT_PASSWORDS) {
    if (await bcrypt.compare(weakPassword, passwordHash)) {
      return true;
    }
  }

  return false;
}
