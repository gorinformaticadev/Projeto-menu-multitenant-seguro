import type {
  SecuritySettingItem,
  SecuritySettingResolvedSource,
} from "@/app/configuracoes/seguranca/security-settings.types";

const CATEGORY_LABELS: Record<string, string> = {
  security: "Segurança",
  notifications: "Notificações",
  operations: "Operações",
};

const ORIGIN_LABELS: Record<SecuritySettingResolvedSource, string> = {
  database: "Painel",
  env: "ENV",
  default: "Padrão",
};

const ORIGIN_VARIANTS: Record<SecuritySettingResolvedSource, "default" | "secondary" | "outline"> = {
  database: "default",
  env: "secondary",
  default: "outline",
};

export interface SecuritySettingsGroup {
  category: string;
  label: string;
  items: SecuritySettingItem[];
}

export function groupSecuritySettings(items: SecuritySettingItem[]): SecuritySettingsGroup[] {
  const groups = new Map<string, SecuritySettingsGroup>();

  for (const item of items) {
    if (!groups.has(item.category)) {
      groups.set(item.category, {
        category: item.category,
        label: formatCategoryLabel(item.category),
        items: [],
      });
    }

    groups.get(item.category)!.items.push(item);
  }

  return Array.from(groups.values());
}

export function formatCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? sentenceCase(category);
}

export function getOriginBadgeLabel(source: SecuritySettingResolvedSource): string {
  return ORIGIN_LABELS[source];
}

export function getOriginBadgeVariant(source: SecuritySettingResolvedSource): "default" | "secondary" | "outline" {
  return ORIGIN_VARIANTS[source];
}

export function formatLastUpdated(item: SecuritySettingItem): string | null {
  if (!item.lastUpdatedAt) {
    return null;
  }

  const actor = item.lastUpdatedBy?.name || item.lastUpdatedBy?.email || "Usuário desconhecido";
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(item.lastUpdatedAt));

  return `${actor} em ${formattedDate}`;
}

export function formatVisibleValue(item: SecuritySettingItem): string {
  if (item.valueHidden) {
    return "Valor protegido";
  }

  if (item.type === "boolean") {
    return item.resolvedValue ? "Ativado" : "Desativado";
  }

  if (item.resolvedValue === null || item.resolvedValue === undefined || item.resolvedValue === "") {
    return "Sem valor";
  }

  if (typeof item.resolvedValue === "object") {
    return "Estrutura configurada";
  }

  return String(item.resolvedValue);
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as {
    response?: {
      status?: number;
      data?: {
        message?: string | string[];
      };
    };
  };

  const message = candidate?.response?.data?.message;
  if (Array.isArray(message)) {
    return message.join(", ");
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return fallback;
}

export function getApiErrorStatus(error: unknown): number | null {
  const candidate = error as {
    response?: {
      status?: number;
    };
  };

  return typeof candidate?.response?.status === "number" ? candidate.response.status : null;
}

function sentenceCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
