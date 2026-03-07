export const SYSTEM_AUDIT_ACTION_PREFIXES = [
  'UPDATE_',
  'MAINTENANCE_',
  'BACKUP_',
  'RESTORE_',
  'OPS_',
  'JOB_',
] as const;

export function isSystemAuditAction(action: string): boolean {
  const normalized = String(action || '').trim().toUpperCase();
  return SYSTEM_AUDIT_ACTION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
