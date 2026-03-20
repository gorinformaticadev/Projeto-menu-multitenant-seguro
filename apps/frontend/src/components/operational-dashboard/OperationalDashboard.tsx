"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  DashboardLayoutResponse,
  SystemDashboardResponse,
  SystemDashboardSeverity,
} from "@contracts/dashboard";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BellDot,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  Maximize2,
  RefreshCw,
  Server,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Responsive,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from "react-grid-layout";
import {
  getSystemDashboard,
  getSystemDashboardLayout,
  saveSystemDashboardLayout,
} from "@/lib/contracts/dashboard-client";
import {
  CONTRACT_DEGRADATION_EVENT_NAME,
  executeContractRequestWithRetry,
  isContractValidationError,
  isTransientRequestError,
  type ContractVersionDowngradeDetail,
} from "@/lib/contracts/contract-runtime";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemNotificationsContext } from "@/contexts/SystemNotificationsContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  dashboardQuickFilterOptions,
  filterDashboardWidgetIds,
  getDashboardQuickActions,
  getDashboardWidgetIntent,
  type DashboardNavigationIntent,
  type DashboardQuickFilter,
} from "@/components/operational-dashboard/dashboard.interactions";
import {
  allowedWidgetIdsByRole,
  dashboardGridBreakpoints,
  dashboardGridCols,
  dashboardGridRowHeight,
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
  isDashboardMobileViewport,
  normalizeLayoutForWidgets,
  statusTone,
  type DashboardMetric,
  type DashboardRole,
} from "@/components/operational-dashboard/dashboard.utils";
import {
  DashboardSurfaceState,
  DashboardMetricState,
  resolveDashboardMetricState,
} from "@/components/operational-dashboard/DashboardMetricState";
import { resolveRuntimeMitigationBanner } from "@/components/operational-dashboard/runtime-mitigation";
import {
  OperationalDashboardWidget,
  OperationalDashboardWidgetSkeleton,
} from "@/components/operational-dashboard/OperationalDashboardWidget";

export type OperationalDashboardFiltersState = {
  periodMinutes: number;
  tenantId: string;
  severity: SystemDashboardSeverity;
};

type Layouts = ReturnType<typeof normalizeLayoutForWidgets>;
type HealthBucketKey = "good" | "attention" | "restricted";
type HealthBucketItem = {
  id: string;
  label: string;
  statusLabel: string;
};
type SignalDetailItem = {
  label: string;
  hint?: string;
};
type OverviewStatItem = {
  widgetId: string;
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "danger";
  trend?: SparklineConfig;
};
type TrendPoint = {
  at: string;
  label: string;
  value: number | null;
  sampleSize?: number;
};
type SparklineConfig = {
  id: string;
  data: TrendPoint[];
  strokeColor: string;
  fillColor: string;
  emptyLabel?: string;
  valueSuffix?: string;
};

type RouteTelemetryItem = {
  method: string;
  route: string;
  requestCount: number;
  avgMs: number | null;
  p95Ms: number | null;
  errorCount: number;
  errorRate: number;
  status5xx: number;
  lastErrorAt: string | null;
};

type SecurityIpTelemetryItem = {
  ip: string;
  count: number;
  lastSeenAt: string;
  route: string | null;
};

type SecurityRecentTelemetryItem = {
  type: string;
  statusCode: number;
  method: string;
  route: string;
  ip: string;
  at: string;
};

type OperationalAlertListItem = {
  id: string;
  title: string;
  body: string;
  severity: string;
  createdAt: string;
  action?: string | null;
};

const POLL_INTERVAL_MS = 15000;
const DASHBOARD_SNAPSHOT_TTL_MS = 2 * 60 * 1000;
const STALE_SNAPSHOT_RETRY_MS = 10_000;

const widgetLabelById: Record<string, string> = {
  version: "Versao",
  uptime: "Uptime",
  maintenance: "Maintenance",
  api: "API",
  cpu: "CPU",
  memory: "Memoria",
  disk: "Disco",
  system: "Sistema",
  database: "Banco",
  redis: "Redis",
  workers: "Workers",
  jobs: "Jobs",
  backup: "Backup",
  routeLatency: "Rotas lentas",
  routeErrors: "Rotas com erro",
  errors: "Erros",
  security: "Seguranca",
  tenants: "Tenants",
  notifications: "Notificacoes",
};

const embeddedOverviewWidgetIds = new Set([
  "maintenance",
  "api",
  "cpu",
  "memory",
  "disk",
  "jobs",
  "security",
  "tenants",
  "notifications",
]);

function filterStandaloneWidgetIds(widgetIds: string[]): string[] {
  return widgetIds.filter((id) => !embeddedOverviewWidgetIds.has(id));
}

function getDefaultFilters(role: DashboardRole): OperationalDashboardFiltersState {
  return {
    periodMinutes: role === "SUPER_ADMIN" ? 60 : 30,
    tenantId: "",
    severity: "all",
  };
}

function formatPercent(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  return `${numeric.toFixed(2)}%`;
}

function formatTimeOfDay(value: unknown): string {
  if (!value) {
    return "--";
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatVersionBuildLabel(metric: DashboardMetric | null | undefined): string {
  if (metric?.buildDate) {
    return `Build ${formatDateTime(metric.buildDate)}`;
  }

  const source = String(metric?.source || "").trim().toLowerCase();
  if (source === "file" || source === "env") {
    return "Build local/dev";
  }

  if (source === "unknown") {
    return "Build sem metadata";
  }

  return "Build --";
}

function normalizeTrendSeries(value: unknown): TrendPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      const at = String(row.at || row.timestamp || "").trim();
      const numericValue = Number(row.value);
      const sampleSize = Number(row.sampleSize);

      return {
        at,
        label: formatTimeOfDay(at),
        value: Number.isFinite(numericValue) ? numericValue : null,
        sampleSize: Number.isFinite(sampleSize) ? sampleSize : undefined,
      };
    })
    .filter((point) => point.at.length > 0);
}

function hasTrendData(points: TrendPoint[]): boolean {
  return points.filter((point) => Number.isFinite(point.value)).length >= 2;
}

function metricStatusLabel(metric: DashboardMetric | null | undefined): string {
  const status = String(metric?.status || "").toLowerCase();
  if (!status) {
    return "Sem dados";
  }
  if (status === "ok") {
    return "OK";
  }
  if (status === "healthy") {
    return "Saudavel";
  }
  if (status === "error") {
    return "Indisponivel";
  }
  if (status === "degraded") {
    return "Degradado";
  }
  if (status === "down") {
    return "Indisponivel";
  }
  if (status === "unavailable") {
    return "Indisponivel";
  }
  if (status === "restricted") {
    return "Restrito";
  }
  if (status === "not_configured") {
    return "Nao configurado";
  }
  return status;
}

function toMetric(value: unknown): DashboardMetric | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as DashboardMetric;
}

function operationalWidgetTone(
  metric: DashboardMetric | null | undefined,
): "neutral" | "warn" | "danger" | "modern" {
  const tone = statusTone(metric?.status);
  if (tone === "warn" || tone === "danger" || tone === "neutral") {
    return tone;
  }
  return "modern";
}

function metricStateAccentClassName(tone: "neutral" | "warn" | "danger"): string {
  if (tone === "warn") {
    return "bg-skin-warning";
  }
  if (tone === "danger") {
    return "bg-skin-danger";
  }
  return "bg-skin-text-muted";
}

function buildAuditEventLine(row: Record<string, unknown>): string {
  const actionLabel = String(row.actionLabel || row.message || row.action || "").trim() || "--";
  const message = String(row.message || "").trim();

  if (!message || message === actionLabel) {
    return actionLabel;
  }

  return `${actionLabel} - ${message}`;
}

function normalizeRouteTelemetryItems(value: unknown): RouteTelemetryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      const avgMs = Number(row.avgMs);
      const p95Ms = Number(row.p95Ms);
      const errorRate = Number(row.errorRate);

      return {
        method: String(row.method || "GET").trim().toUpperCase(),
        route: String(row.route || "--").trim() || "--",
        requestCount: Number(row.requestCount || 0),
        avgMs: Number.isFinite(avgMs) ? avgMs : null,
        p95Ms: Number.isFinite(p95Ms) ? p95Ms : null,
        errorCount: Number(row.errorCount || 0),
        errorRate: Number.isFinite(errorRate) ? errorRate : 0,
        status5xx: Number(row.status5xx || 0),
        lastErrorAt: row.lastErrorAt ? String(row.lastErrorAt) : null,
      };
    });
}

function normalizeSecurityIpTelemetryItems(value: unknown): SecurityIpTelemetryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        ip: String(row.ip || "--"),
        count: Number(row.count || 0),
        lastSeenAt: String(row.lastSeenAt || row.lastAt || ""),
        route: row.route ? String(row.route) : null,
      };
    });
}

function normalizeSecurityRecentTelemetryItems(value: unknown): SecurityRecentTelemetryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        type: String(row.type || "").trim(),
        statusCode: Number(row.statusCode || 0),
        method: String(row.method || "GET").trim().toUpperCase(),
        route: String(row.route || "--").trim() || "--",
        ip: String(row.ip || "--"),
        at: String(row.at || row.createdAt || ""),
      };
    });
}

function formatSecurityEventType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === "rate_limited") {
    return "Limite de requisicoes";
  }
  if (normalized === "maintenance_bypass_attempt") {
    return "Tentativa de bypass";
  }
  if (normalized === "forbidden") {
    return "Acesso negado";
  }
  if (normalized === "unauthorized") {
    return "Nao autenticado";
  }
  if (normalized === "maintenance_blocked") {
    return "Manutencao bloqueada";
  }
  return normalized || "Seguranca";
}

function formatSnapshotAgeLabel(timestamp: number): string {
  const ageMs = Math.max(0, Date.now() - timestamp);
  const ageSeconds = Math.floor(ageMs / 1000);
  if (ageSeconds < 60) {
    return `${ageSeconds}s`;
  }

  const ageMinutes = Math.floor(ageSeconds / 60);
  return `${ageMinutes}min`;
}

