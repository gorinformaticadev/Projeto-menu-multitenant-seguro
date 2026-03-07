"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BellDot,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  Info,
  LayoutGrid,
  Loader2,
  Maximize2,
  RefreshCw,
  Server,
  ShieldAlert,
  SlidersHorizontal,
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
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  allowedWidgetIdsByRole,
  dashboardGridBreakpoints,
  dashboardGridCols,
  dashboardGridRowHeight,
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
  normalizeLayoutForWidgets,
  statusTone,
  type DashboardMetric,
  type DashboardRole,
} from "@/components/operational-dashboard/dashboard.utils";
import {
  DashboardMetricState,
  resolveDashboardMetricState,
} from "@/components/operational-dashboard/DashboardMetricState";
import { OperationalDashboardWidget } from "@/components/operational-dashboard/OperationalDashboardWidget";

type DashboardFiltersState = {
  periodMinutes: number;
  tenantId: string;
  severity: "all" | "info" | "warning" | "critical";
};

type DashboardLayoutResponse = {
  role?: DashboardRole;
  layoutJson?: unknown;
  filtersJson?: {
    periodMinutes?: number;
    tenantId?: string | null;
    severity?: string;
    hiddenWidgetIds?: unknown;
  } | null;
  updatedAt?: string | null;
  resolution?: {
    source?: "user_role" | "role_default";
  } | null;
};

type DashboardPayload = {
  generatedAt?: string;
  widgets?: {
    available?: string[];
  };
  [key: string]: unknown;
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

const POLL_INTERVAL_MS = 15000;

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

function getDefaultFilters(role: DashboardRole): DashboardFiltersState {
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
    return "bg-amber-400";
  }
  if (tone === "danger") {
    return "bg-rose-400";
  }
  return "bg-slate-400";
}

function buildAuditEventLine(row: Record<string, unknown>): string {
  const actionLabel = String(row.actionLabel || row.message || row.action || "").trim() || "--";
  const message = String(row.message || "").trim();

  if (!message || message === actionLabel) {
    return actionLabel;
  }

  return `${actionLabel} - ${message}`;
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
      <div className={`flex items-center text-[10px] text-slate-400 ${className}`}>
        {config.emptyLabel || "Sem historico recente"}
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
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
      </ResponsiveContainer>
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
  current: DashboardFiltersState,
  fallback: DashboardFiltersState,
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
            ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
            : "border-white/10 bg-white/5 text-slate-200 hover:border-slate-500 hover:bg-white/10 hover:text-white"
            }`}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
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
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "danger";
  trend?: SparklineConfig;
}) {
  return (
    <div
      className={`rounded-[20px] border px-3.5 py-3 backdrop-blur-sm ${tone === "danger"
        ? "border-rose-400/20 bg-rose-500/10 text-rose-50"
        : "border-white/10 bg-white/6 text-slate-50"
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300/80">
            {label}
          </p>
          <p className="mt-1.5 text-[1.35rem] font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-1 text-[10px] text-slate-300/80">{hint}</p>
          {trend ? <MiniTrendSparkline config={trend} className="mt-3 h-14" /> : null}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-slate-100">
          {icon}
        </div>
      </div>
    </div>
  );
}

