import type { SystemNotification } from "@/contexts/SystemNotificationsContext";

export type NotificationReadFilter = "all" | "unread" | "read";
export type NotificationSeverityFilter = "all" | "critical" | "warning" | "info";
export type NotificationCategoryFilter = "all" | "update" | "maintenance" | "backup" | "restore";
export type NotificationCategory = Exclude<NotificationCategoryFilter, "all"> | "system";

export interface SystemNotificationFilters {
  read: NotificationReadFilter;
  severity: NotificationSeverityFilter;
  category: NotificationCategoryFilter;
}

export interface SafeMetadataRow {
  key: string;
  label: string;
  value: string;
}

export interface NotificationContextLink {
  href: string;
  label: string;
}

type MetadataValueFormatter = (value: unknown) => string | null;

interface MetadataFieldConfig {
  key: string;
  label: string;
  formatter?: MetadataValueFormatter;
}

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asBooleanLabel = (value: unknown): string | null => {
  if (typeof value !== "boolean") {
    return null;
  }

  return value ? "Sim" : "Nao";
};

const asInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.round(parsed);
  }

  return null;
};

const formatSeconds = (value: unknown): string | null => {
  const parsed = asInteger(value);
  if (parsed === null || parsed < 0) {
    return null;
  }

  if (parsed < 60) {
    return `${parsed}s`;
  }

  const minutes = Math.floor(parsed / 60);
  const seconds = parsed % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

const formatNumber = (value: unknown): string | null => {
  const parsed = asInteger(value);
  if (parsed === null) {
    return null;
  }

  return String(parsed);
};

const toAction = (value: unknown): string | null => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (!normalized || normalized === "SYSTEM_ALERT") {
    return null;
  }

  return normalized;
};

const KNOWN_METADATA_FIELDS: MetadataFieldConfig[] = [
  { key: "fromVersion", label: "Versao origem", formatter: asString },
  { key: "toVersion", label: "Versao destino", formatter: asString },
  { key: "targetVersion", label: "Versao alvo", formatter: asString },
  { key: "source", label: "Origem", formatter: asString },
  { key: "durationSeconds", label: "Duracao", formatter: formatSeconds },
  { key: "etaSeconds", label: "ETA", formatter: formatSeconds },
  { key: "exitCode", label: "Codigo de saida", formatter: formatNumber },
  { key: "rollbackAttempted", label: "Rollback tentado", formatter: asBooleanLabel },
  { key: "rollbackCompleted", label: "Rollback concluido", formatter: asBooleanLabel },
  { key: "backupId", label: "Backup", formatter: asString },
  { key: "restoreId", label: "Restore", formatter: asString },
  { key: "jobId", label: "Job", formatter: asString },
  { key: "artifactId", label: "Artefato", formatter: asString },
  { key: "backupType", label: "Tipo de backup", formatter: asString },
  { key: "retentionPolicy", label: "Retencao", formatter: formatNumber },
  { key: "reason", label: "Motivo", formatter: asString },
];

export function getNotificationAction(notification: SystemNotification): string | null {
  const fromData = toAction(notification.data?.action);
  if (fromData) {
    return fromData;
  }

  return toAction(notification.type);
}

export function getNotificationCategoryFromAction(action: string | null): NotificationCategory {
  if (!action) {
    return "system";
  }

  if (action.startsWith("UPDATE_")) {
    return "update";
  }
  if (action.startsWith("MAINTENANCE_")) {
    return "maintenance";
  }
  if (action.startsWith("BACKUP_")) {
    return "backup";
  }
  if (action.startsWith("RESTORE_")) {
    return "restore";
  }

  return "system";
}

export function getNotificationCategoryLabel(category: NotificationCategory): string {
  if (category === "update") {
    return "Update";
  }
  if (category === "maintenance") {
    return "Maintenance";
  }
  if (category === "backup") {
    return "Backup";
  }
  if (category === "restore") {
    return "Restore";
  }

  return "Sistema";
}

export function getNotificationContextLink(notification: SystemNotification): NotificationContextLink | null {
  const category = getNotificationCategoryFromAction(getNotificationAction(notification));

  if (category === "update") {
    return {
      href: "/configuracoes/sistema/updates?tab=status",
      label: "Abrir atualizacoes",
    };
  }

  if (category === "backup" || category === "restore") {
    return {
      href: "/configuracoes/sistema/updates?tab=backup",
      label: "Abrir backups",
    };
  }

  if (category === "maintenance") {
    return {
      href: "/configuracoes/sistema/updates?tab=status",
      label: "Abrir sistema",
    };
  }

  return null;
}

export function getNotificationSafeMetadataRows(
  data: Record<string, unknown> | null | undefined,
): SafeMetadataRow[] {
  if (!data) {
    return [];
  }

  const rows: SafeMetadataRow[] = [];

  for (const field of KNOWN_METADATA_FIELDS) {
    const value = data[field.key];
    if (value === undefined || value === null) {
      continue;
    }

    const formatted = field.formatter ? field.formatter(value) : asString(value);
    if (!formatted) {
      continue;
    }

    rows.push({
      key: field.key,
      label: field.label,
      value: formatted,
    });
  }

  return rows;
}

export function filterSystemNotifications(
  items: SystemNotification[],
  filters: SystemNotificationFilters,
): SystemNotification[] {
  return items.filter((item) => {
    if (filters.read === "unread" && item.isRead) {
      return false;
    }
    if (filters.read === "read" && !item.isRead) {
      return false;
    }

    if (filters.severity !== "all" && item.severity !== filters.severity) {
      return false;
    }

    if (filters.category !== "all") {
      const action = getNotificationAction(item);
      const category = getNotificationCategoryFromAction(action);
      if (category !== filters.category) {
        return false;
      }
    }

    return true;
  });
}

export function formatNotificationRelativeTime(dateInput: string): string {
  const now = new Date();
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "data invalida";
  }

  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return "agora";
  }
  if (minutes < 60) {
    return `ha ${minutes}min`;
  }
  if (hours < 24) {
    return `ha ${hours}h`;
  }
  if (days < 7) {
    return `ha ${days}d`;
  }

  return date.toLocaleDateString("pt-BR");
}

export function formatNotificationFullDate(dateInput: string): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "data invalida";
  }

  return date.toLocaleString("pt-BR");
}
