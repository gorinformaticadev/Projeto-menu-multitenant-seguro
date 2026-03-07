"use client";

import type {
  DashboardMetric,
  DashboardMetricStatus,
  DashboardRole,
} from "@/components/operational-dashboard/dashboard.utils";

export type DashboardQuickFilter =
  | "all"
  | "problems"
  | "critical"
  | "operations"
  | "infrastructure";

export type DashboardNavigationIntent =
  | {
    type: "route";
    href: string;
    label: string;
  }
  | {
    type: "notifications-drawer";
    label: string;
  };

export type DashboardQuickAction = {
  id: string;
  label: string;
  description: string;
  intent: DashboardNavigationIntent;
};

export const dashboardQuickFilterOptions: Array<{
  id: DashboardQuickFilter;
  label: string;
  description: string;
}> = [
  {
    id: "all",
    label: "Tudo",
    description: "Exibe todos os blocos visiveis no dashboard.",
  },
  {
    id: "problems",
    label: "Problemas",
    description: "Foca apenas em widgets com sinal operacional relevante.",
  },
  {
    id: "critical",
    label: "Criticos",
    description: "Mostra falhas graves, restricoes e alertas criticos.",
  },
  {
    id: "operations",
    label: "Operacao",
    description: "Mostra execucao operacional, backups, jobs e notificacoes.",
  },
  {
    id: "infrastructure",
    label: "Infraestrutura",
    description: "Mostra API, recursos do servidor e componentes de infra.",
  },
];

const operationsWidgetIds = new Set([
  "version",
  "uptime",
  "maintenance",
  "jobs",
  "backup",
  "errors",
  "tenants",
  "notifications",
]);

const infrastructureWidgetIds = new Set([
  "api",
  "cpu",
  "memory",
  "disk",
  "system",
  "database",
  "redis",
  "workers",
  "security",
]);

const problemStatuses = new Set<DashboardMetricStatus | string>([
  "degraded",
  "error",
  "down",
  "unavailable",
  "restricted",
]);

const criticalStatuses = new Set<DashboardMetricStatus | string>([
  "error",
  "down",
  "unavailable",
  "restricted",
]);

type MetricMap = Record<string, DashboardMetric | null | undefined>;

function normalizeStatus(metric: DashboardMetric | null | undefined): string {
  return String(metric?.status || "")
    .trim()
    .toLowerCase();
}

function asCount(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function getDeniedAccessCount(metric: DashboardMetric | null | undefined): number {
  const deniedAccess = Array.isArray(metric?.deniedAccess) ? metric.deniedAccess : [];
  return deniedAccess.reduce((total, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return total;
    }

    return total + asCount((item as Record<string, unknown>).count);
  }, 0);
}

function hasRecentEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasProblemSignal(widgetId: string, metric: DashboardMetric | null | undefined): boolean {
  const status = normalizeStatus(metric);
  if (problemStatuses.has(status)) {
    return true;
  }

  if (widgetId === "maintenance") {
    return Boolean(metric?.enabled);
  }

  if (widgetId === "notifications") {
    return asCount(metric?.criticalUnread) > 0 || asCount(metric?.criticalRecent) > 0;
  }

  if (widgetId === "errors") {
    return hasRecentEntries(metric?.recent);
  }

  if (widgetId === "jobs") {
    return asCount(metric?.failedLast24h) > 0 || hasRecentEntries(metric?.recentFailures);
  }

  if (widgetId === "security") {
    return getDeniedAccessCount(metric) > 0;
  }

  return false;
}

function hasCriticalSignal(widgetId: string, metric: DashboardMetric | null | undefined): boolean {
  const status = normalizeStatus(metric);
  if (criticalStatuses.has(status)) {
    return true;
  }

  if (widgetId === "notifications") {
    return asCount(metric?.criticalUnread) > 0;
  }

  if (widgetId === "errors") {
    return hasRecentEntries(metric?.recent);
  }

  if (widgetId === "security") {
    return getDeniedAccessCount(metric) > 0;
  }

  return false;
}

export function matchesDashboardQuickFilter(
  widgetId: string,
  filter: DashboardQuickFilter,
  metrics: MetricMap,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "operations") {
    return operationsWidgetIds.has(widgetId);
  }

  if (filter === "infrastructure") {
    return infrastructureWidgetIds.has(widgetId);
  }

  const metric = metrics[widgetId];
  if (filter === "problems") {
    return hasProblemSignal(widgetId, metric);
  }

  if (filter === "critical") {
    return hasCriticalSignal(widgetId, metric);
  }

  return true;
}

export function filterDashboardWidgetIds(
  widgetIds: string[],
  filter: DashboardQuickFilter,
  metrics: MetricMap,
): string[] {
  return widgetIds.filter((widgetId) => matchesDashboardQuickFilter(widgetId, filter, metrics));
}

export function getDashboardWidgetIntent(
  widgetId: string,
  role: DashboardRole,
  notificationsEnabled: boolean,
): DashboardNavigationIntent | null {
  if ((widgetId === "version" || widgetId === "maintenance") && (role === "SUPER_ADMIN" || role === "ADMIN")) {
    return {
      type: "route",
      href: "/configuracoes/sistema/updates?tab=status",
      label: "Abrir atualizacoes",
    };
  }

  if (widgetId === "backup" && (role === "SUPER_ADMIN" || role === "ADMIN")) {
    return {
      type: "route",
      href: "/configuracoes/sistema/updates?tab=backup",
      label: "Abrir backups",
    };
  }

  if (widgetId === "errors" && role === "SUPER_ADMIN") {
    return {
      type: "route",
      href: "/logs",
      label: "Abrir auditoria",
    };
  }

  if (widgetId === "notifications" && role === "SUPER_ADMIN" && notificationsEnabled) {
    return {
      type: "notifications-drawer",
      label: "Ver notificacoes criticas",
    };
  }

  return null;
}

export function getDashboardQuickActions(
  role: DashboardRole,
  notificationsEnabled: boolean,
): DashboardQuickAction[] {
  const actions: DashboardQuickAction[] = [];

  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    actions.push({
      id: "updates",
      label: "Abrir atualizacoes",
      description: "Vai para status de versao, maintenance e update do sistema.",
      intent: {
        type: "route",
        href: "/configuracoes/sistema/updates?tab=status",
        label: "Abrir atualizacoes",
      },
    });

    actions.push({
      id: "backups",
      label: "Abrir backups",
      description: "Abre a area de backup e restore ja existente no sistema.",
      intent: {
        type: "route",
        href: "/configuracoes/sistema/updates?tab=backup",
        label: "Abrir backups",
      },
    });
  }

  if (role === "SUPER_ADMIN" && notificationsEnabled) {
    actions.push({
      id: "notifications",
      label: "Ver notificacoes criticas",
      description: "Reabre a central lateral de notificacoes a partir do dashboard.",
      intent: {
        type: "notifications-drawer",
        label: "Ver notificacoes criticas",
      },
    });
  }

  if (role === "SUPER_ADMIN") {
    actions.push({
      id: "logs",
      label: "Ver auditoria",
      description: "Abre a tela de logs para investigar eventos criticos recentes.",
      intent: {
        type: "route",
        href: "/logs",
        label: "Ver auditoria",
      },
    });
  }

  return actions;
}
