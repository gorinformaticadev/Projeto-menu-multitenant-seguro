import { randomBytes } from 'crypto';

export const DEFAULT_MASTER_TENANT = {
  email: process.env.SEED_MASTER_TENANT_EMAIL || 'empresa1@example.com',
  cnpjCpf: process.env.SEED_MASTER_TENANT_CNPJ_CPF || '12345678901234',
  nomeFantasia: process.env.SEED_MASTER_TENANT_NAME || 'GOR Informatica',
  nomeResponsavel: process.env.SEED_MASTER_TENANT_OWNER || 'Joao Silva',
  telefone: process.env.SEED_MASTER_TENANT_PHONE || '(11) 98765-4321',
};

export const DEFAULT_USERS = {
  superAdminEmail: process.env.INSTALL_ADMIN_EMAIL || 'admin@system.com',
  superAdminName: process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin',
  tenantAdminEmail: process.env.SEED_TENANT_ADMIN_EMAIL || 'admin@empresa1.com',
  tenantAdminName: process.env.SEED_TENANT_ADMIN_NAME || 'Admin da Empresa',
  tenantUserEmail: process.env.SEED_TENANT_USER_EMAIL || 'user@empresa1.com',
  tenantUserName: process.env.SEED_TENANT_USER_NAME || 'Usuario Comum',
};

export type ResolvedSeedPassword = {
  value: string;
  source: 'env' | 'generated';
  envKey?: string;
};

const generateStrongSeedPassword = () => {
  return `Aa1!${randomBytes(18).toString('base64url')}`;
};

export const resolveAdminPassword = (): ResolvedSeedPassword => {
  const explicitPassword = process.env.INSTALL_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD;
  if (explicitPassword) {
    return {
      value: explicitPassword,
      source: 'env',
      envKey: process.env.INSTALL_ADMIN_PASSWORD ? 'INSTALL_ADMIN_PASSWORD' : 'ADMIN_DEFAULT_PASSWORD',
    };
  }

  return {
    value: generateStrongSeedPassword(),
    source: 'generated',
  };
};

export const resolveUserPassword = (
  fallbackPassword: ResolvedSeedPassword,
): ResolvedSeedPassword => {
  const explicitPassword = process.env.USER_DEFAULT_PASSWORD;
  if (explicitPassword) {
    return {
      value: explicitPassword,
      source: 'env',
      envKey: 'USER_DEFAULT_PASSWORD',
    };
  }

  return fallbackPassword;
};

export const DEFAULT_SECURITY_CONFIG = {
  twoFactorEnabled: true,
  twoFactorRequired: false,
  twoFactorRequiredForAdmins: false,
  twoFactorSuggested: true,
  sessionTimeoutMinutes: 30,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecial: true,
  loginMaxAttempts: 5,
  loginLockDurationMinutes: 15,
  platformName: 'Sistema Multitenant',
  platformEmail: 'admin@sistema.com',
} as const;

export const SEED_LOCK_KEY = `seed.pipeline.${process.env.SEED_LOCK_ID || 87456321}`;
export const SEED_LOCK_WAIT_SECONDS = Number(process.env.SEED_LOCK_WAIT_SECONDS || 90);
export const SEED_LOCK_RETRY_MS = Number(process.env.SEED_LOCK_RETRY_MS || 2000);
export const SEED_LOCK_TTL_MS = Number(process.env.SEED_LOCK_TTL_MS || 120000);
