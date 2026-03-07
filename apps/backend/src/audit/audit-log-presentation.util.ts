const AUDIT_ACTION_LABELS: Record<string, string> = {
  ACCOUNT_LOCKED: "Conta bloqueada",
  BACKUP_COMPLETED: "Backup concluido",
  BACKUP_FAILED: "Backup falhou",
  BACKUP_STARTED: "Backup iniciado",
  LOGIN_2FA_FAILED: "Falha no login com 2FA",
  LOGIN_2FA_REQUIRED: "2FA obrigatorio",
  LOGIN_2FA_SUCCESS: "Login com 2FA realizado",
  LOGIN_BLOCKED: "Login bloqueado",
  LOGIN_FAILED: "Falha no login",
  LOGIN_SUCCESS: "Login realizado",
  LOGOUT: "Logout realizado",
  MAINTENANCE_BYPASS_USED: "Bypass de manutencao utilizado",
  MAINTENANCE_DISABLED: "Modo de manutencao desativado",
  MAINTENANCE_ENABLED: "Modo de manutencao ativado",
  RATE_LIMIT_BLOCKED: "Rate limit bloqueado",
  RESTORE_COMPLETED: "Restauracao concluida",
  RESTORE_FAILED: "Restauracao falhou",
  RESTORE_STARTED: "Restauracao iniciada",
  SYSTEM_DATA_RETENTION_FAILED: "Falha na retencao automatica",
  TOKEN_REFRESHED: "Sessao renovada",
  UPDATE_COMPLETED: "Atualizacao concluida",
  UPDATE_FAILED: "Atualizacao falhou",
  UPDATE_ROLLED_BACK_AUTO: "Rollback automatico aplicado",
  UPDATE_ROLLBACK_MANUAL: "Rollback manual executado",
  UPDATE_RUN_REQUESTED: "Atualizacao solicitada",
  UPDATE_STARTED: "Atualizacao iniciada",
};

const AUDIT_ACTION_WORDS: Record<string, string> = {
  ACCESS: "acesso",
  ACCOUNT: "conta",
  ACTION: "acao",
  ADMIN: "admin",
  API: "API",
  ATTEMPT: "tentativa",
  ATTEMPTS: "tentativas",
  AUDIT: "auditoria",
  AUTH: "autenticacao",
  AUTO: "automatico",
  BACK: "retorno",
  BACKUP: "backup",
  BLOCKED: "bloqueado",
  BYPASS: "bypass",
  COMPLETED: "concluido",
  CONFIG: "configuracao",
  CREATED: "criado",
  CRITICAL: "critico",
  DATA: "dados",
  DELETED: "removido",
  DENIED: "negado",
  DISABLED: "desativado",
  ENABLED: "ativado",
  ERROR: "erro",
  FAILED: "falhou",
  HEALTH: "saude",
  INFO: "informacao",
  INVALID: "invalido",
  IP: "IP",
  JOB: "job",
  JOBS: "jobs",
  LIMIT: "limite",
  LOCKED: "bloqueado",
  LOGIN: "login",
  LOGOUT: "logout",
  MAINTENANCE: "manutencao",
  MANUAL: "manual",
  MODULE: "modulo",
  NOTIFICATION: "notificacao",
  PASSWORD: "senha",
  RATE: "taxa",
  REFRESHED: "renovada",
  REQUIRED: "obrigatorio",
  RESET: "redefinicao",
  RESTORE: "restauracao",
  RETENTION: "retencao",
  ROLLED: "rollback",
  RUN: "execucao",
  SECURITY: "seguranca",
  SESSION: "sessao",
  STARTED: "iniciado",
  SUCCESS: "sucesso",
  SYSTEM: "sistema",
  TENANT: "tenant",
  TENANTS: "tenants",
  TOKEN: "token",
  UNAUTHORIZED: "nao autorizado",
  UPDATED: "atualizado",
  UPDATE: "atualizacao",
  USED: "utilizado",
  USER: "usuario",
  USERS: "usuarios",
  VERSION: "versao",
  WARNING: "alerta",
};

function isTechnicalAuditMessage(value: string): boolean {
  return /^[A-Z0-9_]+$/.test(value.trim());
}

function toSentenceCase(value: string): string {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function humanizeAuditAction(action: unknown): string {
  const normalized = String(action || "").trim().toUpperCase();
  if (!normalized) {
    return "Evento de auditoria";
  }

  const mapped = AUDIT_ACTION_LABELS[normalized];
  if (mapped) {
    return mapped;
  }

  const parts = normalized.split("_").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return normalized;
  }

  const humanized = parts
    .map((part) => AUDIT_ACTION_WORDS[part] || part.toLowerCase())
    .join(" ");

  return toSentenceCase(humanized);
}

export function resolveAuditDisplayMessage(action: unknown, message?: unknown): string {
  const normalizedAction = String(action || "").trim().toUpperCase();
  const actionLabel = humanizeAuditAction(normalizedAction);
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    return actionLabel;
  }

  if (normalizedMessage.toUpperCase() === normalizedAction) {
    return actionLabel;
  }

  if (isTechnicalAuditMessage(normalizedMessage)) {
    return humanizeAuditAction(normalizedMessage);
  }

  return normalizedMessage;
}
