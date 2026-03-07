export type DashboardMetricStatus =
  | "ok"
  | "healthy"
  | "error"
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

type DashboardBreakpoint = "lg" | "md" | "sm";
type LayoutEntry = Record<string, number | string>;
type LayoutPreset = {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

export const dashboardGridBreakpoints = {
  lg: 1280,
  md: 900,
  sm: 0,
} as const;

export const dashboardGridCols = {
  lg: 8,
  md: 6,
  sm: 1,
} as const;

export const dashboardGridRowHeight = 104;
export const dashboardMobileEditingMaxWidth = 640;

const analyticsWidgetIds = new Set(["api", "cpu", "memory", "disk", "security", "errors", "routeLatency", "routeErrors"]);

const tallWidgetIds = new Set(["backup"]);
const smallViewportPriority = [
  "operationalOverview",
  "platform:welcome",
  "platform:statistics",
  "errors",
  "routeErrors",
  "security",
  "routeLatency",
  "backup",
  "database",
  "workers",
  "redis",
  "system",
  "version",
  "uptime",
  "tenants",
  "notifications",
] as const;

export function isDashboardMobileViewport(width: number): boolean {
  return Number.isFinite(width) && width > 0 && width < dashboardMobileEditingMaxWidth;
}

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
  return status === "error" || status === "down" || status === "unavailable" || status === "restricted";
}

export function statusTone(status: unknown): "neutral" | "good" | "warn" | "danger" {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "healthy" || normalized === "ok") {
    return "good";
  }
  if (normalized === "warning" || normalized === "degraded") {
    return "warn";
  }
  if (normalized === "critical" || normalized === "error" || normalized === "down" || normalized === "unavailable") {
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
      "routeLatency",
      "routeErrors",
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
      "routeLatency",
      "routeErrors",
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
  const breakpoints: DashboardBreakpoint[] = ["lg", "md", "sm"];

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
        return normalizeLayoutItem(
          row,
          String(row.i || widgetIds[index] || "").trim(),
          breakpoint,
        );
      })
      .filter((item) => widgetIds.includes(String(item.i)));

    normalized[breakpoint] = mergeLayoutWithWidgetIds(sanitized, widgetIds, breakpoint);
  }

  return normalized;
}

function buildDefaultLayout(
  widgetIds: string[],
): Record<DashboardBreakpoint, Array<Record<string, number | string>>> {
  return {
    lg: mergeLayoutWithWidgetIds([], widgetIds, "lg"),
    md: mergeLayoutWithWidgetIds([], widgetIds, "md"),
    sm: mergeLayoutWithWidgetIds([], widgetIds, "sm"),
  };
}

function mergeLayoutWithWidgetIds(
  items: LayoutEntry[],
  widgetIds: string[],
  breakpoint: DashboardBreakpoint,
): LayoutEntry[] {
  const columns = dashboardGridCols[breakpoint];
  const merged: LayoutEntry[] = [];
  const used = new Set<string>();
  const orderedWidgetIds = sortWidgetIdsForBreakpoint(widgetIds, breakpoint);
  const orderedItems = [...items].sort((left, right) => {
    const byRow = Number(left.y) - Number(right.y);
    if (byRow !== 0) {
      return byRow;
    }
    return Number(left.x) - Number(right.x);
  });

  for (const item of orderedItems) {
    const id = String(item.i || "").trim();
    if (!id || used.has(id) || !widgetIds.includes(id)) {
      continue;
    }

    const normalized = normalizeLayoutItem(item, id, breakpoint);
    const preferredX = clampValue(Number(normalized.x), 0, Math.max(0, columns - Number(normalized.w)));
    const preferredY = Math.max(0, Number(normalized.y));
    const spot = findAvailableSpot(
      merged,
      Number(normalized.w),
      Number(normalized.h),
      columns,
      preferredX,
      preferredY,
    );

    merged.push({
      ...normalized,
      x: spot.x,
      y: spot.y,
    });
    used.add(id);
  }

  for (const id of orderedWidgetIds) {
    if (used.has(id)) {
      continue;
    }

    const preset = getWidgetLayoutPreset(id, breakpoint);
    const spot = findAvailableSpot(merged, preset.w, preset.h, columns);
    merged.push({
      i: id,
      x: spot.x,
      y: spot.y,
      ...preset,
    });
  }

  return merged;
}

function sortWidgetIdsForBreakpoint(
  widgetIds: string[],
  breakpoint: DashboardBreakpoint,
): string[] {
  if (breakpoint !== "sm") {
    return widgetIds;
  }

  const priority = new Map<string, number>(
    smallViewportPriority.map((id, index) => [id, index]),
  );

  return [...widgetIds].sort((left, right) => {
    const leftPriority = priority.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(right) ?? Number.MAX_SAFE_INTEGER;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return widgetIds.indexOf(left) - widgetIds.indexOf(right);
  });
}

function normalizeLayoutItem(
  item: LayoutEntry | Record<string, unknown>,
  id: string,
  breakpoint: DashboardBreakpoint,
): LayoutEntry {
  const columns = dashboardGridCols[breakpoint];
  const preset = getWidgetLayoutPreset(id, breakpoint);
  const rawMinW = clampOptional(Number(item.minW), 1, columns);
  const rawMaxW = clampOptional(Number(item.maxW), 1, columns);
  const minW = Math.min(rawMinW ?? preset.minW ?? preset.w, rawMaxW ?? columns);
  const maxW = Math.max(rawMaxW ?? preset.maxW ?? columns, minW);
  const w = clampValue(Number(item.w), minW, Math.min(maxW, columns));
  const minH = Math.max(1, clampOptional(Number(item.minH), 1, 12) ?? preset.minH ?? preset.h);
  const maxH = Math.max(clampOptional(Number(item.maxH), minH, 12) ?? preset.maxH ?? 12, minH);
  const h = clampValue(Number(item.h), minH, maxH);

  return {
    i: id,
    x: clampValue(Number(item.x), 0, Math.max(0, columns - w)),
    y: Math.max(0, Number.isFinite(Number(item.y)) ? Math.floor(Number(item.y)) : 0),
    w,
    h,
    minW,
    minH,
    ...(maxW < columns ? { maxW } : {}),
    ...(maxH < 12 ? { maxH } : {}),
  };
}

