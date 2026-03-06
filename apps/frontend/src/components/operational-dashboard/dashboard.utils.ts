export type DashboardMetricStatus =
  | "ok"
  | "healthy"
  | "degraded"
  | "down"
  | "restricted"
  | "unavailable"
  | "not_configured";

export type DashboardMetric = {
  status?: DashboardMetricStatus | string;
  [key: string]: unknown;
};

export type DashboardRole = "SUPER_ADMIN" | "ADMIN" | "USER" | "CLIENT";

export function formatBytes(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return "--";
  }

  if (numeric === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(numeric) / Math.log(1024)));
  const amount = numeric / 1024 ** exponent;
  const precision = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(precision)} ${units[exponent]}`;
}

export function formatDateTime(value: unknown): string {
  if (!value) {
    return "--";
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function formatDurationSeconds(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--";
  }

  const whole = Math.floor(seconds);
  const days = Math.floor(whole / 86400);
  const hours = Math.floor((whole % 86400) / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;

  const prefix = days > 0 ? `${days}d ` : "";
  return `${prefix}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    remainder,
  ).padStart(2, "0")}`;
}

export function isMetricUnavailable(metric: unknown): boolean {
  const status = String((metric as DashboardMetric | undefined)?.status || "").toLowerCase();
  return status === "unavailable" || status === "restricted";
}

export function statusTone(status: unknown): "neutral" | "good" | "warn" | "danger" {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "healthy" || normalized === "ok") {
    return "good";
  }
  if (normalized === "warning" || normalized === "degraded") {
    return "warn";
  }
  if (normalized === "critical" || normalized === "down" || normalized === "unavailable") {
    return "danger";
  }
  return "neutral";
}

export function allowedWidgetIdsByRole(role: DashboardRole): string[] {
  if (role === "SUPER_ADMIN") {
    return [
      "version",
      "uptime",
      "maintenance",
      "api",
      "cpu",
      "memory",
      "disk",
      "system",
      "database",
      "redis",
      "workers",
      "jobs",
      "backup",
      "errors",
      "security",
      "tenants",
      "notifications",
    ];
  }

  if (role === "ADMIN") {
    return [
      "version",
      "uptime",
      "maintenance",
      "api",
      "cpu",
      "memory",
      "database",
      "jobs",
      "backup",
      "errors",
      "security",
      "notifications",
    ];
  }

  return ["version", "uptime", "maintenance", "api", "notifications"];
}

export function normalizeLayoutForWidgets(
  rawLayout: unknown,
  widgetIds: string[],
): Record<string, Array<Record<string, number | string>>> {
  const fallback = buildDefaultLayout(widgetIds);
  if (!rawLayout || typeof rawLayout !== "object" || Array.isArray(rawLayout)) {
    return fallback;
  }

  const source = rawLayout as Record<string, unknown>;
  const normalized: Record<string, Array<Record<string, number | string>>> = {};
  const breakpoints = ["lg", "md", "sm"];

  for (const breakpoint of breakpoints) {
    const candidate = source[breakpoint];
    if (!Array.isArray(candidate)) {
      normalized[breakpoint] = fallback[breakpoint];
      continue;
    }

    const sanitized = candidate
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item, index) => {
        const row = item as Record<string, unknown>;
        const i = String(row.i || widgetIds[index] || "").trim();
        const x = Number(row.x);
        const y = Number(row.y);
        const w = Number(row.w);
        const h = Number(row.h);

        return {
          i,
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : index,
          w: Number.isFinite(w) && w > 0 ? w : 1,
          h: Number.isFinite(h) && h > 0 ? h : 1,
          minW: 1,
          minH: 1,
        };
      })
      .filter((item) => widgetIds.includes(String(item.i)));

    const merged = mergeLayoutWithWidgetIds(sanitized, widgetIds, breakpoint === "lg" ? 4 : breakpoint === "md" ? 2 : 1);
    normalized[breakpoint] = merged;
  }

  return normalized;
}

function buildDefaultLayout(widgetIds: string[]): Record<string, Array<Record<string, number | string>>> {
  return {
    lg: mergeLayoutWithWidgetIds([], widgetIds, 4),
    md: mergeLayoutWithWidgetIds([], widgetIds, 2),
    sm: mergeLayoutWithWidgetIds([], widgetIds, 1),
  };
}

function mergeLayoutWithWidgetIds(
  items: Array<Record<string, number | string>>,
  widgetIds: string[],
  columns: number,
): Array<Record<string, number | string>> {
  const used = new Set(items.map((item) => String(item.i)));
  const merged = [...items];

  for (const id of widgetIds) {
    if (used.has(id)) {
      continue;
    }

    const index = merged.length;
    merged.push({
      i: id,
      x: index % columns,
      y: Math.floor(index / columns),
      w: 1,
      h: 1,
      minW: 1,
      minH: 1,
    });
  }

  return merged;
}