function DashboardResponsiveChart({
  children,
  className,
  minHeight,
  fallback = null,
}: {
  children: ReactNode;
  className?: string;
  minHeight?: number | string;
  fallback?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      setSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isReady = size.width > 0 && size.height > 0;
  const style =
    minHeight === undefined
      ? undefined
      : {
          minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        };

  return (
    <div ref={containerRef} className={className} style={style}>
      {isReady ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : (
        fallback
      )}
    </div>
  );
}

function MiniTrendSparkline({
  config,
  className = "mt-3 h-14",
}: {
  config: SparklineConfig;
  className?: string;
}) {
  if (!hasTrendData(config.data)) {
    return (
      <div className={`flex items-center text-[10px] text-skin-text-muted/80 ${className}`}>
        {config.emptyLabel || "Sem historico recente"}
      </div>
    );
  }

  return (
    <DashboardResponsiveChart
      className={className}
      minHeight={56}
      fallback={
        <div className="flex h-full items-center text-[10px] text-skin-text-muted/80">
          {config.emptyLabel || "Sem historico recente"}
        </div>
      }
    >
        <AreaChart data={config.data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={config.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={config.fillColor} stopOpacity={0.7} />
              <stop offset="95%" stopColor={config.fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={config.strokeColor}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${config.id})`}
            connectNulls
            isAnimationActive={false}
          />
          <RechartsTooltip
            cursor={false}
            labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label || "")}
            formatter={(value: number) => {
              const numeric = Number(value);
              return Number.isFinite(numeric)
                ? `${numeric.toFixed(0)}${config.valueSuffix || ""}`
                : "--";
            }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "rgba(2,6,23,0.96)",
              color: "#e2e8f0",
              fontSize: 11,
            }}
          />
        </AreaChart>
    </DashboardResponsiveChart>
  );
}

function DashboardCollectionState({
  title,
  description,
  minHeight = "min-h-[320px]",
}: {
  title: string;
  description: string;
  minHeight?: string;
}) {
  return (
    <div className={`flex ${minHeight} items-center justify-center rounded-[28px] border border-dashed border-skin-border bg-skin-background-elevated/50/85 p-4 dark:border-skin-border dark:bg-background/30`}>
      <DashboardSurfaceState
        title={title}
        description={description}
        centered
        className="max-w-sm border-skin-border/90 bg-skin-surface/80 dark:border-skin-border/80 dark:bg-background/50"
      />
    </div>
  );
}

function DashboardChartState({
  title = "Sem dados",
  description = "Sem leitura consolidada neste ciclo.",
  dark = false,
}: {
  title?: string;
  description?: string;
  dark?: boolean;
}) {
  return (
    <DashboardSurfaceState
      title={title}
      description={description}
      centered
      className={dark
        ? "h-full border-skin-border/20 bg-skin-surface/5 text-skin-text"
        : "h-full border-dashed border-skin-border/80 bg-skin-background-elevated/50/70 dark:border-skin-border/80 dark:bg-background/35"}
    />
  );
}

function DashboardOverviewSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
      <section className="overflow-hidden rounded-[32px] border border-skin-border bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(150deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] px-5 py-5 text-skin-text shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_220px]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="h-7 w-24 animate-pulse rounded-full bg-skin-surface/10" />
              <div className="h-7 w-28 animate-pulse rounded-full bg-skin-surface/10" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`overview-stat-skeleton-${index}`} className="rounded-[20px] border border-white/10 bg-skin-surface/6 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-2.5 w-20 animate-pulse rounded-full bg-skin-surface/15" />
                      <div className="h-8 w-24 animate-pulse rounded-2xl bg-skin-surface/15" />
                      <div className="h-2.5 w-28 animate-pulse rounded-full bg-skin-surface/10" />
                    </div>
                    <div className="h-8 w-8 animate-pulse rounded-xl bg-skin-surface/10" />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`panorama-signal-skeleton-${index}`} className="rounded-[20px] border border-white/10 bg-skin-surface/5 px-3.5 py-3">
                  <div className="h-1.5 w-10 animate-pulse rounded-full bg-skin-surface/15" />
                  <div className="mt-3 h-2.5 w-24 animate-pulse rounded-full bg-skin-surface/10" />
                  <div className="mt-2 h-7 w-16 animate-pulse rounded-2xl bg-skin-surface/15" />
                  <div className="mt-2 h-2.5 w-28 animate-pulse rounded-full bg-skin-surface/10" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-skin-surface/5 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-2.5 w-28 animate-pulse rounded-full bg-skin-surface/10" />
                <div className="h-2.5 w-20 animate-pulse rounded-full bg-skin-surface/10" />
              </div>
              <div className="h-10 w-10 animate-pulse rounded-2xl bg-skin-surface/10" />
            </div>
            <div className="mt-4 flex h-32 items-center justify-center">
              <div className="h-24 w-24 animate-pulse rounded-full border-8 border-white/10 border-t-cyan-300/40" />
            </div>
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`health-skeleton-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-skin-surface/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-skin-surface/20" />
                    <div className="h-2.5 w-20 animate-pulse rounded-full bg-skin-surface/10" />
                  </div>
                  <div className="h-4 w-6 animate-pulse rounded-full bg-skin-surface/15" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-skin-border/80 bg-skin-surface/80 p-4 shadow-[0_25px_60px_-38px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-skin-border/80 dark:bg-background/45">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded-full bg-skin-border/80" />
            <div className="h-7 w-44 animate-pulse rounded-2xl bg-skin-border/80" />
          </div>
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-skin-border/80" />
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`resource-skeleton-${index}`} className="rounded-[18px] border border-skin-border/80 bg-skin-surface/75 p-2.5 shadow-sm dark:border-skin-border/80 dark:bg-background/45">
              <div className="flex items-center justify-between gap-3">
                <div className="h-2.5 w-20 animate-pulse rounded-full bg-skin-border/80" />
                <div className="h-4 w-10 animate-pulse rounded-full bg-skin-border/80" />
              </div>
              <div className="mt-3 h-2 animate-pulse rounded-full bg-skin-border" />
              <div className="mt-3 h-10 animate-pulse rounded-[16px] bg-skin-background-elevated/80 /60" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DashboardGridSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`grid-skeleton-${index}`} className={index === 5 ? "md:col-span-2 xl:col-span-1" : undefined}>
          <OperationalDashboardWidgetSkeleton compact={index > 2} />
        </div>
      ))}
    </div>
  );
}

function toVisibleLayouts(layouts: Layouts, visibleWidgetIds: Set<string>): Layouts {
  const output: Layouts = {};
  for (const [breakpoint, entries] of Object.entries(layouts)) {
    output[breakpoint] = entries.filter((entry) => visibleWidgetIds.has(String(entry.i)));
  }
  return output;
}

function normalizeHiddenWidgetIds(value: unknown, availableWidgetIds: string[]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowed = new Set(availableWidgetIds);
  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0 && allowed.has(item));
}

function cloneLayouts(layouts: Layouts): Layouts {
  const output: Layouts = {};
  for (const [breakpoint, entries] of Object.entries(layouts)) {
    output[breakpoint] = entries.map((entry) => ({ ...entry }));
  }
  return output;
}

function normalizeErrorMessage(error: unknown): string {
  const message =
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (error as Error)?.message ||
    "Erro desconhecido.";
  return String(message);
}

function hasActiveFilters(
  current: OperationalDashboardFiltersState,
  fallback: OperationalDashboardFiltersState,
): boolean {
  return (
    current.periodMinutes !== fallback.periodMinutes ||
    current.severity !== fallback.severity ||
    current.tenantId !== fallback.tenantId
  );
}

function buildLayoutComparisonSnapshot(layouts: Layouts, hiddenWidgetIds: string[]): string {
  return JSON.stringify({
    layoutJson: layouts,
    hiddenWidgetIds: [...hiddenWidgetIds].sort(),
  });
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

function ToolbarIconButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={`h-11 w-11 rounded-xl border transition-all ${active
            ? "border-primary bg-primary text-white hover:bg-primary/90 hover:text-primary-foreground"
            : "border-skin-border bg-skin-surface text-skin-text-muted hover:border-skin-border hover:bg-skin-background-elevated/50 hover:text-foreground"
            }`}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function QuickActionButton({
  label,
  description,
  onClick,
  disabled = false,
}: {
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`group flex min-w-0 flex-1 items-start justify-between gap-3 rounded-[22px] border border-skin-border/80 bg-skin-surface/80 px-4 py-3 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-skin-surface sm:min-w-[220px] ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-0.5 hover:border-skin-primary/30 hover:bg-skin-surface"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground dark:text-skin-text">{label}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-skin-text-muted dark:text-skin-text-muted/80">
          {description}
        </p>
      </div>
      <span className="hidden rounded-full border border-skin-border px-2 py-1 text-[10px] font-medium text-skin-text-muted transition-colors group-hover:border-skin-primary/30 group-hover:text-skin-info sm:inline-flex">
        Abrir
      </span>
    </button>
  );
}

function classifyMetricStatus(status: unknown): "good" | "attention" | "restricted" {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "restricted") {
    return "restricted";
  }

  if (normalized === "healthy" || normalized === "ok") {
    return "good";
  }

  return "attention";
}

function OverviewStat({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
  trend,
  actionLabel,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "danger";
  trend?: SparklineConfig;
  actionLabel?: string;
  onClick?: () => void;
}) {
  const isInteractive = Boolean(onClick);
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-skin-text-muted dark:text-skin-text-muted/80">
          {label}
        </p>
        <p className="mt-1.5 text-[1.35rem] font-semibold tracking-tight text-foreground dark:text-white">{value}</p>
        <p className="mt-1 text-[10px] text-skin-text-muted dark:text-skin-text-muted/80">{hint}</p>
        {trend ? <MiniTrendSparkline config={trend} className="mt-3 h-14" /> : null}
      </div>
      <div className="space-y-2 text-right">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-skin-border bg-skin-background-elevated/50 text-foreground">
          {icon}
        </div>
        {isInteractive ? (
          <span className="hidden text-[10px] font-medium text-skin-info sm:block">
            {actionLabel || "Abrir"}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!isInteractive) {
    return (
      <div
        className={`rounded-[20px] border px-3.5 py-3 text-left backdrop-blur-sm ${tone === "danger"
          ? "border-skin-danger/30 bg-skin-danger/10 text-foreground"
          : "border-skin-border/80 bg-skin-surface/82 text-skin-text dark:border-skin-border/20 dark:bg-skin-surface/6 dark:text-skin-text"
          }`}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[20px] border px-3.5 py-3 text-left backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-skin-primary/30 hover:bg-skin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${tone === "danger"
        ? "border-skin-danger/30 bg-skin-danger/10 text-foreground"
        : "border-skin-border/80 bg-skin-surface/82 text-skin-text dark:border-skin-border/20 dark:bg-skin-surface/6 dark:text-skin-text"
        }`}
    >
      {content}
    </button>
  );
}

