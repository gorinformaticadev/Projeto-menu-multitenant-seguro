"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw, Save } from "lucide-react";
import { Responsive, useContainerWidth, type Layout, type Layouts } from "react-grid-layout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  allowedWidgetIdsByRole,
  formatBytes,
  formatDateTime,
  normalizeLayoutForWidgets,
  statusTone,
  type DashboardMetric,
  type DashboardRole,
} from "@/components/operational-dashboard/dashboard.utils";
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
};

type DashboardPayload = {
  generatedAt?: string;
  widgets?: {
    available?: string[];
  };
  [key: string]: unknown;
};

const POLL_INTERVAL_MS = 15000;
const SAVE_DEBOUNCE_MS = 1200;

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

function metricStatusLabel(metric: DashboardMetric | null | undefined): string {
  const status = String(metric?.status || "").toLowerCase();
  if (!status) {
    return "Sem status";
  }
  if (status === "ok") {
    return "OK";
  }
  if (status === "healthy") {
    return "Healthy";
  }
  if (status === "degraded") {
    return "Degradado";
  }
  if (status === "down") {
    return "Down";
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

function toVisibleLayouts(layouts: Layouts, visibleWidgetIds: Set<string>): Layouts {
  const output: Layouts = {};
  for (const [breakpoint, entries] of Object.entries(layouts || {})) {
    output[breakpoint] = (entries || []).filter((entry) => visibleWidgetIds.has(String(entry.i)));
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

export function OperationalDashboard() {
  const { user } = useAuth();
  const role = (user?.role || "USER") as DashboardRole;
  const defaultFilters = useMemo(() => getDefaultFilters(role), [role]);

  const [appliedFilters, setAppliedFilters] = useState<DashboardFiltersState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFiltersState>(defaultFilters);
  const [layouts, setLayouts] = useState<Layouts>(() =>
    normalizeLayoutForWidgets({}, allowedWidgetIdsByRole(role)),
  );
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);
  const [lastLayoutUpdateAt, setLastLayoutUpdateAt] = useState<string | null>(null);

  const { width, mounted, containerRef } = useContainerWidth({ initialWidth: 1280 });

  const loadedLayoutRef = useRef(false);
  const lastSavedSnapshotRef = useRef("");

  const availableWidgetIds = useMemo(() => {
    const fromApi = Array.isArray(dashboard?.widgets?.available)
      ? dashboard?.widgets?.available
          ?.map((item) => String(item || "").trim())
          .filter((item) => item.length > 0)
      : [];
    if (fromApi && fromApi.length > 0) {
      return fromApi;
    }
    return allowedWidgetIdsByRole(role);
  }, [dashboard?.widgets?.available, role]);
  const availableWidgetIdsKey = useMemo(() => availableWidgetIds.join("|"), [availableWidgetIds]);
  const stableAvailableWidgetIds = useMemo(
    () => (availableWidgetIdsKey ? availableWidgetIdsKey.split("|") : []),
    [availableWidgetIdsKey],
  );

  const hasPendingFilterChanges = useMemo(() => {
    return (
      appliedFilters.periodMinutes !== draftFilters.periodMinutes ||
      appliedFilters.severity !== draftFilters.severity ||
      appliedFilters.tenantId !== draftFilters.tenantId
    );
  }, [appliedFilters, draftFilters]);

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
        const message =
          (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (requestError as Error)?.message ||
          "Falha ao carregar dashboard operacional.";
        setError(message);
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

  const loadLayout = useCallback(async () => {
    try {
      const response = await api.get<DashboardLayoutResponse>("/system/dashboard/layout");
      const payload = response.data || {};
      const roleLayout = normalizeLayoutForWidgets(payload.layoutJson, allowedWidgetIdsByRole(role));
      const filtersPayload = payload.filtersJson || {};
      const nextFilters: DashboardFiltersState = {
        periodMinutes:
          Number.isFinite(Number(filtersPayload.periodMinutes)) && Number(filtersPayload.periodMinutes) > 0
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
      setLayouts(roleLayout);
      setAppliedFilters(nextFilters);
      setDraftFilters(nextFilters);
      setHiddenWidgetIds(
        normalizeHiddenWidgetIds(filtersPayload.hiddenWidgetIds, allowedWidgetIdsByRole(role)),
      );
      setLastLayoutUpdateAt(payload.updatedAt || null);
      lastSavedSnapshotRef.current = JSON.stringify({
        layoutJson: roleLayout,
        filtersJson: {
          periodMinutes: nextFilters.periodMinutes,
          tenantId: nextFilters.tenantId || null,
          severity: nextFilters.severity,
          hiddenWidgetIds: normalizeHiddenWidgetIds(
            filtersPayload.hiddenWidgetIds,
            allowedWidgetIdsByRole(role),
          ),
        },
      });
      loadedLayoutRef.current = true;
    } catch {
      setLayouts(normalizeLayoutForWidgets({}, allowedWidgetIdsByRole(role)));
      setAppliedFilters(defaultFilters);
      setDraftFilters(defaultFilters);
      setHiddenWidgetIds([]);
      loadedLayoutRef.current = true;
    }
  }, [defaultFilters, role]);

  useEffect(() => {
    loadedLayoutRef.current = false;
    setAppliedFilters(defaultFilters);
    setDraftFilters(defaultFilters);
    setLayouts(normalizeLayoutForWidgets({}, allowedWidgetIdsByRole(role)));
    setHiddenWidgetIds([]);
    void loadLayout();
  }, [defaultFilters, loadLayout, role]);

  useEffect(() => {
    void refreshDashboard();
    const interval = setInterval(() => {
      void refreshDashboard(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  useEffect(() => {
    setLayouts((current) => normalizeLayoutForWidgets(current, stableAvailableWidgetIds));
  }, [stableAvailableWidgetIds]);

  const persistLayout = useCallback(async () => {
    if (!loadedLayoutRef.current) {
      return;
    }

    const snapshotPayload = {
      layoutJson: layouts,
      filtersJson: {
        ...appliedFilters,
        hiddenWidgetIds,
      },
    };
    const snapshot = JSON.stringify(snapshotPayload);
    if (!snapshot || snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    setSavingLayout(true);
    try {
      const response = await api.put<DashboardLayoutResponse>("/system/dashboard/layout", snapshotPayload);
      lastSavedSnapshotRef.current = snapshot;
      setLastLayoutUpdateAt(response.data?.updatedAt || new Date().toISOString());
    } catch {
      // Silent by design: layout persistence should not break dashboard operation.
    } finally {
      setSavingLayout(false);
    }
  }, [appliedFilters, hiddenWidgetIds, layouts]);

  useEffect(() => {
    if (!loadedLayoutRef.current) {
      return;
    }
    const timeout = setTimeout(() => {
      void persistLayout();
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [appliedFilters, hiddenWidgetIds, layouts, persistLayout]);

  const handleHideWidget = useCallback((id: string) => {
    setHiddenWidgetIds((previous) => {
      if (previous.includes(id)) {
        return previous;
      }
      return [...previous, id];
    });
  }, []);

  const handleWidgetVisibilityToggle = useCallback((id: string) => {
    setHiddenWidgetIds((previous) => {
      if (previous.includes(id)) {
        return previous.filter((item) => item !== id);
      }
      return [...previous, id];
    });
  }, []);

  const visibleWidgetIds = useMemo(() => {
    const hiddenSet = new Set(hiddenWidgetIds);
    return stableAvailableWidgetIds.filter((id) => !hiddenSet.has(id));
  }, [stableAvailableWidgetIds, hiddenWidgetIds]);

  const visibleWidgetSet = useMemo(() => new Set(visibleWidgetIds), [visibleWidgetIds]);
  const layoutsForRender = useMemo(() => toVisibleLayouts(layouts, visibleWidgetSet), [layouts, visibleWidgetSet]);

  const cardsById = useMemo(() => {
    const map = new Map<string, ReactNode>();

    const versionMetric = toMetric(dashboard?.version);
    map.set(
      "version",
      <OperationalDashboardWidget
        id="version"
        title="Versao"
        subtitle={metricStatusLabel(versionMetric)}
        tone={statusTone(versionMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-1">
          <p className="text-2xl font-semibold">{String(versionMetric?.version || "--")}</p>
          <p className="text-xs text-muted-foreground">Commit: {String(versionMetric?.commitSha || "--")}</p>
          <p className="text-xs text-muted-foreground">
            Build: {versionMetric?.buildDate ? formatDateTime(versionMetric.buildDate) : "--"}
          </p>
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
        onHide={handleHideWidget}
      >
        <div className="space-y-2">
          <p className="text-2xl font-semibold">{String(uptimeMetric?.human || "--")}</p>
          <p className="text-xs text-muted-foreground">
            Inicio: {uptimeMetric?.startedAt ? formatDateTime(uptimeMetric.startedAt) : "--"}
          </p>
        </div>
      </OperationalDashboardWidget>,
    );

    const maintenanceMetric = toMetric(dashboard?.maintenance);
    map.set(
      "maintenance",
      <OperationalDashboardWidget
        id="maintenance"
        title="Maintenance"
        subtitle={metricStatusLabel(maintenanceMetric)}
        tone={maintenanceMetric?.enabled ? "warn" : "good"}
        onHide={handleHideWidget}
      >
        <div className="space-y-2">
          <p className="text-xl font-semibold">{maintenanceMetric?.enabled ? "Ativo" : "Inativo"}</p>
          <p className="text-xs text-muted-foreground">
            Motivo: {String(maintenanceMetric?.reason || "Nao informado")}
          </p>
          <p className="text-xs text-muted-foreground">
            ETA (seg): {String(maintenanceMetric?.etaSeconds ?? "--")}
          </p>
        </div>
      </OperationalDashboardWidget>,
    );

    const apiMetric = toMetric(dashboard?.api);
    map.set(
      "api",
      <OperationalDashboardWidget
        id="api"
        title="API"
        subtitle={metricStatusLabel(apiMetric)}
        tone={statusTone(apiMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-2">
          <p className="text-2xl font-semibold">
            {apiMetric?.avgResponseTimeMs !== null && apiMetric?.avgResponseTimeMs !== undefined
              ? `${apiMetric.avgResponseTimeMs} ms`
              : "--"}
          </p>
          <p className="text-xs text-muted-foreground">Amostras: {String(apiMetric?.sampleSize ?? 0)}</p>
          <p className="text-xs text-muted-foreground">Janela: {String(apiMetric?.windowSeconds ?? "--")}s</p>
        </div>
      </OperationalDashboardWidget>,
    );

    const cpuMetric = toMetric(dashboard?.cpu);
    map.set(
      "cpu",
      <OperationalDashboardWidget
        id="cpu"
        title="CPU"
        subtitle={metricStatusLabel(cpuMetric)}
        tone={statusTone(cpuMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-2">
          <p className="text-2xl font-semibold">{formatPercent(cpuMetric?.usagePercent)}</p>
          <p className="text-xs text-muted-foreground">Cores: {String(cpuMetric?.cores ?? "--")}</p>
          <p className="text-xs text-muted-foreground">
            Load avg: {Array.isArray(cpuMetric?.loadAvg) ? cpuMetric?.loadAvg?.join(", ") : "--"}
          </p>
        </div>
      </OperationalDashboardWidget>,
    );

    const memoryMetric = toMetric(dashboard?.memory);
    map.set(
      "memory",
      <OperationalDashboardWidget
        id="memory"
        title="Memoria"
        subtitle={metricStatusLabel(memoryMetric)}
        tone={statusTone(memoryMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-1">
          <p className="text-xl font-semibold">
            {formatBytes(memoryMetric?.usedBytes)} / {formatBytes(memoryMetric?.totalBytes)}
          </p>
          <p className="text-xs text-muted-foreground">Livre: {formatBytes(memoryMetric?.freeBytes)}</p>
          <p className="text-xs text-muted-foreground">Uso: {formatPercent(memoryMetric?.usedPercent)}</p>
        </div>
      </OperationalDashboardWidget>,
    );

    const diskMetric = toMetric(dashboard?.disk);
    map.set(
      "disk",
      <OperationalDashboardWidget
        id="disk"
        title="Disco"
        subtitle={metricStatusLabel(diskMetric)}
        tone={statusTone(diskMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-1">
          <p className="text-xl font-semibold">
            {formatBytes(diskMetric?.usedBytes)} / {formatBytes(diskMetric?.totalBytes)}
          </p>
          <p className="text-xs text-muted-foreground">Livre: {formatBytes(diskMetric?.freeBytes)}</p>
          <p className="text-xs text-muted-foreground">Uso: {formatPercent(diskMetric?.usedPercent)}</p>
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
        onHide={handleHideWidget}
      >
        <div className="space-y-1">
          <p className="text-xl font-semibold">{String(systemMetric?.platform || "--")}</p>
          <p className="text-xs text-muted-foreground">
            Release: {String(systemMetric?.release || "--")} ({String(systemMetric?.arch || "--")})
          </p>
          <p className="text-xs text-muted-foreground">Node: {String(systemMetric?.nodeVersion || "--")}</p>
        </div>
      </OperationalDashboardWidget>,
    );

    const databaseMetric = toMetric(dashboard?.database);
    map.set(
      "database",
      <OperationalDashboardWidget
        id="database"
        title="Banco"
        subtitle={metricStatusLabel(databaseMetric)}
        tone={statusTone(databaseMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-2">
          <p className="text-2xl font-semibold">{String(databaseMetric?.status || "--")}</p>
          <p className="text-xs text-muted-foreground">
            Latencia: {databaseMetric?.latencyMs !== null && databaseMetric?.latencyMs !== undefined ? `${databaseMetric.latencyMs} ms` : "--"}
          </p>
        </div>
      </OperationalDashboardWidget>,
    );

    const redisMetric = toMetric(dashboard?.redis);
    map.set(
      "redis",
      <OperationalDashboardWidget
        id="redis"
        title="Redis"
        subtitle={metricStatusLabel(redisMetric)}
        tone={statusTone(redisMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-2">
          <p className="text-2xl font-semibold">{String(redisMetric?.status || "--")}</p>
          <p className="text-xs text-muted-foreground">
            Latencia: {redisMetric?.latencyMs !== null && redisMetric?.latencyMs !== undefined ? `${redisMetric.latencyMs} ms` : "--"}
          </p>
        </div>
      </OperationalDashboardWidget>,
    );

    const workersMetric = toMetric(dashboard?.workers);
    map.set(
      "workers",
      <OperationalDashboardWidget
        id="workers"
        title="Workers"
        subtitle={metricStatusLabel(workersMetric)}
        tone={statusTone(workersMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-1">
          <p className="text-xl font-semibold">Ativos: {String(workersMetric?.activeWorkers ?? workersMetric?.runningJobs ?? "--")}</p>
          <p className="text-xs text-muted-foreground">Executando: {String(workersMetric?.runningJobs ?? "--")}</p>
          <p className="text-xs text-muted-foreground">Pendentes: {String(workersMetric?.pendingJobs ?? "--")}</p>
        </div>
      </OperationalDashboardWidget>,
    );

    const jobsMetric = toMetric(dashboard?.jobs);
    map.set(
      "jobs",
      <OperationalDashboardWidget
        id="jobs"
        title="Jobs"
        subtitle={metricStatusLabel(jobsMetric)}
        tone={statusTone(jobsMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-1">
          <p className="text-xl font-semibold">Running: {String(jobsMetric?.running ?? "--")}</p>
          <p className="text-xs text-muted-foreground">Pending: {String(jobsMetric?.pending ?? "--")}</p>
          <p className="text-xs text-muted-foreground">Falhas 24h: {String(jobsMetric?.failedLast24h ?? "--")}</p>
        </div>
      </OperationalDashboardWidget>,
    );

    const backupMetric = toMetric(dashboard?.backup);
    const lastBackup = (backupMetric?.lastBackup || null) as Record<string, unknown> | null;
    map.set(
      "backup",
      <OperationalDashboardWidget
        id="backup"
        title="Ultimo Backup"
        subtitle={metricStatusLabel(backupMetric)}
        tone={statusTone(backupMetric?.status)}
        onHide={handleHideWidget}
      >
        {lastBackup ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold">{String(lastBackup.fileName || lastBackup.id || "--")}</p>
            <p className="text-xs text-muted-foreground">Status: {String(lastBackup.status || "--")}</p>
            <p className="text-xs text-muted-foreground">Tamanho: {formatBytes(lastBackup.sizeBytes)}</p>
            <p className="text-xs text-muted-foreground">
              Finalizado: {lastBackup.finishedAt ? formatDateTime(lastBackup.finishedAt) : "--"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum backup concluido encontrado.</p>
        )}
      </OperationalDashboardWidget>,
    );

    const errorsMetric = toMetric(dashboard?.errors);
    const recentErrors = Array.isArray(errorsMetric?.recent) ? errorsMetric.recent : [];
    map.set(
      "errors",
      <OperationalDashboardWidget
        id="errors"
        title="Erros Criticos"
        subtitle={metricStatusLabel(errorsMetric)}
        tone={statusTone(errorsMetric?.status)}
        onHide={handleHideWidget}
      >
        {recentErrors.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-auto pr-1">
            {recentErrors.slice(0, 5).map((item, index) => {
              const row = item as Record<string, unknown>;
              return (
                <div key={`${row.id || index}`} className="rounded border border-red-200/60 dark:border-red-900/50 px-2 py-1">
                  <p className="text-xs font-semibold truncate">{String(row.action || "--")}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{String(row.message || "--")}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDateTime(row.createdAt)}</p>
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
    const denied = Array.isArray(securityMetric?.deniedAccess) ? securityMetric.deniedAccess : [];
    map.set(
      "security",
      <OperationalDashboardWidget
        id="security"
        title="Acessos Negados"
        subtitle={metricStatusLabel(securityMetric)}
        tone={statusTone(securityMetric?.status)}
        onHide={handleHideWidget}
      >
        {denied.length > 0 ? (
          <div className="space-y-1 max-h-40 overflow-auto pr-1">
            {denied.slice(0, 5).map((item, index) => {
              const row = item as Record<string, unknown>;
              return (
                <div key={`${row.ip || index}`} className="flex items-center justify-between text-xs border-b border-border/70 pb-1">
                  <span className="truncate max-w-[50%]">{String(row.ip || "--")}</span>
                  <span className="text-muted-foreground">x{String(row.count || 0)}</span>
                  <span className="text-muted-foreground">{formatDateTime(row.lastAt)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma tentativa negada recente.</p>
        )}
      </OperationalDashboardWidget>,
    );

    const tenantsMetric = toMetric(dashboard?.tenants);
    map.set(
      "tenants",
      <OperationalDashboardWidget
        id="tenants"
        title="Tenants"
        subtitle={metricStatusLabel(tenantsMetric)}
        tone={statusTone(tenantsMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-1">
          <p className="text-2xl font-semibold">{String(tenantsMetric?.active ?? "--")}</p>
          <p className="text-xs text-muted-foreground">Ativas / total: {String(tenantsMetric?.active ?? "--")} / {String(tenantsMetric?.total ?? "--")}</p>
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
        tone={statusTone(notificationsMetric?.status)}
        onHide={handleHideWidget}
      >
        <div className="space-y-1">
          <p className="text-2xl font-semibold">{String(notificationsMetric?.criticalUnread ?? "--")}</p>
          <p className="text-xs text-muted-foreground">
            Nao lidas
          </p>
          <p className="text-xs text-muted-foreground">
            Recentes no periodo: {String(notificationsMetric?.criticalRecent ?? "--")}
          </p>
        </div>
      </OperationalDashboardWidget>,
    );

    return map;
  }, [dashboard, handleHideWidget]);

  if (!user) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Operacional</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Monitoramento modular da plataforma com layout persistido por role.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void refreshDashboard(true);
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void persistLayout();
              }}
              disabled={savingLayout}
            >
              {savingLayout ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar layout
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Periodo</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={draftFilters.periodMinutes}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  periodMinutes: Number(event.target.value),
                }))
              }
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={360}>6 horas</option>
              <option value={1440}>24 horas</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Severidade</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={draftFilters.severity}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  severity: event.target.value as DashboardFiltersState["severity"],
                }))
              }
            >
              <option value="all">Todas</option>
              <option value="critical">Criticas</option>
              <option value="warning">Warnings</option>
              <option value="info">Informativas</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tenant (opcional)</span>
            <Input
              value={draftFilters.tenantId}
              placeholder="Filtrar por tenantId"
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  tenantId: event.target.value,
                }))
              }
              disabled={role !== "SUPER_ADMIN"}
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Layout</span>
            <p className="text-xs text-muted-foreground h-9 flex items-center">
              {lastLayoutUpdateAt ? `Atualizado em ${formatDateTime(lastLayoutUpdateAt)}` : "Layout padrao ativo"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setAppliedFilters(draftFilters);
            }}
            disabled={!hasPendingFilterChanges}
          >
            Aplicar filtros
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDraftFilters(appliedFilters);
            }}
            disabled={!hasPendingFilterChanges}
          >
            Descartar edicao
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {stableAvailableWidgetIds.map((id) => {
            const hidden = hiddenWidgetIds.includes(id);
            return (
              <Button
                key={id}
                type="button"
                variant={hidden ? "outline" : "default"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleWidgetVisibilityToggle(id)}
              >
                {hidden ? `Mostrar ${id}` : `Ocultar ${id}`}
              </Button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-red-700 dark:text-red-300" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">Falha ao carregar dashboard</p>
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="h-60 rounded-xl border border-border bg-card flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando dados operacionais...
        </div>
      ) : (
        <div ref={containerRef}>
          {mounted ? (
            <Responsive
              className="operational-dashboard-grid"
              width={width}
              layouts={layoutsForRender}
              breakpoints={{ lg: 1280, md: 920, sm: 0 }}
              cols={{ lg: 4, md: 2, sm: 1 }}
              rowHeight={190}
              margin={[12, 12]}
              isResizable={false}
              onLayoutChange={(_currentLayout: Layout[], allLayouts: Layouts) => {
                setLayouts(allLayouts);
              }}
            >
              {visibleWidgetIds.map((id) => (
                <div key={id} className="h-full">
                  {cardsById.get(id) || (
                    <OperationalDashboardWidget id={id} title={id} onHide={handleHideWidget}>
                      <p className="text-sm text-muted-foreground">Widget sem renderer.</p>
                    </OperationalDashboardWidget>
                  )}
                </div>
              ))}
            </Responsive>
          ) : (
            <div className="h-60 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground">
              Ajustando largura do grid...
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Atualizacao automatica a cada {Math.floor(POLL_INTERVAL_MS / 1000)}s.</span>
        <span>Snapshot: {dashboard?.generatedAt ? formatDateTime(dashboard.generatedAt) : "--"}</span>
      </div>
    </div>
  );
}