function PanoramaSignal({
  label,
  value,
  hint,
  accentClassName,
  detailsTitle,
  detailsItems = [],
}: {
  label: string;
  value: string;
  hint: string;
  accentClassName: string;
  detailsTitle?: string;
  detailsItems?: SignalDetailItem[];
}) {
  const hasDetails = detailsItems.length > 0;
  const card = (
    <div className="rounded-[20px] border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className={`h-1.5 w-10 rounded-full ${accentClassName}`} />
        {hasDetails ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-slate-500" /> : null}
      </div>
      <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300/80">
        {label}
      </p>
      <p className="mt-1.5 text-[1.1rem] font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 truncate text-[10px] text-slate-400">{hint}</p>
    </div>
  );

  if (!hasDetails) {
    return card;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="w-full text-left">
          {card}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={10}
        className="w-80 rounded-[20px] border border-slate-700/70 bg-slate-950/95 p-3 text-slate-100 shadow-2xl"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            {detailsTitle || label}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Historico recente disponivel para consulta rapida.
          </p>
        </div>
        <div className="mt-3 max-h-60 space-y-2 overflow-auto pr-1">
          {detailsItems.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <p className="text-sm font-medium text-slate-100">{item.label}</p>
              {item.hint ? (
                <p className="mt-1 text-[10px] leading-snug text-slate-400">{item.hint}</p>
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
    <div className="space-y-1.5 rounded-[18px] border border-slate-200/80 bg-white/75 p-2.5 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/45">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          {Number.isFinite(value) ? `${Math.round(value)}${suffix}` : "--"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
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
        <span className="truncate text-[11px] font-medium text-slate-300">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-base font-semibold tracking-tight text-white">
          {value}
        </p>
        {hasItems ? (
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        ) : null}
      </div>
    </>
  );

  if (!hasItems) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
        {content}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/10"
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
        className="w-72 rounded-[20px] border border-slate-700/70 bg-slate-950/95 p-3 text-slate-100 shadow-2xl"
        onMouseEnter={clearCloseTimeout}
        onMouseLeave={scheduleClose}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              {label}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {value} widgets identificados neste grupo
            </p>
          </div>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
        </div>
        <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-slate-100">
                {item.label}
              </span>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                {item.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function OperationalDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = (user?.role || "USER") as DashboardRole;
  const defaultFilters = useMemo(() => getDefaultFilters(role), [role]);
  const roleWidgetIds = useMemo(() => allowedWidgetIdsByRole(role), [role]);
  const defaultGridWidgetIds = useMemo(
    () => filterStandaloneWidgetIds(roleWidgetIds),
    [roleWidgetIds],
  );

  const [appliedFilters, setAppliedFilters] = useState<DashboardFiltersState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFiltersState>(defaultFilters);
  const [layouts, setLayouts] = useState<Layouts>(() =>
    normalizeLayoutForWidgets({}, defaultGridWidgetIds),
  );
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<string[]>([]);
  const [editingLayouts, setEditingLayouts] = useState<Layouts>(() =>
    normalizeLayoutForWidgets({}, defaultGridWidgetIds),
  );
  const [editingHiddenWidgetIds, setEditingHiddenWidgetIds] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLayoutUpdateAt, setLastLayoutUpdateAt] = useState<string | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);

  const { width, mounted, containerRef } = useContainerWidth({ initialWidth: 1280 });

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

  const activeHiddenWidgetIds = isLayoutEditing ? editingHiddenWidgetIds : hiddenWidgetIds;
  const activeLayouts = isLayoutEditing ? editingLayouts : layouts;

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

  const hasPendingLayoutChanges = useMemo(() => {
    if (!isLayoutEditing) {
      return false;
    }

    return (
      buildLayoutComparisonSnapshot(editingLayouts, editingHiddenWidgetIds) !==
      buildLayoutComparisonSnapshot(layouts, hiddenWidgetIds)
    );
  }, [editingHiddenWidgetIds, editingLayouts, hiddenWidgetIds, isLayoutEditing, layouts]);

  const refreshDashboard = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await api.get<DashboardPayload>("/system/dashboard", {
          params: {
            periodMinutes: appliedFilters.periodMinutes,
            tenantId: appliedFilters.tenantId || undefined,
            severity: appliedFilters.severity,
          },
        });

        setDashboard(response.data || {});
        setError(null);
      } catch (requestError: unknown) {
        setError(
          (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (requestError as Error)?.message ||
          "Falha ao carregar dashboard operacional.",
        );
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [appliedFilters.periodMinutes, appliedFilters.severity, appliedFilters.tenantId],
  );

  const persistDashboardPreferences = useCallback(
    async (
      nextLayouts: Layouts,
      nextFilters: DashboardFiltersState,
      nextHiddenWidgetIds: string[],
    ): Promise<boolean> => {
      setSavingLayout(true);

      try {
        const response = await api.put<DashboardLayoutResponse>("/system/dashboard/layout", {
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

        setLastLayoutUpdateAt(response.data?.updatedAt || new Date().toISOString());
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
    try {
      const response = await api.get<DashboardLayoutResponse>("/system/dashboard/layout");
      const payload = response.data || {};
      const baseLayouts =
        payload.resolution?.source === "role_default"
          ? normalizeLayoutForWidgets({}, defaultGridWidgetIds)
          : normalizeLayoutForWidgets(payload.layoutJson, defaultGridWidgetIds);
      const filtersPayload = payload.filtersJson || {};
      const nextFilters: DashboardFiltersState = {
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
  }, [defaultFilters, defaultGridWidgetIds]);

  useEffect(() => {
    const fallbackLayouts = normalizeLayoutForWidgets({}, defaultGridWidgetIds);
    setLayouts(fallbackLayouts);
    setEditingLayouts(cloneLayouts(fallbackLayouts));
    setHiddenWidgetIds([]);
    setEditingHiddenWidgetIds([]);
    setAppliedFilters(defaultFilters);
    setDraftFilters(defaultFilters);
    setIsLayoutEditing(false);
    setIsFiltersOpen(false);
    void loadLayout();
  }, [defaultFilters, defaultGridWidgetIds, loadLayout]);

  useEffect(() => {
    void refreshDashboard();
    const interval = setInterval(() => {
      void refreshDashboard(true);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refreshDashboard]);

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
    const nextFilters: DashboardFiltersState = {
      periodMinutes: draftFilters.periodMinutes,
      severity: draftFilters.severity,
      tenantId: role === "SUPER_ADMIN" ? draftFilters.tenantId : "",
    };

    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
    setIsFiltersOpen(false);

    await persistDashboardPreferences(layouts, nextFilters, hiddenWidgetIds);
  }, [draftFilters, hiddenWidgetIds, layouts, persistDashboardPreferences, role]);

  const restoreFilterDefaults = useCallback(() => {
    setDraftFilters(defaultFilters);
  }, [defaultFilters]);

  const beginLayoutEditing = useCallback(() => {
    setIsFiltersOpen(false);
    setEditingLayouts(cloneLayouts(layouts));
    setEditingHiddenWidgetIds([...hiddenWidgetIds]);
    setIsLayoutEditing(true);
  }, [hiddenWidgetIds, layouts]);

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

  const visibleWidgetIds = useMemo(() => {
    const hiddenSet = new Set(activeHiddenWidgetIds);
    return stableAvailableWidgetIds.filter((id) => !hiddenSet.has(id));
  }, [activeHiddenWidgetIds, stableAvailableWidgetIds]);

  const gridWidgetIds = useMemo(() => {
    return visibleWidgetIds;
  }, [visibleWidgetIds]);

  const gridWidgetSet = useMemo(() => new Set(gridWidgetIds), [gridWidgetIds]);
  const layoutsForRender = useMemo(
    () => toVisibleLayouts(activeLayouts, gridWidgetSet),
    [activeLayouts, gridWidgetSet],
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
      unreadNotifications: String(notificationsMetric?.criticalUnread ?? "--"),
      blockedAttempts: securityMetricState ? "--" : String(blockedAttempts),
      visibleWidgets: visibleWidgetIds.length,
      panoramaSignals: [
        maintenanceMetricState
          ? {
            label: "Manutencao",
            value: maintenanceMetricState.title,
            hint: maintenanceMetricState.description,
            accentClassName: metricStateAccentClassName(maintenanceMetricState.tone),
          }
          : {
            label: "Manutenção",
            value: maintenanceMetric?.enabled ? "Ativa" : "Estavel",
            hint: maintenanceMetric?.enabled
              ? String(maintenanceMetric?.reason || "Janela operacional")
              : "Sem janela ativa",
            accentClassName: maintenanceMetric?.enabled ? "bg-amber-400" : "bg-emerald-400",
          },
        jobsMetricState
          ? {
            label: "Jobs na fila",
            value: jobsMetricState.title,
            hint: jobsMetricState.description,
            accentClassName: metricStateAccentClassName(jobsMetricState.tone),
          }
          : {
            label: "Jobs na fila",
            value: String(jobsMetric?.pending ?? "--"),
            hint: `${String(jobsMetric?.running ?? "--")} em execucao`,
            accentClassName: "bg-sky-400",
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
            label: "Empresas / Tenants",
            value: tenantsMetricState.title,
            hint: tenantsMetricState.description,
            accentClassName: metricStateAccentClassName(tenantsMetricState.tone),
          }
          : {
            label: "Empresas / Tenants",
            value: String(tenantsMetric?.active ?? "--"),
            hint: `${String(tenantsMetric?.total ?? "--")} registradas`,
            accentClassName: "bg-cyan-400",
          },
      ],
      resourceUsage: [
        { label: "CPU", value: Number(cpuMetric?.usagePercent), toneClassName: "bg-sky-500" },
        { label: "Memória", value: Number(memoryMetric?.usedPercent), toneClassName: "bg-emerald-500" },
        { label: "Armazenamento", value: Number(diskMetric?.usedPercent), toneClassName: "bg-amber-500" },
      ],
    };
  }, [availableWidgetIds, dashboard, visibleWidgetIds.length]);
  const cardsById = useMemo(() => {
    const map = new Map<string, ReactNode>();
    const hideHandler = isLayoutEditing ? toggleWidgetVisibilityInEditor : undefined;

    const versionMetric = toMetric(dashboard?.version);
    map.set(
      "version",
      <OperationalDashboardWidget
        id="version"
        title="Versão"
        subtitle={metricStatusLabel(versionMetric)}
        tone={statusTone(versionMetric?.status)}
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[1.55rem] font-semibold leading-none tracking-tight">
              {String(versionMetric?.version || "--")}
            </p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              Build {versionMetric?.buildDate ? formatDateTime(versionMetric.buildDate) : "--"}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
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
        isEditing={isLayoutEditing}
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
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            online
          </span>
        </div>
      </OperationalDashboardWidget>,
    );

    const maintenanceMetric = toMetric(dashboard?.maintenance);
    map.set(
      "maintenance",
      <OperationalDashboardWidget
        id="maintenance"
        title="Manutencao"
        subtitle={metricStatusLabel(maintenanceMetric)}
        tone={maintenanceMetric?.enabled ? "warn" : "modern"}
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`truncate text-[1.55rem] font-bold leading-none tracking-tight ${maintenanceMetric?.enabled ? "text-amber-500" : "text-emerald-400"
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
            <span className="shrink-0 rounded-full border border-amber-300/60 bg-amber-100/70 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        noPadding
      >
        <div className="flex flex-col h-full">
          <div className="px-3 pt-3 flex items-end justify-between">
            <p className="text-4xl font-bold text-blue-400">
              {apiMetric?.avgResponseTimeMs !== null && apiMetric?.avgResponseTimeMs !== undefined
                ? `${apiMetric.avgResponseTimeMs}ms`
                : "--"}
            </p>
            <p className="text-xs text-slate-400 mb-1">Amostras: {String(apiMetric?.sampleSize ?? 0)}</p>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apiData} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} width={70} />
                  <Bar dataKey="latency" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {apiData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.latency > 1000 ? "#ef4444" : entry.latency > 500 ? "#f59e0b" : "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">Sem dados precisos</div>
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        noPadding
      >
        <div className="flex flex-col h-full">
          <div className="px-3 pt-3 flex items-end justify-between">
            <p className="text-4xl font-bold text-blue-400">{formatPercent(cpuMetric?.usagePercent)}</p>
            <p className="text-xs text-slate-400 mb-1">Cores: {String(cpuMetric?.cores ?? "--")}</p>
          </div>
          <div className="flex-1 min-h-0 w-full mt-2">
            {cpuLoadData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
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
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">Sem dados precisos</div>
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
      >
        <div className="flex h-full items-center">
          <div className="flex-1 space-y-1">
            <p className="text-3xl font-bold tracking-tight text-slate-50">{formatPercent(memoryMetric?.usedPercent)}</p>
            <p className="text-xs text-slate-400">Usado: <span className="text-slate-200">{formatBytes(memUsed)}</span></p>
            <p className="text-xs text-slate-400">Total: <span className="text-slate-200">{formatBytes(memoryMetric?.totalBytes)}</span></p>
          </div>
          <div className="h-24 w-24 shrink-0">
            {memUsed > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
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
              </ResponsiveContainer>
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
      >
        <div className="flex h-full items-center">
          <div className="flex-1 space-y-1">
            <p className="text-3xl font-bold tracking-tight text-slate-50">{formatPercent(diskMetric?.usedPercent)}</p>
            <p className="text-xs text-slate-400">Usado: <span className="text-slate-200">{formatBytes(diskUsed)}</span></p>
            <p className="text-xs text-slate-400">Total: <span className="text-slate-200">{formatBytes(diskMetric?.totalBytes)}</span></p>
          </div>
          <div className="h-24 w-24 shrink-0">
            {diskUsed > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
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
              </ResponsiveContainer>
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        <div className="mt-auto flex flex-wrap gap-1.5">
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {String(systemMetric?.platform || "--")}
          </span>
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {String(systemMetric?.release || "--")}
          </span>
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        {databaseMetricState ? (
          <DashboardMetricState metric={databaseMetric} />
        ) : (
          <div className="mt-auto flex items-end justify-between gap-2">
            <div>
              <p className="text-[1.55rem] font-bold leading-none tracking-tight text-emerald-400">
                {databaseMetric?.latencyMs !== null && databaseMetric?.latencyMs !== undefined
                  ? `${databaseMetric.latencyMs}ms`
                  : "--"}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400/80">
                banco
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-100">
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        {redisMetricState ? (
          <DashboardMetricState metric={redisMetric} />
        ) : (
          <div className="mt-auto flex items-end justify-between gap-2">
            <div>
              <p className="text-[1.55rem] font-bold leading-none tracking-tight text-sky-400">
                {redisMetric?.latencyMs !== null && redisMetric?.latencyMs !== undefined
                  ? `${redisMetric.latencyMs}ms`
                  : "--"}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400/80">
                cache
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-100">
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        {workersMetricState ? (
          <DashboardMetricState metric={workersMetric} />
        ) : (
          <div className="mt-auto flex items-end justify-between gap-2">
            <p className="text-[1.7rem] font-bold leading-none tracking-tight text-blue-400/90">
              {String(workersMetric?.activeWorkers ?? workersMetric?.runningJobs ?? "--")}
            </p>
            <div className="text-right">
              <p className="text-[10px] text-slate-400/80">
                Executando: <span className="font-medium text-slate-300">{String(workersMetric?.runningJobs ?? "--")}</span>
              </p>
              <p className="text-[10px] text-slate-400/80">
                Pendentes: <span className="font-medium text-amber-300/80">{String(workersMetric?.pendingJobs ?? "--")}</span>
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        {jobsMetricState ? (
          <DashboardMetricState metric={jobsMetric} />
        ) : (
          <div className="mt-auto flex items-end justify-between gap-2">
            <p className="text-[1.7rem] font-bold leading-none tracking-tight text-blue-400/90">
              {String(jobsMetric?.running ?? "--")}
            </p>
            <div className="text-right">
              <p className="text-[10px] text-slate-400/80">Pendentes: <span className="text-amber-300/80">{String(jobsMetric?.pending ?? "--")}</span></p>
              <p className="text-[10px] text-slate-400/80">Falhas 24h: <span className="text-red-400">{String(jobsMetric?.failedLast24h ?? "--")}</span></p>
            </div>
          </div>
        )}
      </OperationalDashboardWidget>,
    );

    const backupMetric = toMetric(dashboard?.backup);
    const backupMetricState = resolveDashboardMetricState(backupMetric);
    const lastBackup = (backupMetric?.lastBackup || null) as Record<string, unknown> | null;
    const recentBackups = Array.isArray(backupMetric?.recentBackups) ? backupMetric.recentBackups : [];
    map.set(
      "backup",
      <OperationalDashboardWidget
        id="backup"
        title="Ultimo Backup"
        subtitle={metricStatusLabel(backupMetric)}
        tone={statusTone(backupMetric?.status)}
        isEditing={isLayoutEditing}
        onHide={hideHandler}
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
              <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {String(lastBackup.status || "--")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
                {formatBytes(lastBackup.sizeBytes)}
              </span>
              <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
                {formatDurationSeconds(lastBackup.durationSeconds)}
              </span>
              <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
                {lastBackup.finishedAt ? formatDateTime(lastBackup.finishedAt) : "--"}
              </span>
            </div>
            {recentBackups.length > 1 ? (
              <div className="border-t border-slate-200/70 pt-2 dark:border-slate-800/70">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Historico recente
                </p>
                <div className="mt-2 space-y-1.5">
                  {recentBackups.slice(1, 4).map((item, index) => {
                    const row = item as Record<string, unknown>;
                    return (
                      <div
                        key={`${row.id || index}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 px-2.5 py-1.5 text-[11px] dark:border-slate-800/70"
                      >
                        <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                          {String(row.fileName || row.id || "--")}
                        </span>
                        <span className="shrink-0 text-slate-500 dark:text-slate-400">
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
          <p className="text-sm text-muted-foreground">Nenhum backup concluido encontrado.</p>
        )}
      </OperationalDashboardWidget>,
    );

    const errorsMetric = toMetric(dashboard?.errors);
    const errorsMetricState = resolveDashboardMetricState(errorsMetric);
    const recentErrors = Array.isArray(errorsMetric?.recent) ? errorsMetric.recent : [];
    map.set(
      "errors",
      <OperationalDashboardWidget
        id="errors"
        title="Eventos Criticos"
        subtitle={metricStatusLabel(errorsMetric)}
        tone={statusTone(errorsMetric?.status)}
        isEditing={isLayoutEditing}
        onHide={hideHandler}
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
                  className="flex items-center justify-between gap-3 rounded border border-red-200/60 px-2.5 py-2 dark:border-red-900/50"
                >
                  <p className="min-w-0 truncate text-[11px] font-medium text-slate-100">
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
          <p className="text-sm text-muted-foreground">Sem eventos criticos no periodo.</p>
        )}
      </OperationalDashboardWidget>,
    );
    const securityMetric = toMetric(dashboard?.security);
    const securityMetricState = resolveDashboardMetricState(securityMetric);
    const rawDenied = Array.isArray(securityMetric?.deniedAccess) ? securityMetric.deniedAccess : [];
    const deniedData = rawDenied.slice(0, 5).map((item) => {
      const row = item as Record<string, unknown>;
      return {
        ip: String(row.ip || "--"),
        count: Number(row.count || 0),
        lastAt: row.lastAt ? new Date(String(row.lastAt)).getTime() : 0,
      };
    });

    map.set(
      "security",
      <OperationalDashboardWidget
        id="security"
        title="Acessos Negados (Top 5 IPs)"
        subtitle={metricStatusLabel(securityMetric)}
        tone={operationalWidgetTone(securityMetric)}
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        noPadding
      >
        <div className="flex h-full flex-col">
          <div className="px-3 pt-3 flex items-end justify-between">
            <p className="text-3xl font-bold tracking-tight text-slate-50">
              {securityMetricState ? "--" : deniedData.reduce((acc, curr) => acc + curr.count, 0)}
            </p>
            <p className="text-xs text-slate-400 mb-1">Total Negados</p>
          </div>
          <div className="flex-1 min-h-0 w-full mt-4 pr-3 pb-2">
            {securityMetricState ? (
              <div className="flex h-full flex-col px-3 pb-3">
                <DashboardMetricState metric={securityMetric} className="h-full" />
              </div>
            ) : deniedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deniedData} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="ip" type="category" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} width={90} />
                  <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {deniedData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#e11d48" : "#fb7185"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">Nenhuma tentativa negada recente.</div>
            )}
          </div>
        </div>
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
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        <div className="mt-auto flex items-end justify-between gap-2">
          <p className="text-[1.7rem] font-bold leading-none tracking-tight text-blue-400/90">{String(tenantsMetric?.active ?? "--")}</p>
          <div className="text-right text-[10px] text-slate-400/80">
            <p>ativas</p>
            <p>{String(tenantsMetric?.total ?? "--")} total</p>
          </div>
        </div>
      </OperationalDashboardWidget>,
    );

    const notificationsMetric = toMetric(dashboard?.notifications);
    map.set(
      "notifications",
      <OperationalDashboardWidget
        id="notifications"
        title="Notificacoes Criticas"
        subtitle={metricStatusLabel(notificationsMetric)}
        tone="modern"
        isEditing={isLayoutEditing}
        onHide={hideHandler}
        compact
      >
        <div className="mt-auto flex items-end justify-between gap-2">
          <p className="text-[1.7rem] font-bold leading-none tracking-tight text-blue-400/90">
            {String(notificationsMetric?.criticalUnread ?? "--")}
          </p>
          <div className="text-right">
            <p className="text-[10px] text-slate-400/80">Nao lidas</p>
            <p className="text-[10px] text-slate-400/80">
              Recentes no periodo: <span className="text-slate-300 font-medium">{String(notificationsMetric?.criticalRecent ?? "--")}</span>
            </p>
          </div>
        </div>
      </OperationalDashboardWidget>,
    );

    return map;
  }, [dashboard, isLayoutEditing, toggleWidgetVisibilityInEditor]);

  if (!user) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
        <div className="space-y-3">
          <div className="rounded-[24px] border border-slate-900 bg-slate-950 px-4 py-3 text-slate-50 shadow-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex h-7 items-center rounded-full border border-slate-700 bg-slate-900 px-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                      Visao operacional
                    </span>
                  </div>
                  <h1 className="text-lg font-semibold tracking-tight text-white">
                    Dashboard Operacional
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    Snapshot: {dashboard?.generatedAt ? formatDateTime(dashboard.generatedAt) : "--"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    Layout:{" "}
                    {lastLayoutUpdateAt
                      ? `salvo em ${formatDateTime(lastLayoutUpdateAt)}`
                      : "padrao ativo"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    Auto refresh {Math.floor(POLL_INTERVAL_MS / 1000)}s
                  </span>
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
                  label="Abrir filtros"
                  onClick={() => {
                    setDraftFilters(appliedFilters);
                    setIsFiltersOpen(true);
                  }}
                  active={isFiltersOpen || hasAppliedActiveFilters}
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </ToolbarIconButton>

                <ToolbarIconButton
                  label={isLayoutEditing ? "Cancelar edicao de layout" : "Editar layout"}
                  onClick={() => {
                    if (isLayoutEditing) {
                      cancelLayoutEditing();
                      return;
                    }

                    beginLayoutEditing();
                  }}
                  active={isLayoutEditing}
                  disabled={savingLayout}
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
        </div>

        {isLayoutEditing ? (
          <div className="rounded-[28px] border border-blue-200 bg-blue-50/80 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <LayoutGrid className="h-4 w-4" />
                  <p className="text-sm font-semibold">Modo de edicao de layout</p>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Arraste pelos handles dos cards e use o canto inferior direito para
                  redimensionar os blocos. Os atalhos abaixo permitem ocultar ou restaurar
                  widgets antes de salvar.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-slate-300 bg-white/70 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                  onClick={resetLayoutEditing}
                  disabled={savingLayout}
                >
                  <RefreshCw className="h-4 w-4" />
                  Restaurar Padrao
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-slate-300 bg-white/70 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                  onClick={cancelLayoutEditing}
                  disabled={savingLayout}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="gap-2 bg-blue-600 text-white hover:bg-blue-500"
                  onClick={() => {
                    void saveLayoutEditing();
                  }}
                  disabled={!hasPendingLayoutChanges || savingLayout}
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
                      ? "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400 dark:hover:text-slate-200"
                      : "border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-100"
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
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Falha ao carregar o dashboard</p>
              <p className="text-xs text-red-700/90 dark:text-red-200/90">{error}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
          <section className="overflow-hidden rounded-[32px] border border-slate-900 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_30%),radial-gradient(circle_at_right,_rgba(59,130,246,0.24),_transparent_26%),linear-gradient(150deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] px-5 py-5 text-slate-50 shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_220px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                    Panorama
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                    {dashboardOverview.visibleWidgets} cards livres
                  </span>
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
                    hint="Notificações não lidas"
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

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      Saude do painel
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100">
                    <Server className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-3 h-32">
                  {dashboardOverview.statusChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
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
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-white/10 text-[11px] text-slate-400">
                      Sem dados de saude consolidados.
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    {
                      id: "good" as const,
                      label: "Saudavel",
                      value: dashboardOverview.counts.good,
                      color: "bg-emerald-500",
                      items: dashboardOverview.healthDetails.good,
                    },
                    {
                      id: "attention" as const,
                      label: "Atencao",
                      value: dashboardOverview.counts.attention,
                      color: "bg-amber-500",
                      items: dashboardOverview.healthDetails.attention,
                    },
                    {
                      id: "restricted" as const,
                      label: "Restrito",
                      value: dashboardOverview.counts.restricted,
                      color: "bg-slate-500",
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

          <section className="rounded-[32px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_25px_60px_-38px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/45">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Monitoramento do Servidor
                </h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
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

        <div ref={containerRef}>
          {!mounted || (loading && !dashboard) ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando visao operacional...
              </div>
            </div>
          ) : visibleWidgetIds.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
              <div className="flex items-center gap-3 text-sm">
                <Info className="h-4 w-4" />
                Nenhum widget visivel no layout atual.
              </div>
            </div>
          ) : gridWidgetIds.length === 0 ? null : (
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
              dragConfig={{ enabled: isLayoutEditing, handle: ".dashboard-drag-handle" }}
              resizeConfig={{ enabled: isLayoutEditing, handles: ["se"] }}
              allowOverlap={false}
              className={`operational-dashboard-grid ${isLayoutEditing ? "is-editing" : ""}`}
              onLayoutChange={(_: Layout, nextLayouts: ResponsiveLayouts<string>) => {
                if (!isLayoutEditing) {
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

        <div className="flex flex-col gap-2 rounded-[24px] border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-100">Contexto ativo</span>
            <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
              Periodo: {appliedFilters.periodMinutes} min
            </span>
            <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
              Severidade: {appliedFilters.severity === "all" ? "todas" : appliedFilters.severity}
            </span>
            {role === "SUPER_ADMIN" && appliedFilters.tenantId ? (
              <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
                Tenant: {appliedFilters.tenantId}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasAppliedActiveFilters ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Filtros personalizados
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Filtros padrao
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-900">
              {isLayoutEditing ? "Edicao de layout ativa" : "Modo leitura"}
            </span>
          </div>
        </div>
        <Dialog
          open={isFiltersOpen}
          onOpenChange={(open) => {
            if (!open) {
              setDraftFilters(appliedFilters);
            }
            setIsFiltersOpen(open);
          }}
        >
          <DialogContent className="left-auto right-0 top-0 h-[100dvh] max-h-[100dvh] w-full max-w-[28rem] translate-x-0 translate-y-0 gap-0 rounded-none border-l border-border p-0 sm:rounded-none">
            <DialogHeader className="border-b border-border px-5 py-4 text-left">
              <DialogTitle className="text-base font-semibold">Filtros do dashboard</DialogTitle>
              <DialogDescription>
                Ajuste o recorte operacional da visao sem ocupar espaco no grid principal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-5 py-5">
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Periodo</p>
                  <span className="text-[11px] text-muted-foreground">Em minutos</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 60, 180].map((minutes) => (
                    <Button
                      key={minutes}
                      type="button"
                      variant={draftFilters.periodMinutes === minutes ? "default" : "outline"}
                      className="h-9 text-xs"
                      onClick={() =>
                        setDraftFilters((current) => ({ ...current, periodMinutes: minutes }))
                      }
                    >
                      {minutes}
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={draftFilters.periodMinutes}
                  aria-label="Periodo em minutos"
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    setDraftFilters((current) => ({
                      ...current,
                      periodMinutes:
                        Number.isFinite(nextValue) && nextValue >= 5
                          ? Math.floor(nextValue)
                          : current.periodMinutes,
                    }));
                  }}
                />
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium text-foreground">Severidade</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "Todas" },
                    { value: "critical", label: "Criticas" },
                    { value: "warning", label: "Warnings" },
                    { value: "info", label: "Info" },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={draftFilters.severity === option.value ? "default" : "outline"}
                      className="h-9 text-xs"
                      onClick={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          severity: option.value as DashboardFiltersState["severity"],
                        }))
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </section>

              {role === "SUPER_ADMIN" ? (
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Tenant</p>
                    <span className="text-[11px] text-muted-foreground">
                      Opcional para SUPER_ADMIN
                    </span>
                  </div>
                  <Input
                    value={draftFilters.tenantId}
                    aria-label="Filtrar por tenant"
                    placeholder="tenant-id"
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        tenantId: event.target.value.trim(),
                      }))
                    }
                  />
                </section>
              ) : null}
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border px-5 py-4">
              <Button type="button" variant="ghost" onClick={restoreFilterDefaults}>
                Restaurar padrao
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraftFilters(appliedFilters);
                    setIsFiltersOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={!hasDraftFilterChanges || savingLayout}
                  onClick={() => {
                    void applyFilters();
                  }}
                >
                  {savingLayout ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SlidersHorizontal className="h-4 w-4" />
                  )}
                  Aplicar filtros
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider >
  );
}