function PanoramaSignal({
  label,
  value,
  hint,
  accentClassName,
  detailsTitle,
  detailsItems = [],
  actionLabel,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  accentClassName: string;
  detailsTitle?: string;
  detailsItems?: SignalDetailItem[];
  actionLabel?: string;
  onClick?: () => void;
}) {
  const hasDetails = detailsItems.length > 0;
  const isInteractive = Boolean(onClick) && !hasDetails;
  const card = (
    <div
      className={`rounded-[20px] border border-skin-border/80 bg-skin-surface/82 px-3.5 py-3 backdrop-blur-sm ${isInteractive ? "transition-all hover:-translate-y-0.5 hover:border-skin-primary/30 hover:bg-skin-surface" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`h-1.5 w-10 rounded-full ${accentClassName}`} />
        {hasDetails ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-skin-text-muted/80 dark:text-skin-text-muted" /> : null}
      </div>
      <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-skin-text-muted dark:text-skin-text-muted/80">
        {label}
      </p>
      <p className="mt-1.5 text-[1.1rem] font-semibold tracking-tight text-foreground dark:text-white">{value}</p>
      <p className="mt-1 truncate text-[10px] text-skin-text-muted dark:text-skin-text-muted/80">{hint}</p>
      {isInteractive ? (
        <p className="mt-2 text-[10px] font-medium text-skin-info">{actionLabel || "Abrir"}</p>
      ) : null}
    </div>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background "
      >
        {card}
      </button>
    );
  }

  if (!hasDetails) {
    return card;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background "
        >
          {card}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={10}
        className="w-80 rounded-[20px] border border-skin-border bg-skin-surface/95 p-3 text-foreground shadow-xl /70 dark:bg-background/95 dark:text-foreground dark:shadow-2xl"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-skin-text-muted">
            {detailsTitle || label}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground dark:text-muted-foreground/80">
            Historico recente disponivel para consulta rapida.
          </p>
        </div>
        <div className="mt-3 max-h-60 space-y-2 overflow-auto pr-1">
          {detailsItems.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="rounded-2xl border border-skin-border bg-skin-background-elevated/50/80 px-3 py-2 dark:border-white/10 dark:bg-skin-surface/5"
            >
              <p className="text-sm font-medium text-foreground dark:text-foreground">{item.label}</p>
              {item.hint ? (
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground dark:text-muted-foreground/80">{item.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ResourceMeter({
  label,
  value,
  suffix = "%",
  toneClassName,
  trend,
}: {
  label: string;
  value: number;
  suffix?: string;
  toneClassName: string;
  trend?: SparklineConfig;
}) {
  const boundedValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div className="space-y-1.5 rounded-[18px] border border-skin-border/80 bg-skin-surface/75 p-2.5 shadow-sm dark:border-skin-border/80 dark:bg-background/45">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground/80">
          {label}
        </p>
        <span className="text-[13px] font-semibold text-foreground dark:text-foreground">
          {Number.isFinite(value) ? `${Math.round(value)}${suffix}` : "--"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-skin-border">
        <div
          className={`h-2 rounded-full transition-[width] duration-300 ${toneClassName}`}
          style={{ width: `${boundedValue}%` }}
        />
      </div>
      {trend ? <MiniTrendSparkline config={trend} className="h-11" /> : null}
    </div>
  );
}

function HealthBucketLegendRow({
  label,
  value,
  color,
  items,
}: {
  label: string;
  value: number;
  color: string;
  items: HealthBucketItem[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const hasItems = items.length > 0;

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 120);
  }, [clearCloseTimeout]);

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
        <span className="truncate text-[11px] font-medium text-skin-text-muted">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-base font-semibold tracking-tight text-foreground dark:text-white">
          {value}
        </p>
        {hasItems ? (
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground/80 transition-transform ${open ? "rotate-180" : ""}`}
          />
        ) : null}
      </div>
    </>
  );

  if (!hasItems) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-skin-border/80 bg-skin-surface/82 px-3 py-2 dark:border-white/10 dark:bg-skin-surface/5">
        {content}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-skin-border/80 bg-skin-surface/82 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-skin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-skin-surface/5 dark:hover:border-white/20 dark:hover:bg-skin-surface/10 "
          onClick={() => {
            clearCloseTimeout();
            setOpen((current) => !current);
          }}
          onMouseEnter={() => {
            clearCloseTimeout();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          aria-expanded={open}
          aria-label={`${label}: ${value} widgets`}
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={10}
        className="w-72 rounded-[20px] border border-skin-border bg-skin-surface/95 p-3 text-foreground shadow-xl /70 dark:bg-background/95 dark:text-foreground dark:shadow-2xl"
        onMouseEnter={clearCloseTimeout}
        onMouseLeave={scheduleClose}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-skin-text-muted">
              {label}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground dark:text-muted-foreground/80">
              {value} widgets identificados neste grupo
            </p>
          </div>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
        </div>
        <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-skin-border bg-skin-background-elevated/50/80 px-3 py-2 dark:border-white/10 dark:bg-skin-surface/5"
            >
              <span className="min-w-0 truncate text-sm text-foreground dark:text-foreground">
                {item.label}
              </span>
              <span className="shrink-0 rounded-full border border-skin-border bg-skin-surface px-2 py-0.5 text-[10px] font-medium text-skin-text-muted">
                {item.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type OperationalDashboardProps = {
  embedded?: boolean;
  storedFilters?: Partial<OperationalDashboardFiltersState> | null;
  onFiltersChange?: (filters: OperationalDashboardFiltersState) => void | Promise<void>;
};

function normalizeStoredFiltersInput(
  role: DashboardRole,
  storedFilters?: Partial<OperationalDashboardFiltersState> | null,
): OperationalDashboardFiltersState {
  const fallback = getDefaultFilters(role);
  const periodMinutes = Number(storedFilters?.periodMinutes);

  return {
    periodMinutes:
      Number.isFinite(periodMinutes) && periodMinutes >= 5
        ? Math.floor(periodMinutes)
        : fallback.periodMinutes,
    tenantId: role === "SUPER_ADMIN" ? String(storedFilters?.tenantId || "") : "",
    severity:
      storedFilters?.severity === "info" ||
      storedFilters?.severity === "warning" ||
      storedFilters?.severity === "critical"
        ? storedFilters.severity
        : "all",
  };
}

export function OperationalDashboard({
  embedded = false,
  storedFilters = null,
  onFiltersChange,
}: OperationalDashboardProps = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { openDrawer, isEnabled: notificationsEnabled } = useSystemNotificationsContext();
  const { toast } = useToast();
  const role = (user?.role || "USER") as DashboardRole;
  const isOperationalAllowed = role === "SUPER_ADMIN";
  const defaultFilters = useMemo(() => getDefaultFilters(role), [role]);
  const externalFilters = useMemo(
    () => normalizeStoredFiltersInput(role, storedFilters),
    [role, storedFilters],
  );
  const roleWidgetIds = useMemo(() => allowedWidgetIdsByRole(role), [role]);
  const defaultGridWidgetIds = useMemo(
    () => filterStandaloneWidgetIds(roleWidgetIds),
    [roleWidgetIds],
  );

  const [appliedFilters, setAppliedFilters] = useState<OperationalDashboardFiltersState>(
    embedded ? externalFilters : defaultFilters,
  );
  const [draftFilters, setDraftFilters] = useState<OperationalDashboardFiltersState>(
    embedded ? externalFilters : defaultFilters,
  );
  const [layouts, setLayouts] = useState<Layouts>(() =>
    normalizeLayoutForWidgets({}, defaultGridWidgetIds),
  );
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<string[]>([]);
  const [editingLayouts, setEditingLayouts] = useState<Layouts>(() =>
    normalizeLayoutForWidgets({}, defaultGridWidgetIds),
  );
  const [editingHiddenWidgetIds, setEditingHiddenWidgetIds] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<SystemDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLayoutUpdateAt, setLastLayoutUpdateAt] = useState<string | null>(null);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<DashboardQuickFilter>("all");
  const [contractDegradationMessage, setContractDegradationMessage] = useState<string | null>(null);
  const [staleSnapshotAt, setStaleSnapshotAt] = useState<number | null>(null);
  const lastSuccessfulDashboardRef = useRef<{
    key: string;
    capturedAt: number;
    payload: SystemDashboardResponse | null;
  } | null>(null);

  const { width, mounted, containerRef } = useContainerWidth({ initialWidth: 1280 });
  const isMobileViewport = isDashboardMobileViewport(width);
  const canEditLayout = !embedded && !isMobileViewport;
  const layoutEditingActive = canEditLayout && isLayoutEditing;
  const showInitialSkeleton = !mounted || (loading && !dashboard);

  const availableWidgetIds = useMemo(() => {
    const fromApi = Array.isArray(dashboard?.widgets?.available)
      ? dashboard.widgets.available
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0)
      : [];

    if (fromApi.length > 0) {
      return fromApi;
    }

    return roleWidgetIds;
  }, [dashboard?.widgets?.available, roleWidgetIds]);

  const standaloneWidgetIds = useMemo(
    () => filterStandaloneWidgetIds(availableWidgetIds),
    [availableWidgetIds],
  );
  const availableWidgetIdsKey = useMemo(() => standaloneWidgetIds.join("|"), [standaloneWidgetIds]);
  const stableAvailableWidgetIds = useMemo(
    () => (availableWidgetIdsKey ? availableWidgetIdsKey.split("|") : []),
    [availableWidgetIdsKey],
  );

  const activeHiddenWidgetIds = layoutEditingActive ? editingHiddenWidgetIds : hiddenWidgetIds;
  const activeLayouts = layoutEditingActive ? editingLayouts : layouts;

  const hasDraftFilterChanges = useMemo(
    () =>
      appliedFilters.periodMinutes !== draftFilters.periodMinutes ||
      appliedFilters.severity !== draftFilters.severity ||
      appliedFilters.tenantId !== draftFilters.tenantId,
    [appliedFilters, draftFilters],
  );

  const hasAppliedActiveFilters = useMemo(
    () => hasActiveFilters(appliedFilters, defaultFilters),
    [appliedFilters, defaultFilters],
  );
  const snapshotKey = useMemo(
    () =>
      JSON.stringify({
        periodMinutes: appliedFilters.periodMinutes,
        tenantId: appliedFilters.tenantId,
        severity: appliedFilters.severity,
      }),
    [appliedFilters.periodMinutes, appliedFilters.severity, appliedFilters.tenantId],
  );
  const staleSnapshotActive = staleSnapshotAt !== null;
  const runtimeMitigation = dashboard?.runtimeMitigation;
  const runtimeMitigationBanner = resolveRuntimeMitigationBanner(runtimeMitigation || null);

  const hasPendingLayoutChanges = useMemo(() => {
    if (!layoutEditingActive) {
      return false;
    }

    return (
      buildLayoutComparisonSnapshot(editingLayouts, editingHiddenWidgetIds) !==
      buildLayoutComparisonSnapshot(layouts, hiddenWidgetIds)
    );
  }, [editingHiddenWidgetIds, editingLayouts, hiddenWidgetIds, layoutEditingActive, layouts]);

  const refreshDashboard = useCallback(
    async (silent = false) => {
      if (!isOperationalAllowed) {
        lastSuccessfulDashboardRef.current = null;
        setContractDegradationMessage(null);
        setStaleSnapshotAt(null);
        setDashboard(null);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setContractDegradationMessage(null);

      try {
        const response = await executeContractRequestWithRetry(
          () =>
            getSystemDashboard({
              periodMinutes: appliedFilters.periodMinutes,
              tenantId: appliedFilters.tenantId || undefined,
              severity: appliedFilters.severity,
            }),
          {
            attempts: 2,
            baseDelayMs: 300,
            maxDelayMs: 1_200,
            context: "/system/dashboard",
            shouldRetry: (requestError) => isTransientRequestError(requestError),
          },
        );

        lastSuccessfulDashboardRef.current = {
          key: snapshotKey,
          capturedAt: Date.now(),
          payload: response || null,
        };
        setStaleSnapshotAt(null);
        setDashboard(response || {});
        setError(null);
      } catch (requestError: unknown) {
        const snapshot = lastSuccessfulDashboardRef.current;
        const canReuseSnapshot =
          snapshot?.payload &&
          snapshot.key === snapshotKey &&
          Date.now() - snapshot.capturedAt <= DASHBOARD_SNAPSHOT_TTL_MS;

        if (
          canReuseSnapshot &&
          (isContractValidationError(requestError, "response") || isTransientRequestError(requestError))
        ) {
          setDashboard(snapshot.payload);
          setStaleSnapshotAt(snapshot.capturedAt);
          setError(
            isContractValidationError(requestError, "response")
              ? "Resposta do dashboard fora do contrato. Mantendo o ultimo snapshot valido enquanto a integracao e saneada."
              : "Falha transitoria ao atualizar o dashboard. Mantendo o ultimo snapshot valido.",
          );
        } else {
          if (snapshot && Date.now() - snapshot.capturedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
            lastSuccessfulDashboardRef.current = null;
          }
          setStaleSnapshotAt(null);
          setError(
            (requestError as { response?: { data?: { message?: string } } })?.response?.data
              ?.message ||
              (requestError as Error)?.message ||
              "Falha ao carregar dashboard operacional.",
          );
        }
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [
      appliedFilters.periodMinutes,
      appliedFilters.severity,
      appliedFilters.tenantId,
      isOperationalAllowed,
      snapshotKey,
    ],
  );

  useEffect(() => {
    const handleContractDegradation = (event: Event) => {
      const detail = (event as CustomEvent<ContractVersionDowngradeDetail>).detail;
      if (!detail || !detail.context.startsWith("/system/dashboard")) {
        return;
      }

      setContractDegradationMessage(
        `API respondeu com contrato legado v${detail.parsedVersion} para ${detail.context}. O painel entrou em modo degradado visivel.`,
      );
    };

    window.addEventListener(CONTRACT_DEGRADATION_EVENT_NAME, handleContractDegradation as EventListener);
    return () => {
      window.removeEventListener(
        CONTRACT_DEGRADATION_EVENT_NAME,
        handleContractDegradation as EventListener,
      );
    };
  }, []);

  const persistDashboardPreferences = useCallback(
    async (
      nextLayouts: Layouts,
      nextFilters: OperationalDashboardFiltersState,
      nextHiddenWidgetIds: string[],
    ): Promise<boolean> => {
      setSavingLayout(true);

      try {
        const response = await saveSystemDashboardLayout({
          layoutJson: nextLayouts,
          filtersJson: {
            ...nextFilters,
            tenantId: nextFilters.tenantId || null,
            hiddenWidgetIds: normalizeHiddenWidgetIds(
              nextHiddenWidgetIds,
              stableAvailableWidgetIds,
            ),
          },
        });

        setLastLayoutUpdateAt(response.updatedAt || new Date().toISOString());
        setError(null);
        return true;
      } catch (requestError) {
        const message = normalizeErrorMessage(requestError);
        setError(`Falha ao salvar configuracao do dashboard: ${message}`);
        toast({
          title: "Falha ao salvar",
          description: message,
          variant: "destructive",
        });
        return false;
      } finally {
        setSavingLayout(false);
      }
    },
    [stableAvailableWidgetIds, toast],
  );

  const loadLayout = useCallback(async () => {
    if (!isOperationalAllowed) {
      return;
    }

    if (embedded) {
      const fallbackLayouts = normalizeLayoutForWidgets({}, defaultGridWidgetIds);
      setLayouts(fallbackLayouts);
      setEditingLayouts(cloneLayouts(fallbackLayouts));
      setHiddenWidgetIds([]);
      setEditingHiddenWidgetIds([]);
      setAppliedFilters(externalFilters);
      setDraftFilters(externalFilters);
      setLastLayoutUpdateAt(null);
      setIsLayoutEditing(false);
      return;
    }

    try {
      const payload: DashboardLayoutResponse = await getSystemDashboardLayout();
      const baseLayouts =
        payload.resolution?.source === "role_default"
          ? normalizeLayoutForWidgets({}, defaultGridWidgetIds)
          : normalizeLayoutForWidgets(payload.layoutJson, defaultGridWidgetIds);
      const filtersPayload = payload.filtersJson || {};
      const nextFilters: OperationalDashboardFiltersState = {
        periodMinutes:
          Number.isFinite(Number(filtersPayload.periodMinutes)) &&
            Number(filtersPayload.periodMinutes) > 0
            ? Number(filtersPayload.periodMinutes)
            : defaultFilters.periodMinutes,
        tenantId: String(filtersPayload.tenantId || defaultFilters.tenantId || ""),
        severity:
          filtersPayload.severity === "info" ||
            filtersPayload.severity === "warning" ||
            filtersPayload.severity === "critical"
            ? filtersPayload.severity
            : "all",
      };
      const baseHidden = normalizeHiddenWidgetIds(
        filtersPayload.hiddenWidgetIds,
        defaultGridWidgetIds,
      );

      setLayouts(baseLayouts);
      setEditingLayouts(cloneLayouts(baseLayouts));
      setHiddenWidgetIds(baseHidden);
      setEditingHiddenWidgetIds(baseHidden);
      setAppliedFilters(nextFilters);
      setDraftFilters(nextFilters);
      setLastLayoutUpdateAt(payload.updatedAt || null);
      setIsLayoutEditing(false);
    } catch {
      const fallbackLayouts = normalizeLayoutForWidgets({}, defaultGridWidgetIds);
      setLayouts(fallbackLayouts);
      setEditingLayouts(cloneLayouts(fallbackLayouts));
      setHiddenWidgetIds([]);
      setEditingHiddenWidgetIds([]);
      setAppliedFilters(defaultFilters);
      setDraftFilters(defaultFilters);
      setIsLayoutEditing(false);
    }
  }, [defaultFilters, defaultGridWidgetIds, embedded, externalFilters, isOperationalAllowed]);

  useEffect(() => {
    const fallbackLayouts = normalizeLayoutForWidgets({}, defaultGridWidgetIds);
    setLayouts(fallbackLayouts);
    setEditingLayouts(cloneLayouts(fallbackLayouts));
    setHiddenWidgetIds([]);
    setEditingHiddenWidgetIds([]);
    setAppliedFilters(embedded ? externalFilters : defaultFilters);
    setDraftFilters(embedded ? externalFilters : defaultFilters);
    setIsLayoutEditing(false);
    setLastLayoutUpdateAt(null);
    void loadLayout();
  }, [defaultFilters, defaultGridWidgetIds, embedded, externalFilters, loadLayout]);

  useEffect(() => {
    if (!embedded) {
      return;
    }

    setAppliedFilters(externalFilters);
    setDraftFilters(externalFilters);
  }, [embedded, externalFilters]);

  useEffect(() => {
    if (!isOperationalAllowed) {
      return;
    }

    void refreshDashboard();
    const interval = setInterval(() => {
      void refreshDashboard(true);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isOperationalAllowed, refreshDashboard]);

  useEffect(() => {
    if (!staleSnapshotActive || !isOperationalAllowed || loading || refreshing) {
      return;
    }

    const retryTimeout = window.setTimeout(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      void refreshDashboard(true);
    }, STALE_SNAPSHOT_RETRY_MS);

    const handleOnline = () => {
      void refreshDashboard(true);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        return;
      }
      void refreshDashboard(true);
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(retryTimeout);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    isOperationalAllowed,
    loading,
    refreshDashboard,
    refreshing,
    staleSnapshotActive,
  ]);

  useEffect(() => {
    if (!isMobileViewport || !isLayoutEditing) {
      return;
    }

    setEditingLayouts(cloneLayouts(layouts));
    setEditingHiddenWidgetIds([...hiddenWidgetIds]);
    setIsLayoutEditing(false);
  }, [hiddenWidgetIds, isLayoutEditing, isMobileViewport, layouts]);

  useEffect(() => {
    setLayouts((current: Layouts) => {
      const normalized = normalizeLayoutForWidgets(current, stableAvailableWidgetIds);
      return JSON.stringify(current) === JSON.stringify(normalized) ? current : normalized;
    });

    setEditingLayouts((current: Layouts) => {
      const normalized = normalizeLayoutForWidgets(current, stableAvailableWidgetIds);
      return JSON.stringify(current) === JSON.stringify(normalized) ? current : normalized;
    });

    setHiddenWidgetIds((current) => {
      const normalized = normalizeHiddenWidgetIds(current, stableAvailableWidgetIds);
      return sameStringArray(current, normalized) ? current : normalized;
    });

    setEditingHiddenWidgetIds((current) => {
      const normalized = normalizeHiddenWidgetIds(current, stableAvailableWidgetIds);
      return sameStringArray(current, normalized) ? current : normalized;
    });
  }, [stableAvailableWidgetIds]);

  const applyFilters = useCallback(async () => {
    const nextFilters: OperationalDashboardFiltersState = {
      periodMinutes: draftFilters.periodMinutes,
      severity: draftFilters.severity,
      tenantId: role === "SUPER_ADMIN" ? draftFilters.tenantId : "",
    };

    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
    if (embedded) {
      await onFiltersChange?.(nextFilters);
      return;
    }

    await persistDashboardPreferences(layouts, nextFilters, hiddenWidgetIds);
  }, [draftFilters, embedded, hiddenWidgetIds, layouts, onFiltersChange, persistDashboardPreferences, role]);

  const restoreFilterDefaults = useCallback(() => {
    setDraftFilters(defaultFilters);
  }, [defaultFilters]);

  const beginLayoutEditing = useCallback(() => {
    if (!canEditLayout || staleSnapshotActive) {
      return;
    }

    setEditingLayouts(cloneLayouts(layouts));
    setEditingHiddenWidgetIds([...hiddenWidgetIds]);
    setIsLayoutEditing(true);
  }, [canEditLayout, hiddenWidgetIds, layouts, staleSnapshotActive]);

  const cancelLayoutEditing = useCallback(() => {
    setEditingLayouts(cloneLayouts(layouts));
    setEditingHiddenWidgetIds([...hiddenWidgetIds]);
    setIsLayoutEditing(false);
  }, [hiddenWidgetIds, layouts]);

  const resetLayoutEditing = useCallback(() => {
    const fallbackLayouts = normalizeLayoutForWidgets({}, defaultGridWidgetIds);
    setEditingLayouts(cloneLayouts(fallbackLayouts));
    setEditingHiddenWidgetIds([]);
  }, [defaultGridWidgetIds]);

  const saveLayoutEditing = useCallback(async () => {
    if (staleSnapshotActive) {
      toast({
        title: "Atualizacao obrigatoria",
        description: "Atualize o dashboard antes de salvar alteracoes com snapshot desatualizado.",
        variant: "destructive",
      });
      return;
    }

    const nextLayouts = cloneLayouts(editingLayouts);
    const nextHidden = normalizeHiddenWidgetIds(editingHiddenWidgetIds, stableAvailableWidgetIds);
    const saved = await persistDashboardPreferences(nextLayouts, appliedFilters, nextHidden);

    if (!saved) {
      return;
    }

    setLayouts(nextLayouts);
    setHiddenWidgetIds(nextHidden);
    setEditingLayouts(cloneLayouts(nextLayouts));
    setEditingHiddenWidgetIds(nextHidden);
    setIsLayoutEditing(false);
    toast({
      title: "Layout salvo",
      description: "A organizacao do dashboard foi atualizada.",
    });
  }, [
    appliedFilters,
    editingHiddenWidgetIds,
    editingLayouts,
    persistDashboardPreferences,
    staleSnapshotActive,
    stableAvailableWidgetIds,
    toast,
  ]);

  const toggleWidgetVisibilityInEditor = useCallback((id: string) => {
    setEditingHiddenWidgetIds((previous) => {
      if (previous.includes(id)) {
        return previous.filter((item) => item !== id);
      }

      return [...previous, id];
    });
  }, []);

  const executeDashboardIntent = useCallback((intent: DashboardNavigationIntent | null) => {
    if (!intent) {
      return;
    }

    if (intent.type === "notifications-drawer") {
      openDrawer();
      return;
    }

    router.push(intent.href);
  }, [openDrawer, router]);

  const getWidgetIntent = useCallback((widgetId: string) => {
    return getDashboardWidgetIntent(widgetId, role, notificationsEnabled);
  }, [notificationsEnabled, role]);

  const visibleWidgetIds = useMemo(() => {
    const hiddenSet = new Set(activeHiddenWidgetIds);
    return stableAvailableWidgetIds.filter((id) => !hiddenSet.has(id));
  }, [activeHiddenWidgetIds, stableAvailableWidgetIds]);

  const dashboardMetrics = useMemo(() => {
    const metrics: Record<string, DashboardMetric | null> = {};

    for (const widgetId of availableWidgetIds) {
      metrics[widgetId] = toMetric(dashboard?.[widgetId]);
    }

    return metrics;
  }, [availableWidgetIds, dashboard]);

  const gridWidgetIds = useMemo(() => {
    return filterDashboardWidgetIds(visibleWidgetIds, activeQuickFilter, dashboardMetrics);
  }, [activeQuickFilter, dashboardMetrics, visibleWidgetIds]);

  const gridWidgetSet = useMemo(() => new Set(gridWidgetIds), [gridWidgetIds]);
  const layoutsForRender = useMemo(
    () => toVisibleLayouts(activeLayouts, gridWidgetSet),
    [activeLayouts, gridWidgetSet],
  );
  const quickActions = useMemo(
    () => getDashboardQuickActions(role, notificationsEnabled),
    [notificationsEnabled, role],
  );
  const dashboardOverview = useMemo(() => {
    const counts = {
      good: 0,
      attention: 0,
      restricted: 0,
    };
    const healthDetails: Record<HealthBucketKey, HealthBucketItem[]> = {
      good: [],
      attention: [],
      restricted: [],
    };

    for (const widgetId of availableWidgetIds) {
      const metric = toMetric(dashboard?.[widgetId]);
      const bucket = classifyMetricStatus(metric?.status);
      counts[bucket] += 1;
      healthDetails[bucket].push({
        id: widgetId,
        label: widgetLabelById[widgetId] || widgetId,
        statusLabel: metricStatusLabel(metric),
      });
    }

    const apiMetric = toMetric(dashboard?.api);
    const notificationsMetric = toMetric(dashboard?.notifications);
    const securityMetric = toMetric(dashboard?.security);
    const cpuMetric = toMetric(dashboard?.cpu);
    const memoryMetric = toMetric(dashboard?.memory);
    const diskMetric = toMetric(dashboard?.disk);
    const maintenanceMetric = toMetric(dashboard?.maintenance);
    const jobsMetric = toMetric(dashboard?.jobs);
    const tenantsMetric = toMetric(dashboard?.tenants);
    const apiHistory = normalizeTrendSeries(apiMetric?.history);
    const memoryHistory = normalizeTrendSeries(memoryMetric?.history);
    const recentJobFailures = Array.isArray(jobsMetric?.recentFailures) ? jobsMetric.recentFailures : [];
    const securityMetricState = resolveDashboardMetricState(securityMetric);
    const maintenanceMetricState = resolveDashboardMetricState(maintenanceMetric);
    const jobsMetricState = resolveDashboardMetricState(jobsMetric);
    const tenantsMetricState = resolveDashboardMetricState(tenantsMetric);
    const deniedRows = Array.isArray(securityMetric?.deniedAccess) ? securityMetric.deniedAccess : [];
    const blockedAttempts = deniedRows.reduce((total, item) => {
      const row = item as Record<string, unknown>;
      return total + Number(row.count || 0);
    }, 0);
    const apiWindowSeconds = Number(apiMetric?.windowSeconds);
    const apiWindowMinutes = Number.isFinite(apiWindowSeconds) && apiWindowSeconds > 0
      ? Math.max(1, Math.round(apiWindowSeconds / 60))
      : 5;

    return {
      statusChart: [
        { name: "Saudavel", value: counts.good, color: "#22c55e" },
        { name: "Atencao", value: counts.attention, color: "#f59e0b" },
        { name: "Restrito", value: counts.restricted, color: "#64748b" },
      ].filter((item) => item.value > 0),
      counts,
      healthDetails,
      avgLatency:
        apiMetric?.avgResponseTimeMs !== null && apiMetric?.avgResponseTimeMs !== undefined
          ? `${apiMetric.avgResponseTimeMs}ms`
          : "--",
      apiLatencyHint: `Media atual (${apiWindowMinutes} min)`,
      apiLatencyTrend: apiHistory.length > 0
        ? {
          id: "overview-api-latency-history",
          data: apiHistory,
          strokeColor: "#38bdf8",
          fillColor: "rgba(56,189,248,0.24)",
          valueSuffix: "ms",
          emptyLabel: "Sem historico recente de latencia",
        }
        : undefined,
      unreadNotifications: String(notificationsMetric?.criticalUnread ?? "--"),
      blockedAttempts: securityMetricState ? "--" : String(blockedAttempts),
      visibleWidgets: visibleWidgetIds.length,
      overviewStats: [
        {
          widgetId: "api",
          icon: <Activity className="h-4 w-4" />,
          label: "Latencia media",
          value:
            apiMetric?.avgResponseTimeMs !== null && apiMetric?.avgResponseTimeMs !== undefined
              ? `${apiMetric.avgResponseTimeMs}ms`
              : "--",
          hint: `Media atual (${apiWindowMinutes} min)`,
          trend: apiHistory.length > 0
            ? {
              id: "overview-api-latency-history",
              data: apiHistory,
              strokeColor: "#38bdf8",
              fillColor: "rgba(56,189,248,0.24)",
              valueSuffix: "ms",
              emptyLabel: "Sem historico recente de latencia",
            }
            : undefined,
        },
        {
          widgetId: "notifications",
          icon: <BellDot className="h-4 w-4" />,
          label: "Notificacoes",
          value: String(notificationsMetric?.criticalUnread ?? "--"),
          hint: "Notificacoes nao lidas",
        },
        {
          widgetId: "security",
          icon: <ShieldAlert className="h-4 w-4" />,
          label: "Acessos bloqueados",
          value: securityMetricState ? "--" : String(blockedAttempts),
          hint: "Top IPs no periodo",
          tone: "danger" as const,
        },
      ] satisfies OverviewStatItem[],
      memoryTrend: memoryHistory.length > 0
        ? {
          id: "server-memory-history",
          data: memoryHistory,
          strokeColor: "#22c55e",
          fillColor: "rgba(34,197,94,0.24)",
          valueSuffix: "%",
          emptyLabel: "Sem historico curto de memoria",
        }
        : undefined,
      panoramaSignals: [
        maintenanceMetricState
          ? {
            widgetId: "maintenance",
            label: "Manutencao",
            value: maintenanceMetricState.title,
            hint: maintenanceMetricState.description,
            accentClassName: metricStateAccentClassName(maintenanceMetricState.tone),
          }
          : {
            label: "Manutencao",
            widgetId: "maintenance",
            value: maintenanceMetric?.enabled ? "Ativa" : "Estavel",
            hint: maintenanceMetric?.enabled
              ? String(maintenanceMetric?.reason || "Janela operacional")
              : "Sem janela ativa",
            accentClassName: maintenanceMetric?.enabled ? "bg-skin-warning" : "bg-skin-success",
          },
        jobsMetricState
          ? {
            widgetId: "jobs",
            label: "Jobs na fila",
            value: jobsMetricState.title,
            hint: jobsMetricState.description,
            accentClassName: metricStateAccentClassName(jobsMetricState.tone),
          }
          : {
            widgetId: "jobs",
            label: "Jobs na fila",
            value: String(jobsMetric?.pending ?? "--"),
            hint: `${String(jobsMetric?.running ?? "--")} em execucao`,
            accentClassName: "bg-skin-info",
            detailsTitle: "Ultimas falhas de jobs",
            detailsItems: recentJobFailures.slice(0, 5).map((item) => {
              const row = item as Record<string, unknown>;
              const finishedAt = row.finishedAt ? formatDateTime(row.finishedAt) : "--";
              const errorText = String(row.error || "").trim();

              return {
                label: String(row.type || row.id || "Falha"),
                hint: errorText ? `${finishedAt} - ${errorText}` : finishedAt,
              };
            }),
          },
        tenantsMetricState
          ? {
            widgetId: "tenants",
            label: "Empresas / Tenants",
            value: tenantsMetricState.title,
            hint: tenantsMetricState.description,
            accentClassName: metricStateAccentClassName(tenantsMetricState.tone),
          }
          : {
            widgetId: "tenants",
            label: "Empresas / Tenants",
            value: String(tenantsMetric?.active ?? "--"),
            hint: `${String(tenantsMetric?.total ?? "--")} registradas`,
            accentClassName: "bg-skin-info",
          },
      ],
      resourceUsage: [
        {
          widgetId: "cpu",
          label: "CPU",
          value: Number(cpuMetric?.usagePercent),
          toneClassName: "bg-skin-info",
        },
        { label: "Memoria", value: Number(memoryMetric?.usedPercent), toneClassName: "bg-skin-success" },
        { label: "Armazenamento", value: Number(diskMetric?.usedPercent), toneClassName: "bg-skin-warning" },
      ],
    };
  }, [availableWidgetIds, dashboard, visibleWidgetIds.length]);
  const cardsById = useMemo(() => {
    const map = new Map<string, ReactNode>();
    const hideHandler = layoutEditingActive ? toggleWidgetVisibilityInEditor : undefined;

    const versionMetric = toMetric(dashboard?.version);
    const versionIntent = getWidgetIntent("version");
    map.set(
      "version",
      <OperationalDashboardWidget
        id="version"
        title="Versao"
        subtitle={metricStatusLabel(versionMetric)}
        tone={statusTone(versionMetric?.status)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        onSelect={versionIntent ? () => executeDashboardIntent(versionIntent) : undefined}
        actionLabel={versionIntent?.label}
        compact
      >
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[1.55rem] font-semibold leading-none tracking-tight">
              {String(versionMetric?.version || "--")}
            </p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              {formatVersionBuildLabel(versionMetric)}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-skin-border px-2 py-0.5 text-[10px] font-medium text-skin-text-muted">
            {String(versionMetric?.commitSha || "--").slice(0, 7) || "--"}
          </span>
        </div>
      </OperationalDashboardWidget>,
    );

    const uptimeMetric = toMetric(dashboard?.uptime);
    map.set(
      "uptime",
      <OperationalDashboardWidget
        id="uptime"
        title="Uptime"
        subtitle={metricStatusLabel(uptimeMetric)}
        tone={statusTone(uptimeMetric?.status)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        compact
      >
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <p className="text-[1.55rem] font-semibold leading-none tracking-tight">{String(uptimeMetric?.human || "--")}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Desde {uptimeMetric?.startedAt ? formatDateTime(uptimeMetric.startedAt) : "--"}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-skin-success/30 bg-skin-success/10 px-2 py-0.5 text-[10px] font-medium text-skin-success">
            online
          </span>
        </div>
      </OperationalDashboardWidget>,
    );

    const maintenanceMetric = toMetric(dashboard?.maintenance);
    const maintenanceIntent = getWidgetIntent("maintenance");
    map.set(
      "maintenance",
      <OperationalDashboardWidget
        id="maintenance"
        title="Manutencao"
        subtitle={metricStatusLabel(maintenanceMetric)}
        tone={maintenanceMetric?.enabled ? "warn" : "modern"}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        onSelect={maintenanceIntent ? () => executeDashboardIntent(maintenanceIntent) : undefined}
        actionLabel={maintenanceIntent?.label}
        compact
      >
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`truncate text-[1.55rem] font-bold leading-none tracking-tight ${maintenanceMetric?.enabled ? "text-skin-warning" : "text-skin-success"
                }`}
            >
              {maintenanceMetric?.enabled ? "Ativo" : "Estavel"}
            </p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground/80">
              {maintenanceMetric?.enabled
                ? `Motivo: ${String(maintenanceMetric?.reason || "Nao informado")}`
                : "Sem janela ativa"}
            </p>
          </div>
          {maintenanceMetric?.enabled ? (
            <span className="shrink-0 rounded-full border border-skin-warning/30 bg-skin-warning/10 px-2 py-0.5 text-[10px] font-medium text-skin-warning">
              ETA {String(maintenanceMetric?.etaSeconds ?? "--")}s
            </span>
          ) : null}
        </div>
      </OperationalDashboardWidget>,
    );

    const apiMetric = toMetric(dashboard?.api);
    const apiHistory = normalizeTrendSeries(apiMetric?.history);
    const rawApiCategories = (apiMetric?.byCategory || {}) as Record<
      string,
      { averageMs?: number | null; sampleSize?: number }
    >;
    const apiData = Object.entries(rawApiCategories)
      .map(([key, val]) => ({
        category: key,
        latency: Number(val?.averageMs),
        sampleSize: Number(val?.sampleSize),
      }))
      .filter((item) => Number.isFinite(item.latency));

    map.set(
      "api",
      <OperationalDashboardWidget
        id="api"
        title="API Latency"
        subtitle={metricStatusLabel(apiMetric)}
        tone="modern"
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        noPadding
      >
        <div className="flex flex-col h-full">
          <div className="px-3 pt-3 flex items-end justify-between">
            <p className="text-4xl font-bold text-foreground text-skin-info">
              {apiMetric?.avgResponseTimeMs !== null && apiMetric?.avgResponseTimeMs !== undefined
                ? `${apiMetric.avgResponseTimeMs}ms`
                : "--"}
            </p>
            <p className="mb-1 text-xs text-muted-foreground dark:text-muted-foreground/80">Amostras: {String(apiMetric?.sampleSize ?? 0)}</p>
          </div>
          {apiHistory.length > 0 ? (
            <div className="px-3">
              <MiniTrendSparkline
                config={{
                  id: "widget-api-latency-history",
                  data: apiHistory,
                  strokeColor: "#38bdf8",
                  fillColor: "rgba(56,189,248,0.24)",
                  valueSuffix: "ms",
                  emptyLabel: "Sem historico recente de latencia",
                }}
                className="mt-3 h-20"
              />
            </div>
          ) : null}
          <div className="flex-1 min-h-0 w-full mt-3 pr-3 pb-2">
            {apiData.length > 0 ? (
              <DashboardResponsiveChart
                className="h-full w-full"
                minHeight={160}
                fallback={<DashboardChartState description="Sem latencia consolidada por categoria." />}
              >
                <BarChart data={apiData} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} width={70} />
                  <Bar dataKey="latency" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {apiData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.latency > 1000 ? "#ef4444" : entry.latency > 500 ? "#f59e0b" : "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </DashboardResponsiveChart>
            ) : (
              <DashboardChartState description="Sem latencia consolidada por categoria." />
            )}
          </div>
        </div>
      </OperationalDashboardWidget>,
    );

    const cpuMetric = toMetric(dashboard?.cpu);
    const rawCpuLoad = Array.isArray(cpuMetric?.loadAvg) ? (cpuMetric.loadAvg as number[]) : [];
    const cpuLoadData = rawCpuLoad.map((val, idx) => ({ time: `T-${rawCpuLoad.length - idx}`, load: val }));

    map.set(
      "cpu",
      <OperationalDashboardWidget
        id="cpu"
        title="CPU Usage"
        subtitle={metricStatusLabel(cpuMetric)}
        tone="modern"
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        noPadding
      >
        <div className="flex flex-col h-full">
          <div className="px-3 pt-3 flex items-end justify-between">
            <p className="text-4xl font-bold text-foreground text-skin-info">{formatPercent(cpuMetric?.usagePercent)}</p>
            <p className="mb-1 text-xs text-muted-foreground dark:text-muted-foreground/80">Cores: {String(cpuMetric?.cores ?? "--")}</p>
          </div>
          <div className="flex-1 min-h-0 w-full mt-2">
            {cpuLoadData.length > 0 ? (
              <DashboardResponsiveChart
                className="h-full w-full"
                minHeight={160}
                fallback={<DashboardChartState description="Sem amostra curta de carga da CPU." />}
              >
                <AreaChart data={cpuLoadData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="load"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorLoad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </DashboardResponsiveChart>
            ) : (
              <DashboardChartState description="Sem amostra curta de carga da CPU." />
            )}
          </div>
        </div>
      </OperationalDashboardWidget>,
    );

    const memoryMetric = toMetric(dashboard?.memory);
    const memUsed = Number(memoryMetric?.usedBytes) || 0;
    const memFree = Number(memoryMetric?.freeBytes) || 0;
    const memData = [
      { name: "Usado", value: memUsed, color: "#ef4444" },
      { name: "Livre", value: memFree, color: "#22c55e" },
    ];

    map.set(
      "memory",
      <OperationalDashboardWidget
        id="memory"
        title="Memoria"
        subtitle={metricStatusLabel(memoryMetric)}
        tone="modern"
        isEditing={layoutEditingActive}
        onHide={hideHandler}
      >
        <div className="flex h-full items-center">
          <div className="flex-1 space-y-1">
            <p className="text-3xl font-bold tracking-tight text-foreground dark:text-foreground">{formatPercent(memoryMetric?.usedPercent)}</p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground/80">Usado: <span className="text-skin-text">{formatBytes(memUsed)}</span></p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground/80">Total: <span className="text-skin-text">{formatBytes(memoryMetric?.totalBytes)}</span></p>
          </div>
          <div className="h-24 w-24 shrink-0">
            {memUsed > 0 ? (
              <DashboardResponsiveChart className="h-full w-full" minHeight={96}>
                <PieChart>
                  <Pie
                    data={memData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {memData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </DashboardResponsiveChart>
            ) : null}
          </div>
        </div>
      </OperationalDashboardWidget>,
    );

    const diskMetric = toMetric(dashboard?.disk);
    const diskUsed = Number(diskMetric?.usedBytes) || 0;
    const diskFree = Number(diskMetric?.freeBytes) || 0;
    const diskData = [
      { name: "Usado", value: diskUsed, color: "#3b82f6" },
      { name: "Livre", value: diskFree, color: "#334155" },
    ];

    map.set(
      "disk",
      <OperationalDashboardWidget
        id="disk"
        title="Disco"
        subtitle={metricStatusLabel(diskMetric)}
        tone="modern"
        isEditing={layoutEditingActive}
        onHide={hideHandler}
      >
        <div className="flex h-full items-center">
          <div className="flex-1 space-y-1">
            <p className="text-3xl font-bold tracking-tight text-foreground dark:text-foreground">{formatPercent(diskMetric?.usedPercent)}</p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground/80">Usado: <span className="text-skin-text">{formatBytes(diskUsed)}</span></p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground/80">Total: <span className="text-skin-text">{formatBytes(diskMetric?.totalBytes)}</span></p>
          </div>
          <div className="h-24 w-24 shrink-0">
            {diskUsed > 0 ? (
              <DashboardResponsiveChart className="h-full w-full" minHeight={96}>
                <PieChart>
                  <Pie
                    data={diskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={40}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {diskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </DashboardResponsiveChart>
            ) : null}
          </div>
        </div>
      </OperationalDashboardWidget>,
    );

    const systemMetric = toMetric(dashboard?.system);
    map.set(
      "system",
      <OperationalDashboardWidget
        id="system"
        title="Sistema Operacional"
        subtitle={metricStatusLabel(systemMetric)}
        tone={statusTone(systemMetric?.status)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        compact
      >
        <div className="mt-auto flex flex-wrap gap-1.5">
          <span className="rounded-full border border-skin-border px-2 py-0.5 text-[10px] font-medium text-skin-text-muted">
            {String(systemMetric?.platform || "--")}
          </span>
          <span className="rounded-full border border-skin-border px-2 py-0.5 text-[10px] font-medium text-skin-text-muted">
            {String(systemMetric?.release || "--")}
          </span>
          <span className="rounded-full border border-skin-border px-2 py-0.5 text-[10px] font-medium text-skin-text-muted">
            Node {String(systemMetric?.nodeVersion || "--")}
          </span>
        </div>
      </OperationalDashboardWidget>,
    );

    const databaseMetric = toMetric(dashboard?.database);
    const databaseMetricState = resolveDashboardMetricState(databaseMetric);
    map.set(
      "database",
      <OperationalDashboardWidget
        id="database"
        title="Banco (Status)"
        subtitle={metricStatusLabel(databaseMetric)}
        tone={operationalWidgetTone(databaseMetric)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        compact
      >
        {databaseMetricState ? (
          <DashboardMetricState metric={databaseMetric} />
        ) : (
          <div className="mt-auto flex items-end justify-between gap-2">
            <div>
              <p className="text-[1.55rem] font-bold leading-none tracking-tight text-skin-success">
                {databaseMetric?.latencyMs !== null && databaseMetric?.latencyMs !== undefined
                  ? `${databaseMetric.latencyMs}ms`
                  : "--"}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground/80/80">
                banco
              </p>
            </div>
            <span className="rounded-full border border-skin-border bg-skin-surface/80 px-2 py-0.5 text-[10px] font-medium capitalize text-skin-text-muted">
              {String(databaseMetric?.status || "--")}
            </span>
          </div>
        )}
      </OperationalDashboardWidget>,
    );

    const redisMetric = toMetric(dashboard?.redis);
    const redisMetricState = resolveDashboardMetricState(redisMetric);
    map.set(
      "redis",
      <OperationalDashboardWidget
        id="redis"
        title="Redis (Cache)"
        subtitle={metricStatusLabel(redisMetric)}
        tone={operationalWidgetTone(redisMetric)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        compact
      >
        {redisMetricState ? (
          <DashboardMetricState metric={redisMetric} />
        ) : (
          <div className="mt-auto flex items-end justify-between gap-2">
            <div>
              <p className="text-[1.55rem] font-bold leading-none tracking-tight text-skin-info">
                {redisMetric?.latencyMs !== null && redisMetric?.latencyMs !== undefined
                  ? `${redisMetric.latencyMs}ms`
                  : "--"}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground/80/80">
                cache
              </p>
            </div>
            <span className="rounded-full border border-skin-border bg-skin-surface/80 px-2 py-0.5 text-[10px] font-medium capitalize text-skin-text-muted">
              {String(redisMetric?.status || "--")}
            </span>
          </div>
        )}
      </OperationalDashboardWidget>,
    );

    const workersMetric = toMetric(dashboard?.workers);
    const workersMetricState = resolveDashboardMetricState(workersMetric);
    map.set(
      "workers",
      <OperationalDashboardWidget
        id="workers"
        title="Trabalhos Ativos"
        subtitle={metricStatusLabel(workersMetric)}
        tone={operationalWidgetTone(workersMetric)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        compact
      >
        {workersMetricState ? (
          <DashboardMetricState metric={workersMetric} />
        ) : (
          <div className="mt-auto flex items-end justify-between gap-2">
            <p className="text-[1.7rem] font-bold leading-none tracking-tight text-foreground text-skin-info/90">
              {String(workersMetric?.activeWorkers ?? workersMetric?.runningJobs ?? "--")}
            </p>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">
                Executando: <span className="font-medium text-skin-text">{String(workersMetric?.runningJobs ?? "--")}</span>
              </p>
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">
                Pendentes: <span className="font-medium text-skin-warning/80">{String(workersMetric?.pendingJobs ?? "--")}</span>
              </p>
            </div>
          </div>
        )}
      </OperationalDashboardWidget>,
    );

    const jobsMetric = toMetric(dashboard?.jobs);
    const jobsMetricState = resolveDashboardMetricState(jobsMetric);
    map.set(
      "jobs",
      <OperationalDashboardWidget
        id="jobs"
        title="Jobs na Fila"
        subtitle={metricStatusLabel(jobsMetric)}
        tone={operationalWidgetTone(jobsMetric)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        compact
      >
        {jobsMetricState ? (
          <DashboardMetricState metric={jobsMetric} />
        ) : (
          <div className="mt-auto flex items-end justify-between gap-2">
            <p className="text-[1.7rem] font-bold leading-none tracking-tight text-foreground text-skin-info/90">
              {String(jobsMetric?.running ?? "--")}
            </p>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">Pendentes: <span className="text-skin-warning/80">{String(jobsMetric?.pending ?? "--")}</span></p>
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">Falhas 24h: <span className="text-skin-danger">{String(jobsMetric?.failedLast24h ?? "--")}</span></p>
            </div>
          </div>
        )}
      </OperationalDashboardWidget>,
    );

    const backupMetric = toMetric(dashboard?.backup);
    const backupMetricState = resolveDashboardMetricState(backupMetric);
    const lastBackup = (backupMetric?.lastBackup || null) as Record<string, unknown> | null;
    const recentBackups = Array.isArray(backupMetric?.recentBackups) ? backupMetric.recentBackups : [];
    const backupIntent = getWidgetIntent("backup");
    map.set(
      "backup",
      <OperationalDashboardWidget
        id="backup"
        title="Ultimo Backup"
        subtitle={metricStatusLabel(backupMetric)}
        tone={statusTone(backupMetric?.status)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        onSelect={backupIntent ? () => executeDashboardIntent(backupIntent) : undefined}
        actionLabel={backupIntent?.label}
        compact
      >
        {backupMetricState ? (
          <DashboardMetricState metric={backupMetric} />
        ) : lastBackup ? (
          <div className="mt-auto space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold">
                {String(lastBackup.fileName || lastBackup.id || "--")}
              </p>
              <span className="rounded-full border border-skin-border px-2.5 py-1 text-[11px] font-medium text-skin-text-muted  dark:text-skin-text-muted">
                {String(lastBackup.status || "--")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-skin-border px-2 py-1 ">
                {formatBytes(lastBackup.sizeBytes)}
              </span>
              <span className="rounded-full border border-skin-border px-2 py-1 ">
                {formatDurationSeconds(lastBackup.durationSeconds)}
              </span>
              <span className="rounded-full border border-skin-border px-2 py-1 ">
                {lastBackup.finishedAt ? formatDateTime(lastBackup.finishedAt) : "--"}
              </span>
            </div>
            {recentBackups.length > 1 ? (
              <div className="border-t border-skin-border/70 pt-2 dark:border-skin-border/70">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                  Historico recente
                </p>
                <div className="mt-2 space-y-1.5">
                  {recentBackups.slice(1, 4).map((item, index) => {
                    const row = item as Record<string, unknown>;
                    return (
                      <div
                        key={`${row.id || index}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-skin-border/70 px-2.5 py-1.5 text-[11px] dark:border-skin-border/70"
                      >
                        <span className="min-w-0 truncate text-skin-text-muted">
                          {String(row.fileName || row.id || "--")}
                        </span>
                        <span className="shrink-0 text-muted-foreground dark:text-muted-foreground/80">
                          {row.finishedAt ? formatDateTime(row.finishedAt) : "--"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <DashboardSurfaceState
            title="Sem dados"
            description="Nenhum backup concluido foi encontrado."
            centered
            className="mt-auto"
          />
        )}
      </OperationalDashboardWidget>,
    );

    const routeLatencyMetric = toMetric(dashboard?.routeLatency);
    const routeLatencyMetricState = resolveDashboardMetricState(routeLatencyMetric);
    const topSlowRoutes = normalizeRouteTelemetryItems(routeLatencyMetric?.topSlowRoutes);
    map.set(
      "routeLatency",
      <OperationalDashboardWidget
        id="routeLatency"
        title="Top rotas lentas"
        subtitle={metricStatusLabel(routeLatencyMetric)}
        tone={operationalWidgetTone(routeLatencyMetric)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
      >
        {routeLatencyMetricState ? (
          <DashboardMetricState metric={routeLatencyMetric} />
        ) : topSlowRoutes.length > 0 ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex items-end justify-between gap-3 rounded-[20px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70">
              <div>
                  <p className="text-[1.7rem] font-bold leading-none tracking-tight text-skin-info">
                  {routeLatencyMetric?.avgResponseMs !== null && routeLatencyMetric?.avgResponseMs !== undefined
                    ? `${routeLatencyMetric.avgResponseMs}ms`
                    : "--"}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground/80">
                  media recente
                </p>
              </div>
              <div className="text-right text-[11px] text-muted-foreground dark:text-muted-foreground/80">
                <p>{String(routeLatencyMetric?.totalRequestsRecent ?? 0)} req</p>
                <p>{String(routeLatencyMetric?.windowSeconds ?? "--")}s janela</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {topSlowRoutes.map((item) => (
                <div
                  key={`${item.method}:${item.route}`}
                  className="rounded-[20px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[11px] font-semibold text-foreground dark:text-foreground">
                        <span className="rounded-full border border-skin-info/30 bg-skin-info/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-skin-info">
                          {item.method}
                        </span>
                        <span className="truncate">{item.route}</span>
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground dark:text-muted-foreground/80">
                        {item.requestCount} req - p95 {item.p95Ms !== null ? `${item.p95Ms}ms` : "--"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-skin-info">
                      {item.avgMs !== null ? `${item.avgMs}ms` : "--"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DashboardSurfaceState
            title="Sem dados"
            description="Nenhuma rota lenta relevante na janela atual."
            centered
            className="mt-auto"
          />
        )}
      </OperationalDashboardWidget>,
    );

    const routeErrorsMetric = toMetric(dashboard?.routeErrors);
    const routeErrorsMetricState = resolveDashboardMetricState(routeErrorsMetric);
    const topErrorRoutes = normalizeRouteTelemetryItems(routeErrorsMetric?.topErrorRoutes);
    map.set(
      "routeErrors",
      <OperationalDashboardWidget
        id="routeErrors"
        title="Top rotas com erro"
        subtitle={metricStatusLabel(routeErrorsMetric)}
        tone={operationalWidgetTone(routeErrorsMetric)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
      >
        {routeErrorsMetricState ? (
          <DashboardMetricState metric={routeErrorsMetric} />
        ) : topErrorRoutes.length > 0 ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex items-end justify-between gap-3 rounded-[20px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70">
              <div>
                <p className="text-[1.7rem] font-bold leading-none tracking-tight text-skin-danger">
                  {String(routeErrorsMetric?.totalErrorCount ?? "--")}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground/80">
                  erros recentes
                </p>
              </div>
              <div className="text-right text-[11px] text-muted-foreground dark:text-muted-foreground/80">
                <p>{formatPercent(routeErrorsMetric?.errorRateRecent)}</p>
                <p>{String(routeErrorsMetric?.totalRequestsRecent ?? 0)} req</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {topErrorRoutes.map((item) => (
                <div
                  key={`${item.method}:${item.route}`}
                  className="rounded-[20px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[11px] font-semibold text-foreground dark:text-foreground">
                        <span className="rounded-full border border-skin-danger/30 bg-skin-danger/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-skin-danger">
                          {item.method}
                        </span>
                        <span className="truncate">{item.route}</span>
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground dark:text-muted-foreground/80">
                        {item.errorCount} erros - 5xx {item.status5xx} - {formatPercent(item.errorRate)}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-[10px] text-muted-foreground dark:text-muted-foreground/80">
                      {item.lastErrorAt ? formatDateTime(item.lastErrorAt) : "--"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DashboardSurfaceState
            title="Sem dados"
            description="Nenhuma rota com erro na janela atual."
            centered
            className="mt-auto"
          />
        )}
      </OperationalDashboardWidget>,
    );

    const errorsMetric = toMetric(dashboard?.errors);
    const errorsMetricState = resolveDashboardMetricState(errorsMetric);
    const recentErrors = Array.isArray(errorsMetric?.recent) ? errorsMetric.recent : [];
    const errorsIntent = getWidgetIntent("errors");
    map.set(
      "errors",
      <OperationalDashboardWidget
        id="errors"
        title="Eventos Criticos"
        subtitle={metricStatusLabel(errorsMetric)}
        tone={statusTone(errorsMetric?.status)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        onSelect={errorsIntent ? () => executeDashboardIntent(errorsIntent) : undefined}
        actionLabel={errorsIntent?.label}
      >
        {errorsMetricState ? (
          <DashboardMetricState metric={errorsMetric} />
        ) : recentErrors.length > 0 ? (
          <div className="max-h-40 space-y-2 overflow-auto pr-1">
            {recentErrors.slice(0, 5).map((item, index) => {
              const row = item as Record<string, unknown>;
              return (
                <div
                  key={`${row.id || index}`}
                  className="flex items-center justify-between gap-3 rounded border border-skin-danger/30 px-2.5 py-2"
                >
                  <p className="min-w-0 truncate text-[11px] font-medium text-foreground dark:text-foreground">
                    {buildAuditEventLine(row)}
                  </p>
                  <p className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <DashboardSurfaceState
            title="Sem dados"
            description="Sem eventos criticos no periodo atual."
            centered
            className="mt-auto"
          />
        )}
      </OperationalDashboardWidget>,
    );
    const securityMetric = toMetric(dashboard?.security);
    const securityMetricState = resolveDashboardMetricState(securityMetric);
    const deniedIps = normalizeSecurityIpTelemetryItems(securityMetric?.topDeniedIps || securityMetric?.deniedAccess);
    const rateLimitedIps = normalizeSecurityIpTelemetryItems(securityMetric?.topRateLimitedIps);
    const recentSecurityEvents = normalizeSecurityRecentTelemetryItems(securityMetric?.accessDeniedRecent);

    map.set(
      "security",
      <OperationalDashboardWidget
        id="security"
        title="Pressao de seguranca"
        subtitle={metricStatusLabel(securityMetric)}
        tone={operationalWidgetTone(securityMetric)}
        isEditing={layoutEditingActive}
        onHide={hideHandler}
      >
        {securityMetricState ? (
          <DashboardMetricState metric={securityMetric} />
        ) : deniedIps.length > 0 || rateLimitedIps.length > 0 || recentSecurityEvents.length > 0 ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-[18px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70">
                <p className="text-[1.45rem] font-bold tracking-tight text-skin-danger">
                  {deniedIps.reduce((acc, item) => acc + item.count, 0)}
                </p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground/80">negados</p>
              </div>
              <div className="rounded-[18px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70">
                <p className="text-[1.45rem] font-bold tracking-tight text-skin-warning">
                  {rateLimitedIps.reduce((acc, item) => acc + item.count, 0)}
                </p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground/80">429 recentes</p>
              </div>
              <div className="rounded-[18px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70">
                <p className="text-[1.45rem] font-bold tracking-tight text-skin-info">
                  {String(securityMetric?.maintenanceBypassAttemptsRecent ?? 0)}
                </p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground/80">bypass</p>
              </div>
            </div>
            <div className="grid flex-1 gap-3 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-muted-foreground/80">
                  IPs com mais negacoes
                </p>
                {deniedIps.slice(0, 4).map((item) => (
                  <div
                    key={`${item.ip}:${item.route || 'na'}`}
                    className="rounded-[18px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-foreground dark:text-foreground">{item.ip}</p>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground dark:text-muted-foreground/80">
                          {item.route || "rota nao informada"}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-skin-danger">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-muted-foreground/80">
                  Pressao recente
                </p>
                {(rateLimitedIps.length > 0 ? rateLimitedIps : recentSecurityEvents.slice(0, 4)).slice(0, 4).map((item, index) => {
                  if ("count" in item) {
                    return (
                      <div
                        key={`${item.ip}:${index}`}
                        className="rounded-[18px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-semibold text-foreground dark:text-foreground">{item.ip}</p>
                            <p className="mt-1 truncate text-[10px] text-muted-foreground dark:text-muted-foreground/80">{item.route || "429"}</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-skin-warning">{item.count}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${item.type}:${item.at}:${index}`}
                      className="rounded-[18px] border border-skin-border/70 px-3 py-2 dark:border-skin-border/70"
                    >
                      <p className="truncate text-[11px] font-semibold text-foreground dark:text-foreground">
                        {formatSecurityEventType(item.type)} - {item.method} {item.route}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground dark:text-muted-foreground/80">
                        {item.ip} - {item.statusCode} - {item.at ? formatDateTime(item.at) : "--"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <DashboardSurfaceState
            title="Sem dados"
            description="Nenhum evento de seguranca relevante na janela atual."
            centered
            className="mt-auto"
          />
        )}
      </OperationalDashboardWidget>,
    );

    const tenantsMetric = toMetric(dashboard?.tenants);
    map.set(
      "tenants",
      <OperationalDashboardWidget
        id="tenants"
        title="Lojas / Tenants"
        subtitle={metricStatusLabel(tenantsMetric)}
        tone="modern"
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        compact
      >
        <div className="mt-auto flex items-end justify-between gap-2">
          <p className="text-[1.7rem] font-bold leading-none tracking-tight text-foreground text-skin-info/90">{String(tenantsMetric?.active ?? "--")}</p>
          <div className="text-right text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">
            <p>ativas</p>
            <p>{String(tenantsMetric?.total ?? "--")} total</p>
          </div>
        </div>
      </OperationalDashboardWidget>,
    );

    const notificationsMetric = toMetric(dashboard?.notifications);
    const notificationsIntent = getWidgetIntent("notifications");
    const recentOperationalAlerts = Array.isArray(notificationsMetric?.recentOperationalAlerts)
      ? notificationsMetric.recentOperationalAlerts as OperationalAlertListItem[]
      : [];
    map.set(
      "notifications",
      <OperationalDashboardWidget
        id="notifications"
        title="Notificacoes Criticas"
        subtitle={metricStatusLabel(notificationsMetric)}
        tone="modern"
        isEditing={layoutEditingActive}
        onHide={hideHandler}
        onSelect={notificationsIntent ? () => executeDashboardIntent(notificationsIntent) : undefined}
        actionLabel={notificationsIntent?.label}
        compact
      >
        <div className="mt-auto space-y-3">
          <div className="flex items-end justify-between gap-2">
            <p className="text-[1.7rem] font-bold leading-none tracking-tight text-foreground text-skin-info/90">
              {String(notificationsMetric?.criticalUnread ?? "--")}
            </p>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">Nao lidas</p>
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">
                Criticas no periodo: <span className="font-medium text-skin-text">{String(notificationsMetric?.criticalRecent ?? "--")}</span>
              </p>
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">
                Alertas operacionais: <span className="font-medium text-skin-text">{String(notificationsMetric?.operationalRecentCount ?? "--")}</span>
              </p>
            </div>
          </div>
          <div className="space-y-1.5 border-t border-skin-border/80 pt-2 dark:border-white/10">
            {recentOperationalAlerts.length > 0 ? (
              recentOperationalAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-2 text-[10px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground dark:text-foreground">{alert.title}</p>
                    <p className="truncate text-muted-foreground dark:text-muted-foreground/80/80">{alert.body}</p>
                  </div>
                  <span className="shrink-0 text-muted-foreground dark:text-muted-foreground">{formatTimeOfDay(alert.createdAt)}</span>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/80/80">Sem alertas operacionais recentes.</p>
            )}
          </div>
        </div>
      </OperationalDashboardWidget>,
    );

    return map;
  }, [
    dashboard,
    executeDashboardIntent,
    getWidgetIntent,
    layoutEditingActive,
    toggleWidgetVisibilityInEditor,
  ]);

  if (!user || !isOperationalAllowed) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className={embedded ? "space-y-4" : "mx-auto max-w-[1600px] space-y-4 p-4 md:p-6"}>
        <div className="space-y-3">
          {!embedded ? (
            <div className="rounded-[24px] border border-skin-border/80 bg-skin-surface/88 px-4 py-3 text-foreground shadow-[0_18px_40px_-30px_rgba(15,23,42,0.18)] dark:border-skin-border dark:bg-background dark:text-foreground dark:shadow-xl">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex h-7 items-center rounded-full border border-skin-border bg-skin-background-elevated/50 px-2.5  ">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-skin-info">
                        Visao operacional
                      </span>
                    </div>
                    <h1 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
                      Dashboard Operacional
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground dark:text-skin-text-muted">
                    <span className="rounded-full border border-skin-border bg-skin-surface px-2.5 py-1 dark:border-white/10 dark:bg-skin-surface/5">
                      Snapshot: {dashboard?.generatedAt ? formatDateTime(dashboard.generatedAt) : "--"}
                    </span>
                    <span className="rounded-full border border-skin-border bg-skin-surface px-2.5 py-1 dark:border-white/10 dark:bg-skin-surface/5">
                      Layout:{" "}
                      {lastLayoutUpdateAt
                        ? `salvo em ${formatDateTime(lastLayoutUpdateAt)}`
                        : "padrao ativo"}
                    </span>
                    <span className="rounded-full border border-skin-border bg-skin-surface px-2.5 py-1 dark:border-white/10 dark:bg-skin-surface/5">
                      Auto refresh {Math.floor(POLL_INTERVAL_MS / 1000)}s
                    </span>
                    {isMobileViewport ? (
                      <span className="rounded-full border border-skin-border bg-skin-surface px-2.5 py-1 text-skin-text-muted">
                        Reordenacao disponivel no desktop
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <ToolbarIconButton
                    label="Atualizar dashboard"
                    onClick={() => {
                      void refreshDashboard(true);
                    }}
                    active={refreshing}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
                  </ToolbarIconButton>

                  <ToolbarIconButton
                    label={
                      !canEditLayout
                        ? "Editar layout disponivel apenas em telas maiores"
                        : staleSnapshotActive
                          ? "Atualize o dashboard antes de editar o layout"
                        : layoutEditingActive
                          ? "Cancelar edicao de layout"
                          : "Editar layout"
                    }
                    onClick={() => {
                      if (layoutEditingActive) {
                        cancelLayoutEditing();
                        return;
                      }

                      beginLayoutEditing();
                    }}
                    active={layoutEditingActive}
                    disabled={savingLayout || !canEditLayout || staleSnapshotActive}
                  >
                    {savingLayout ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <LayoutGrid className="h-5 w-5" />
                    )}
                  </ToolbarIconButton>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-skin-border/80 bg-skin-surface/80 px-4 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)] dark:border-skin-border/80 dark:bg-background/45">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground dark:text-foreground">
                    Acoes rapidas
                  </p>
                  <span className="rounded-full bg-skin-background-elevated px-2 py-0.5 text-[10px] font-medium text-skin-text-muted">
                    Contextuais
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {quickActions.length > 0 ? (
                    quickActions.map((action) => (
                      <QuickActionButton
                        key={action.id}
                        label={action.label}
                        description={action.description}
                        onClick={() => executeDashboardIntent(action.intent)}
                        disabled={staleSnapshotActive}
                      />
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-skin-border/80 px-4 py-3 text-sm text-muted-foreground dark:border-skin-border/80 dark:text-muted-foreground/80">
                      Nenhuma acao contextual disponivel para a role atual.
                    </div>
                  )}
                </div>
              </div>

              <div className="xl:max-w-[34rem] xl:min-w-[28rem]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground dark:text-foreground">
                      Foco rapido
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground/80">
                      Filtra apenas os blocos visiveis nesta tela sem persistir no backend.
                    </p>
                  </div>
                  {activeQuickFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setActiveQuickFilter("all")}
                      className="text-xs font-medium text-skin-info hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-skin-surface"
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {dashboardQuickFilterOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setActiveQuickFilter(option.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${activeQuickFilter === option.id
                        ? "border-skin-info/30 bg-skin-info/15 text-skin-info"
                        : "border-skin-border bg-skin-surface text-skin-text-muted hover:border-skin-border hover:text-foreground/90"
                        }`}
                      aria-pressed={activeQuickFilter === option.id}
                      title={option.description}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-[22px] border border-skin-border/80 bg-skin-background-elevated/50/80 p-3 dark:border-skin-border/80 /40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground dark:text-foreground">
                        Recorte operacional
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground/80">
                        Periodo e tenant ficam disponiveis direto nas acoes rapidas.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 text-xs"
                        onClick={restoreFilterDefaults}
                      >
                        Padrao
                      </Button>
                      <Button
                        type="button"
                        className="h-9 text-xs"
                        onClick={() => {
                          void applyFilters();
                        }}
                        disabled={!hasDraftFilterChanges}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[15, 30, 60, 180].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() =>
                          setDraftFilters((current) => ({ ...current, periodMinutes: minutes }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${
                          draftFilters.periodMinutes === minutes
                            ? "border-skin-info/30 bg-skin-info/15 text-skin-info"
                            : "border-skin-border bg-skin-surface text-skin-text-muted hover:border-skin-border hover:text-skin-text"
                        }`}
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                  {role === "SUPER_ADMIN" ? (
                    <div className="mt-3">
                      <Input
                        value={draftFilters.tenantId}
                        aria-label="Filtrar por tenant"
                        placeholder="tenant-id"
                        onChange={(event) => {
                          const nextTenantId = event.target.value;
                          setDraftFilters((current) => ({
                            ...current,
                            tenantId: nextTenantId,
                          }));
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {layoutEditingActive ? (
          <div className="rounded-[28px] border border-skin-info/30 bg-skin-info/10 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-skin-info">
                  <LayoutGrid className="h-4 w-4" />
                  <p className="text-sm font-semibold">Modo de edicao de layout</p>
                </div>
                <p className="mt-1 text-xs text-skin-text-muted">
                  Arraste pelos handles dos cards e use o canto inferior direito para
                  redimensionar os blocos. Os atalhos abaixo permitem ocultar ou restaurar
                  widgets antes de salvar.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-skin-border bg-skin-surface/70 text-skin-text hover:bg-skin-surface "
                  onClick={resetLayoutEditing}
                  disabled={savingLayout}
                >
                  <RefreshCw className="h-4 w-4" />
                  Restaurar Padrao
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-skin-border bg-skin-surface/70 text-skin-text hover:bg-skin-surface "
                  onClick={cancelLayoutEditing}
                  disabled={savingLayout}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="gap-2 bg-skin-primary text-skin-text-inverse hover:bg-skin-primary-hover"
                  onClick={() => {
                    void saveLayoutEditing();
                  }}
                  disabled={!hasPendingLayoutChanges || savingLayout || staleSnapshotActive}
                >
                  {savingLayout ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Salvar layout
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {stableAvailableWidgetIds.map((widgetId) => {
                const isHidden = editingHiddenWidgetIds.includes(widgetId);
                return (
                  <button
                    key={widgetId}
                    type="button"
                    onClick={() => toggleWidgetVisibilityInEditor(widgetId)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${isHidden
                      ? "border-skin-border bg-skin-surface text-skin-text-muted hover:border-skin-border-strong hover:text-skin-text"
                      : "border-skin-info/30 bg-skin-info/15 text-skin-info hover:bg-skin-info/20"
                      }`}
                    aria-pressed={!isHidden}
                  >
                    {isHidden ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {widgetLabelById[widgetId] || widgetId}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-skin-danger/30 bg-skin-danger/10 px-4 py-3 text-skin-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Falha ao carregar o dashboard</p>
              <p className="text-xs text-skin-danger/90">{error}</p>
            </div>
          </div>
        ) : null}

        {contractDegradationMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-skin-warning/30 bg-skin-warning/10 px-4 py-3 text-skin-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Modo degradado de contrato</p>
              <p className="text-xs text-skin-warning/90">{contractDegradationMessage}</p>
            </div>
          </div>
        ) : null}

        {runtimeMitigationBanner ? (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              runtimeMitigationBanner.tone === "info"
                ? "border-skin-info/30 bg-skin-info/10 text-skin-info"
                : "border-skin-warning/30 bg-skin-warning/10 text-skin-warning"
            }`}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{runtimeMitigationBanner.title}</p>
              <p className="text-xs opacity-90">{runtimeMitigationBanner.message}</p>
              {runtimeMitigationBanner.detail ? (
                <p className="mt-1 text-xs opacity-80">{runtimeMitigationBanner.detail}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {staleSnapshotAt ? (
          <div className="flex items-start gap-3 rounded-2xl border border-skin-info/30 bg-skin-info/10 px-4 py-3 text-skin-info">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Snapshot desatualizado em uso</p>
              <p className="text-xs text-skin-info/90">
                Ultimo snapshot valido coletado ha {formatSnapshotAgeLabel(staleSnapshotAt)}.
              </p>
              <p className="mt-1 text-xs text-skin-info/80">
                O painel tenta uma nova leitura automaticamente enquanto a conectividade e o contrato se estabilizam.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-skin-info/30 bg-skin-surface/70 text-skin-info hover:bg-skin-info/10"
                  onClick={() => {
                    void refreshDashboard(true);
                  }}
                >
                  Atualizar agora
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {showInitialSkeleton ? (
          <DashboardOverviewSkeleton />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
          <section className="overflow-hidden rounded-[32px] border border-skin-border/80 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.09),_transparent_30%),radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.95))] px-5 py-5 text-foreground shadow-[0_22px_55px_-38px_rgba(15,23,42,0.2)] dark:border-skin-border dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_30%),radial-gradient(circle_at_right,_rgba(59,130,246,0.24),_transparent_26%),linear-gradient(150deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] dark:text-foreground dark:shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_220px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-skin-info/30 bg-skin-info/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-skin-info">
                    Panorama
                  </span>
                  <span className="rounded-full border border-skin-border bg-skin-surface/85 px-3 py-1 text-[11px] text-skin-text-muted">
                    {dashboardOverview.visibleWidgets} cards livres
                  </span>
                  {activeQuickFilter !== "all" ? (
                    <span className="rounded-full border border-skin-border bg-skin-surface/85 px-3 py-1 text-[11px] text-skin-text-muted">
                      Filtro rapido: {dashboardQuickFilterOptions.find((option) => option.id === activeQuickFilter)?.label || activeQuickFilter}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <OverviewStat
                    icon={<Activity className="h-4 w-4" />}
                    label="Latencia media"
                    value={dashboardOverview.avgLatency}
                    hint={dashboardOverview.apiLatencyHint}
                    trend={dashboardOverview.apiLatencyTrend}
                  />
                  <OverviewStat
                    icon={<BellDot className="h-4 w-4" />}
                    label="Notificacoes"
                    value={dashboardOverview.unreadNotifications}
                    hint="Notificacoes nao lidas"
                  />
                  <OverviewStat
                    icon={<ShieldAlert className="h-4 w-4" />}
                    label="Acessos bloqueados"
                    value={dashboardOverview.blockedAttempts}
                    hint="Top IPs no periodo"
                    tone="danger"
                  />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {dashboardOverview.panoramaSignals.map((item) => (
                    <PanoramaSignal
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      hint={item.hint}
                      accentClassName={item.accentClassName}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-skin-border/80 bg-skin-surface/78 p-4 backdrop-blur-sm dark:border-skin-border/20 dark:bg-skin-surface/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-skin-text-muted">
                      Saude do painel
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-skin-border bg-skin-background-elevated/50 text-foreground">
                    <Server className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-3 h-32">
                  {dashboardOverview.statusChart.length > 0 ? (
                    <DashboardResponsiveChart
                      className="h-full w-full"
                      minHeight={128}
                      fallback={
                        <DashboardChartState
                          title="Sem dados"
                          description="Sem saude consolidada neste ciclo."
                          dark
                        />
                      }
                    >
                      <PieChart>
                        <Pie
                          data={dashboardOverview.statusChart}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={54}
                          paddingAngle={3}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {dashboardOverview.statusChart.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          cursor={false}
                          formatter={(value: number, _name, payload) => [
                            `${value} widgets`,
                            String(payload?.payload?.name || "Status"),
                          ]}
                          contentStyle={{
                            borderRadius: 16,
                            border: "1px solid rgba(148,163,184,0.2)",
                            background: "rgba(2,6,23,0.96)",
                            color: "#e2e8f0",
                          }}
                        />
                      </PieChart>
                    </DashboardResponsiveChart>
                  ) : (
                    <DashboardChartState
                      title="Sem dados"
                      description="Sem saude consolidada neste ciclo."
                      dark
                    />
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    {
                      id: "good" as const,
                      label: "Saudavel",
                      value: dashboardOverview.counts.good,
                      color: "bg-skin-success",
                      items: dashboardOverview.healthDetails.good,
                    },
                    {
                      id: "attention" as const,
                      label: "Atencao",
                      value: dashboardOverview.counts.attention,
                      color: "bg-skin-warning",
                      items: dashboardOverview.healthDetails.attention,
                    },
                    {
                      id: "restricted" as const,
                      label: "Restrito",
                      value: dashboardOverview.counts.restricted,
                      color: "bg-skin-background-elevated/500",
                      items: dashboardOverview.healthDetails.restricted,
                    },
                  ].map((item) => (
                    <HealthBucketLegendRow
                      key={item.id}
                      label={item.label}
                      value={item.value}
                      color={item.color}
                      items={item.items}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-skin-border/80 bg-skin-surface/80 p-4 shadow-[0_25px_60px_-38px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-skin-border/80 dark:bg-background/45">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground dark:text-foreground">
                  Monitoramento do Servidor
                </h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-skin-border bg-skin-background-elevated/50 text-foreground">
                <Maximize2 className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {dashboardOverview.resourceUsage.map((resource) => (
                <ResourceMeter
                  key={resource.label}
                  label={resource.label}
                  value={resource.value}
                  toneClassName={resource.toneClassName}
                  trend={
                    resource.label.toLowerCase().startsWith("mem")
                      ? dashboardOverview.memoryTrend
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
          </div>
        )}

        <div ref={containerRef}>
          {showInitialSkeleton ? (
            <DashboardGridSkeleton />
          ) : visibleWidgetIds.length === 0 ? (
            <DashboardCollectionState
              title="Sem dados"
              description="Nenhum widget visivel no layout atual."
            />
          ) : gridWidgetIds.length === 0 ? (
            <DashboardCollectionState
              title="Sem dados"
              description={
                activeQuickFilter === "all"
                  ? "Nenhum widget livre disponivel."
                  : "Nenhum widget livre corresponde ao filtro rapido atual."
              }
            />
          ) : (
            <Responsive
              width={width}
              layouts={layoutsForRender as unknown as ResponsiveLayouts<string>}
              breakpoints={dashboardGridBreakpoints}
              cols={dashboardGridCols}
              rowHeight={dashboardGridRowHeight}
              margin={[10, 10]}
              containerPadding={[0, 0]}
              // @ts-expect-error compactType is valid for react-grid-layout
              compactType={null}
              dragConfig={{ enabled: layoutEditingActive, handle: ".dashboard-drag-handle" }}
              resizeConfig={{ enabled: layoutEditingActive, handles: ["se"] }}
              allowOverlap={false}
              className={`operational-dashboard-grid ${layoutEditingActive ? "is-editing" : ""}`}
              onLayoutChange={(_: Layout, nextLayouts: ResponsiveLayouts<string>) => {
                if (!layoutEditingActive) {
                  return;
                }

                setEditingLayouts(normalizeLayoutForWidgets(nextLayouts, stableAvailableWidgetIds));
              }}
            >
              {gridWidgetIds.map((widgetId) => (
                <div key={widgetId}>{cardsById.get(widgetId) || null}</div>
              ))}
            </Responsive>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-[24px] border border-skin-border bg-skin-surface/80 px-4 py-3 text-xs text-skin-text-muted shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground/90 dark:text-foreground">Contexto ativo</span>
            <span className="rounded-full border border-skin-border px-2 py-1 ">
              Periodo: {appliedFilters.periodMinutes} min
            </span>
            <span className="rounded-full border border-skin-border px-2 py-1 ">
              Severidade: {appliedFilters.severity === "all" ? "todas" : appliedFilters.severity}
            </span>
            {activeQuickFilter !== "all" ? (
              <span className="rounded-full border border-skin-border px-2 py-1 ">
                Foco rapido: {dashboardQuickFilterOptions.find((option) => option.id === activeQuickFilter)?.label || activeQuickFilter}
              </span>
            ) : null}
            {role === "SUPER_ADMIN" && appliedFilters.tenantId ? (
              <span className="rounded-full border border-skin-border px-2 py-1 ">
                Tenant: {appliedFilters.tenantId}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasAppliedActiveFilters ? (
              <span className="rounded-full bg-skin-warning/10 px-2 py-1 text-skin-warning">
                Filtros personalizados
              </span>
            ) : (
              <span className="rounded-full bg-skin-success/10 px-2 py-1 text-skin-success">
                Filtros padrao
              </span>
            )}
            <span className="rounded-full bg-skin-background-elevated px-2 py-1 ">
              {layoutEditingActive ? "Edicao de layout ativa" : "Modo leitura"}
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider >
  );
}