function getWidgetLayoutPreset(id: string, breakpoint: DashboardBreakpoint): LayoutPreset {
  const columns = dashboardGridCols[breakpoint];

  if (id === "operationalOverview") {
    if (breakpoint === "lg") {
      return clampPreset({ w: 4, h: 2, minW: 3, minH: 2, maxW: 6, maxH: 3 }, columns);
    }

    if (breakpoint === "md") {
      return clampPreset({ w: 4, h: 2, minW: 3, minH: 2, maxW: 6, maxH: 3 }, columns);
    }

    return clampPreset({ w: columns, h: 2, minW: 1, minH: 2 }, columns);
  }

  if (id === "platform:welcome") {
    if (breakpoint === "lg") {
      return clampPreset({ w: 3, h: 2, minW: 3, minH: 2, maxW: 4, maxH: 3 }, columns);
    }

    if (breakpoint === "md") {
      return clampPreset({ w: 3, h: 2, minW: 3, minH: 2, maxW: 4, maxH: 3 }, columns);
    }

    return clampPreset({ w: columns, h: 2, minW: 1, minH: 2 }, columns);
  }

  if (id === "platform:statistics") {
    if (breakpoint === "lg") {
      return clampPreset({ w: 3, h: 2, minW: 3, minH: 2, maxW: 4, maxH: 3 }, columns);
    }

    if (breakpoint === "md") {
      return clampPreset({ w: 3, h: 2, minW: 3, minH: 2, maxW: 4, maxH: 3 }, columns);
    }

    return clampPreset({ w: columns, h: 2, minW: 1, minH: 2 }, columns);
  }

  if (analyticsWidgetIds.has(id)) {
    if (breakpoint === "lg") {
      return clampPreset({ w: 4, h: 2, minW: 3, minH: 2, maxW: 5, maxH: 3 }, columns);
    }

    if (breakpoint === "md") {
      return clampPreset({ w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 }, columns);
    }

    return clampPreset({ w: columns, h: 2, minW: Math.min(2, columns), minH: 2 }, columns);
  }

  if (tallWidgetIds.has(id)) {
    if (breakpoint === "lg") {
      return clampPreset({ w: 4, h: 2, minW: 3, minH: 2, maxW: 5, maxH: 3 }, columns);
    }

    if (breakpoint === "md") {
      return clampPreset({ w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 }, columns);
    }

    return clampPreset({ w: columns, h: 2, minW: Math.min(2, columns), minH: 2 }, columns);
  }

  if (breakpoint === "sm") {
    return clampPreset({ w: 2, h: 1, minW: 1, minH: 1, maxW: 2, maxH: 2 }, columns);
  }

  return clampPreset({ w: 2, h: 1, minW: 1, minH: 1, maxW: 3, maxH: 2 }, columns);
}

function clampPreset(preset: LayoutPreset, columns: number): LayoutPreset {
  const minW = clampValue(preset.minW ?? 1, 1, columns);
  const maxW = Math.max(clampOptional(preset.maxW, minW, columns) ?? columns, minW);
  const minH = Math.max(1, clampOptional(preset.minH, 1, 12) ?? 1);
  const maxH = Math.max(clampOptional(preset.maxH, minH, 12) ?? 12, minH);

  return {
    w: clampValue(preset.w, minW, Math.min(columns, maxW)),
    h: clampValue(preset.h, minH, maxH),
    minW,
    minH,
    ...(maxW < columns ? { maxW } : {}),
    ...(maxH < 12 ? { maxH } : {}),
  };
}

function findAvailableSpot(
  items: LayoutEntry[],
  width: number,
  height: number,
  columns: number,
  preferredX = 0,
  preferredY = 0,
): { x: number; y: number } {
  const safeWidth = clampValue(width, 1, columns);
  const safeHeight = Math.max(1, Math.floor(height));
  const maxY = items.reduce((max, item) => Math.max(max, Number(item.y) + Number(item.h)), 0);
  const searchLimit = Math.max(maxY + 8, 24);

  if (fitsAtPosition(items, preferredX, preferredY, safeWidth, safeHeight, columns)) {
    return { x: preferredX, y: preferredY };
  }

  for (let y = 0; y <= searchLimit; y += 1) {
    for (let x = 0; x <= columns - safeWidth; x += 1) {
      if (fitsAtPosition(items, x, y, safeWidth, safeHeight, columns)) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: maxY };
}

function fitsAtPosition(
  items: LayoutEntry[],
  x: number,
  y: number,
  width: number,
  height: number,
  columns: number,
): boolean {
  if (x < 0 || y < 0 || x + width > columns) {
    return false;
  }

  return items.every((item) => {
    const left = Number(item.x);
    const top = Number(item.y);
    const right = left + Number(item.w);
    const bottom = top + Number(item.h);

    return x + width <= left || x >= right || y + height <= top || y >= bottom;
  });
}

function clampValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function clampOptional(value: number, min: number, max: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return clampValue(value, min, max);
}

