"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SVGProps } from "react";
import type {
  DashboardLayoutResponse,
  DashboardModuleCard,
} from "@contracts/dashboard";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  KanbanSquare,
  LayoutGrid,
  ListTodo,
  Loader2,
  Package2,
  Pin,
  Rows3,
  RefreshCw,
  X,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
  Responsive,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from "react-grid-layout";
import { getSystemDashboardLayout, getSystemDashboardModuleCards, saveSystemDashboardLayout } from "@/lib/contracts/dashboard-client";
import {
  CONTRACT_DEGRADATION_EVENT_NAME,
  executeContractRequestWithRetry,
  isContractValidationError,
  isTransientRequestError,
  type ContractVersionDowngradeDetail,
} from "@/lib/contracts/contract-runtime";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DashboardSurfaceState,
} from "@/components/operational-dashboard/DashboardMetricState";
import {
  dashboardGridBreakpoints,
  dashboardGridCols,
  dashboardGridRowHeight,
  isDashboardMobileViewport,
  normalizeLayoutForWidgets,
  type DashboardRole,
} from "@/components/operational-dashboard/dashboard.utils";
import {
  OperationalDashboardWidget,
  OperationalDashboardWidgetSkeleton,
} from "@/components/operational-dashboard/OperationalDashboardWidget";
import {
  OperationalDashboard,
  type OperationalDashboardFiltersState,
} from "@/components/operational-dashboard/OperationalDashboard";

type Layouts = ReturnType<typeof normalizeLayoutForWidgets>;
type ModuleCardItem = DashboardModuleCard;

type OperationalOverviewCard = {
  id: "operationalOverview";
  title: string;
  description: string;
  module: "core";
  visibilityRole: DashboardRole;
  kind: "summary";
  icon: string;
  href: null;
  actionLabel: string;
  size: "large";
  stats: Array<{ label: string; value: string }>;
  items: Array<{ id: string; label: string; value?: string }>;
};

type MainDashboardCard = ModuleCardItem;

const OPERATIONAL_OVERVIEW_CARD_ID = "operationalOverview";
const DASHBOARD_HOME_SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_HOME_STALE_REFRESH_RETRY_MS = 15_000;
const legacyCoreDashboardCardIds = new Set([
  "module:core:welcome-widget",
  "module:core:stats-widget",
]);

type LucideIconComponent = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

function resolveDashboardIcon(name?: string | null): LucideIconComponent {
  const iconName = String(name || "").trim();
  const icons = LucideIcons as unknown as Record<string, LucideIconComponent>;
  return icons[iconName] || Package2;
}

function getDefaultOperationalFilters(role: DashboardRole): OperationalDashboardFiltersState {
  return {
    periodMinutes: role === "SUPER_ADMIN" ? 60 : 30,
    tenantId: "",
    severity: "all",
  };
}

function normalizeStoredFilters(
  role: DashboardRole,
  rawFilters?: DashboardLayoutResponse["filtersJson"],
): OperationalDashboardFiltersState {
  const fallback = getDefaultOperationalFilters(role);
  const periodMinutes = Number(rawFilters?.periodMinutes);

  return {
    periodMinutes:
      Number.isFinite(periodMinutes) && periodMinutes >= 5
        ? Math.floor(periodMinutes)
        : fallback.periodMinutes,
    tenantId: role === "SUPER_ADMIN" ? String(rawFilters?.tenantId || "") : "",
    severity:
      rawFilters?.severity === "info" ||
      rawFilters?.severity === "warning" ||
      rawFilters?.severity === "critical"
        ? rawFilters.severity
        : "all",
  };
}

function normalizeStoredOperationalPinned(
  role: DashboardRole,
  rawFilters?: DashboardLayoutResponse["filtersJson"],
): boolean {
  return role === "SUPER_ADMIN" && rawFilters?.operationalPinned === true;
}

function cloneLayouts(layouts: Layouts): Layouts {
  const output: Layouts = {};
  for (const [breakpoint, entries] of Object.entries(layouts)) {
    output[breakpoint] = entries.map((entry) => ({ ...entry }));
  }
  return output;
}

function normalizeMainHiddenCardIds(value: unknown, availableCardIds: string[]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set(
    availableCardIds.filter((cardId) => cardId !== OPERATIONAL_OVERVIEW_CARD_ID),
  );

  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0 && allowed.has(item));
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

function buildLayoutComparisonSnapshot(layouts: Layouts, hiddenCardIds: string[]): string {
  return JSON.stringify({
    layoutJson: layouts,
    hiddenCardIds: [...hiddenCardIds].sort(),
  });
}

function normalizeDashboardHomeCards(cards: ModuleCardItem[]): ModuleCardItem[] {
  return cards.filter((card) => !legacyCoreDashboardCardIds.has(String(card.id || "").trim()));
}

function normalizeErrorMessage(error: unknown): string {
  const message =
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (error as Error)?.message ||
    "Erro desconhecido.";
  return String(message);
}

function resolveDashboardActorStorageId(user: unknown): string {
  if (!user || typeof user !== "object") {
    return "anonymous";
  }

  const row = user as Record<string, unknown>;
  const candidate = String(row.id || row.sub || row.email || "").trim();
  return candidate || "anonymous";
}

function buildOperationalPinnedStorageKey(actorId: string, role: DashboardRole): string {
  return `dashboard-home:operational-pinned:${actorId}:${role}`;
}

function readOperationalPinnedFromStorage(storageKey: string | null): boolean | null {
  if (!storageKey || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
  } catch {
    return null;
  }

  return null;
}

function writeOperationalPinnedToStorage(storageKey: string | null, value: boolean) {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, value ? "true" : "false");
  } catch {
    // Ignora indisponibilidade de storage local sem quebrar o dashboard.
  }
}

function formatSnapshotAgeLabel(timestamp: number): string {
  const ageMs = Math.max(0, Date.now() - timestamp);
  const ageSeconds = Math.floor(ageMs / 1000);
  if (ageSeconds < 60) {
    return `${ageSeconds}s`;
  }

  return `${Math.floor(ageSeconds / 60)}min`;
}

function DashboardShellActionButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`h-11 w-11 rounded-xl border transition-all ${active
          ? "border-skin-primary bg-skin-primary text-skin-text-inverse hover:bg-skin-primary-hover hover:text-skin-text-inverse"
          : "border-skin-border/80 bg-skin-surface/90 text-skin-text-muted hover:border-skin-border-strong hover:bg-skin-surface hover:text-skin-text"
        }`}
    >
      {children}
    </Button>
  );
}

function DashboardHomeSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`dashboard-home-skeleton-${index}`}>
          <OperationalDashboardWidgetSkeleton compact={index > 0} />
        </div>
      ))}
    </div>
  );
}

function getToneClassName(
  tone?: "neutral" | "good" | "warn" | "danger",
): string {
  if (tone === "good") {
    return "border-skin-success/30 bg-skin-success/10 text-skin-success";
  }
  if (tone === "warn") {
    return "border-skin-warning/30 bg-skin-warning/10 text-skin-warning";
  }
  if (tone === "danger") {
    return "border-skin-danger/30 bg-skin-danger/10 text-skin-danger";
  }
  return "border-skin-border/80 bg-skin-background-elevated/80 text-skin-text";
}

function isPlatformHomeCard(card: MainDashboardCard): boolean {
  return card.id === "platform:welcome" || card.id === "platform:statistics";
}

function ModuleCardBody({ card }: { card: MainDashboardCard }) {
  const stats = Array.isArray(card.stats) ? card.stats : [];
  const items = Array.isArray(card.items) ? card.items : [];

  if (card.id === OPERATIONAL_OVERVIEW_CARD_ID) {
    return (
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className="text-[1.95rem] font-bold tracking-tight text-skin-primary/95">
            SUPER_ADMIN
          </p>
          <p className="mt-2 text-sm leading-relaxed text-skin-text-muted">
            Expanda esta area para acessar panorama, telemetria, seguranca e a grade operacional.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={`operational-overview-stat-${stat.label}`}
              className="rounded-[18px] border border-white/10 bg-white/5 px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-skin-text-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-skin-text">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isPlatformHomeCard(card)) {
    const statsGridClassName =
      stats.length >= 4
        ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
        : "grid gap-2 sm:grid-cols-3";

    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto pr-1">
        {card.description ? (
          <div className="rounded-[16px] border border-skin-border/80 bg-skin-background-elevated/70 px-3 py-2.5 ">
            <p className="text-[13px] leading-relaxed text-skin-text">
              {card.description}
            </p>
          </div>
        ) : null}

        {stats.length > 0 ? (
          <div className={statsGridClassName}>
            {stats.slice(0, 4).map((stat) => (
              <div
                key={`${card.id}-${stat.label}`}
                className="rounded-[16px] border border-skin-border/80 bg-skin-background-elevated/70 px-3 py-2.5 "
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-skin-text-muted">
                  {stat.label}
                </p>
                <p className="mt-1 break-words text-sm font-semibold tracking-tight text-skin-text">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className={`rounded-[16px] border px-3 py-2.5 ${getToneClassName(item.tone)}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                  {item.label}
                </p>
                {item.value ? (
                  <p className="mt-1 break-words text-[13px] leading-relaxed">
                    {item.value}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (card.kind === "kanban") {
    const columnMap = new Map<string, typeof items>();
    for (const item of items) {
      const column = String(item.column || "Backlog").trim() || "Backlog";
      const bucket = columnMap.get(column) || [];
      bucket.push(item);
      columnMap.set(column, bucket);
    }

    const columns = Array.from(columnMap.entries());

    return (
      <div className="flex h-full flex-col gap-3">
        {stats.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {stats.slice(0, 4).map((stat) => (
              <div
                key={`${card.id}-${stat.label}`}
                className="rounded-[16px] border border-skin-border/80 bg-skin-background-elevated/70 px-3 py-2 "
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-skin-text-muted">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-skin-text">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {columns.length === 0 ? (
          <DashboardSurfaceState
            title="Sem dados"
            description="Nenhum item disponivel neste modulo."
            className="mt-auto"
            centered
          />
        ) : (
          <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-2">
            {columns.map(([column, columnItems]) => (
              <div
                key={`${card.id}-${column}`}
                className="flex min-h-[9rem] flex-col rounded-[18px] border border-skin-border/80 bg-skin-background-elevated/70 p-3 /80 /40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-skin-text">
                    {column}
                  </p>
                  <span className="rounded-full bg-skin-surface px-2 py-0.5 text-[10px] font-medium text-skin-text-muted">
                    {columnItems.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2 overflow-auto pr-1">
                  {columnItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-[14px] border px-2.5 py-2 text-xs ${getToneClassName(item.tone)}`}
                    >
                      <p className="font-medium">{item.label}</p>
                      {item.value ? (
                        <p className="mt-1 opacity-80">{item.value}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (card.kind === "list") {
    return (
      <div className="flex h-full flex-col gap-3">
        {stats.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {stats.slice(0, 4).map((stat) => (
              <div
                key={`${card.id}-${stat.label}`}
                className="rounded-[16px] border border-skin-border/80 bg-skin-background-elevated/70 px-3 py-2 "
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-skin-text-muted">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-skin-text">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {items.length === 0 ? (
          <DashboardSurfaceState
            title="Sem itens"
            description={card.description || "Este modulo ainda nao publicou detalhes adicionais."}
            centered
            className="mt-auto"
          />
        ) : (
          <div className="mt-auto space-y-2 overflow-auto pr-1">
            {items.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 rounded-[16px] border px-3 py-2.5 ${getToneClassName(item.tone)}`}
              >
                <span className="min-w-0 truncate text-sm font-medium">{item.label}</span>
                {item.value ? (
                  <span className="shrink-0 text-xs opacity-80">{item.value}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (stats.length === 0 && items.length === 0) {
    return (
      <DashboardSurfaceState
        title="Modulo ativo"
        description={card.description || "Este modulo pode publicar cards neste dashboard."}
        centered
        className="mt-auto"
      />
    );
  }

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {stats.slice(0, 4).map((stat) => (
          <div
            key={`${card.id}-${stat.label}`}
            className="rounded-[18px] border border-skin-border/80 bg-skin-background-elevated/70 px-3 py-2.5 "
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-skin-text-muted">
              {stat.label}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-skin-text">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-[16px] border px-3 py-2 ${getToneClassName(item.tone)}`}
            >
              <span className="min-w-0 truncate text-sm font-medium">{item.label}</span>
              {item.value ? (
                <span className="shrink-0 text-xs opacity-80">{item.value}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DashboardHome() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const role = (user?.role || "USER") as DashboardRole;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const actorStorageId = useMemo(() => resolveDashboardActorStorageId(user), [user]);
  const operationalPinnedStorageKey = useMemo(
    () => buildOperationalPinnedStorageKey(actorStorageId, role),
    [actorStorageId, role],
  );
  const defaultFilters = useMemo(() => getDefaultOperationalFilters(role), [role]);
  const homeSnapshotKey = useMemo(() => `${actorStorageId}:${role}`, [actorStorageId, role]);

  const [moduleCards, setModuleCards] = useState<ModuleCardItem[]>([]);
  const [layouts, setLayouts] = useState<Layouts>(() => normalizeLayoutForWidgets({}, []));
  const [editingLayouts, setEditingLayouts] = useState<Layouts>(() => normalizeLayoutForWidgets({}, []));
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([]);
  const [editingHiddenCardIds, setEditingHiddenCardIds] = useState<string[]>([]);
  const [operationalFilters, setOperationalFilters] = useState<OperationalDashboardFiltersState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLayoutUpdateAt, setLastLayoutUpdateAt] = useState<string | null>(null);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [operationalExpanded, setOperationalExpanded] = useState(false);
  const [operationalPinned, setOperationalPinned] = useState(false);
  const [contractDegradationMessage, setContractDegradationMessage] = useState<string | null>(null);
  const [staleSnapshotAt, setStaleSnapshotAt] = useState<number | null>(null);
  const staleSnapshotActive = staleSnapshotAt !== null;

  const layoutRequestIdRef = useRef(0);
  const operationalPreferenceInitializedRef = useRef(false);
  const lastSuccessfulHomeStateRef = useRef<{
    key: string;
    capturedAt: number;
    moduleCards: ModuleCardItem[];
    layouts: Layouts;
    hiddenCardIds: string[];
    operationalFilters: OperationalDashboardFiltersState;
    operationalPinned: boolean;
    operationalExpanded: boolean;
    lastLayoutUpdateAt: string | null;
  } | null>(null);

  const { width, mounted, containerRef } = useContainerWidth({ initialWidth: 1280 });
  const isMobileViewport = isDashboardMobileViewport(width);
  const canEditLayout = !isMobileViewport;
  const layoutEditingActive = canEditLayout && isLayoutEditing;

  const operationalCard = useMemo<OperationalOverviewCard | null>(() => {
    if (!isSuperAdmin) {
      return null;
    }

    return {
      id: OPERATIONAL_OVERVIEW_CARD_ID,
      title: "Dashboard Operacional",
      description: "Visao operacional recolhida por padrao.",
      module: "core",
      visibilityRole: "SUPER_ADMIN",
      kind: "summary",
      icon: "Activity",
      href: null,
      actionLabel: operationalPinned ? "Fixado" : operationalExpanded ? "Recolher" : "Abrir",
      size: "large",
      stats: [],
      items: [],
    };
  }, [isSuperAdmin, operationalExpanded, operationalPinned]);

  const cards = useMemo<MainDashboardCard[]>(() => [...moduleCards], [moduleCards]);

  const availableCardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const availableCardIdsKey = useMemo(() => availableCardIds.join("|"), [availableCardIds]);
  const stableAvailableCardIds = useMemo(
    () => (availableCardIdsKey ? availableCardIdsKey.split("|") : []),
    [availableCardIdsKey],
  );
  const activeHiddenCardIds = layoutEditingActive ? editingHiddenCardIds : hiddenCardIds;

  const visibleCardIds = useMemo(() => {
    const hiddenSet = new Set(activeHiddenCardIds);
    return stableAvailableCardIds.filter((cardId) => !hiddenSet.has(cardId));
  }, [activeHiddenCardIds, stableAvailableCardIds]);

  const layoutsForRender = useMemo(() => {
    const visibleSet = new Set(visibleCardIds);
    const source = layoutEditingActive ? editingLayouts : layouts;
    const output: Layouts = {};
    for (const [breakpoint, entries] of Object.entries(source)) {
      output[breakpoint] = entries.filter((entry) => visibleSet.has(String(entry.i)));
    }
    return output;
  }, [editingLayouts, layoutEditingActive, layouts, visibleCardIds]);

  const showInitialSkeleton = !mounted || (loading && cards.length === 0);

  const cardsById = useMemo(() => {
    const map = new Map<string, ReactNode>();

    for (const card of cards) {
      const Icon = card.kind === "kanban"
        ? KanbanSquare
        : card.kind === "list"
          ? ListTodo
          : resolveDashboardIcon(card.icon);
      const onSelect = card.href ? () => router.push(card.href) : undefined;

      map.set(
        card.id,
        <OperationalDashboardWidget
          key={card.id}
          id={card.id}
          title={card.title}
          subtitle={isPlatformHomeCard(card) ? undefined : card.description || undefined}
          tone="neutral"
          headerIcon={<Icon className="h-4 w-4" />}
          compact={card.size === "small" || isPlatformHomeCard(card)}
          isEditing={layoutEditingActive}
          onHide={(id) => {
            setEditingHiddenCardIds((current) => {
              if (current.includes(id)) {
                return current;
              }
              return [...current, id];
            });
          }}
          onSelect={onSelect}
          actionLabel={card.actionLabel || (card.href ? "Abrir modulo" : undefined)}
        >
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-start justify-end gap-3">
              <span className="rounded-full bg-skin-background-elevated px-2.5 py-1 text-[10px] font-medium text-skin-text-muted">
                {card.kind === "kanban" ? "Kanban" : card.kind === "list" ? "Lista" : "Resumo"}
              </span>
            </div>
            <ModuleCardBody card={card} />
          </div>
        </OperationalDashboardWidget>,
      );
    }

    return map;
  }, [cards, layoutEditingActive, router]);

  const persistDashboardLayout = useCallback(
    async (
      nextLayouts: Layouts,
      nextFilters: OperationalDashboardFiltersState,
      nextHiddenCardIds: string[],
      nextOperationalPinned: boolean,
    ): Promise<boolean> => {
      setSavingLayout(true);

      try {
        const response = await saveSystemDashboardLayout({
          layoutJson: nextLayouts,
          filtersJson: {
            periodMinutes: nextFilters.periodMinutes,
            tenantId: nextFilters.tenantId || null,
            severity: nextFilters.severity,
            operationalPinned: role === "SUPER_ADMIN" ? nextOperationalPinned : false,
            hiddenWidgetIds: normalizeMainHiddenCardIds(nextHiddenCardIds, stableAvailableCardIds),
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
    [role, stableAvailableCardIds, toast],
  );

  const loadDashboardHome = useCallback(async (silent = false) => {
    const requestId = layoutRequestIdRef.current + 1;
    layoutRequestIdRef.current = requestId;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setContractDegradationMessage(null);

    try {
      const [cardsResponse, layoutResponse] = await executeContractRequestWithRetry(
        () =>
          Promise.all([
            getSystemDashboardModuleCards(),
            getSystemDashboardLayout(),
          ] as const),
        {
          attempts: 2,
          baseDelayMs: 300,
          maxDelayMs: 1_200,
          context: "/system/dashboard/home",
          shouldRetry: (requestError) => isTransientRequestError(requestError),
        },
      );

      if (layoutRequestIdRef.current !== requestId) {
        return;
      }

      const nextModuleCards = normalizeDashboardHomeCards(
        Array.isArray(cardsResponse.cards)
          ? cardsResponse.cards
          : [],
      );
      const nextCardIds = nextModuleCards.map((card) => card.id);
      const layoutPayload = layoutResponse || {};
      const nextLayouts =
        layoutPayload.resolution?.source === "role_default"
          ? normalizeLayoutForWidgets({}, nextCardIds)
          : normalizeLayoutForWidgets(layoutPayload.layoutJson, nextCardIds);
      const nextHidden = normalizeMainHiddenCardIds(
        layoutPayload.filtersJson?.hiddenWidgetIds,
        nextCardIds,
      );
      const nextFilters = normalizeStoredFilters(role, layoutPayload.filtersJson || undefined);
      const nextOperationalPinned = normalizeStoredOperationalPinned(
        role,
        layoutPayload.filtersJson || undefined,
      );
      const pinnedFromStorage = readOperationalPinnedFromStorage(operationalPinnedStorageKey);
      const effectiveOperationalPinned =
        pinnedFromStorage === null ? nextOperationalPinned : pinnedFromStorage;

      setModuleCards(nextModuleCards);
      setLayouts(nextLayouts);
      setEditingLayouts(cloneLayouts(nextLayouts));
      setHiddenCardIds(nextHidden);
      setEditingHiddenCardIds(nextHidden);
      setOperationalFilters(nextFilters);
      setOperationalPinned(effectiveOperationalPinned);
      setOperationalExpanded((current) => {
        if (!operationalPreferenceInitializedRef.current) {
          operationalPreferenceInitializedRef.current = true;
          return effectiveOperationalPinned;
        }

        return effectiveOperationalPinned ? true : current;
      });
      writeOperationalPinnedToStorage(operationalPinnedStorageKey, effectiveOperationalPinned);
      setLastLayoutUpdateAt(layoutPayload.updatedAt || null);
      setError(null);
      setStaleSnapshotAt(null);
      lastSuccessfulHomeStateRef.current = {
        key: homeSnapshotKey,
        capturedAt: Date.now(),
        moduleCards: nextModuleCards,
        layouts: cloneLayouts(nextLayouts),
        hiddenCardIds: [...nextHidden],
        operationalFilters: nextFilters,
        operationalPinned: effectiveOperationalPinned,
        operationalExpanded: effectiveOperationalPinned,
        lastLayoutUpdateAt: layoutPayload.updatedAt || null,
      };
    } catch (requestError) {
      if (layoutRequestIdRef.current !== requestId) {
        return;
      }

      const message = normalizeErrorMessage(requestError);
      const snapshot = lastSuccessfulHomeStateRef.current;
      const canReuseSnapshot =
        snapshot &&
        snapshot.key === homeSnapshotKey &&
        Date.now() - snapshot.capturedAt <= DASHBOARD_HOME_SNAPSHOT_TTL_MS &&
        (isContractValidationError(requestError, "response") || isTransientRequestError(requestError));

      if (canReuseSnapshot) {
        const safeSnapshot = snapshot;
        setModuleCards(safeSnapshot.moduleCards);
        setLayouts(cloneLayouts(safeSnapshot.layouts));
        setEditingLayouts(cloneLayouts(safeSnapshot.layouts));
        setHiddenCardIds([...safeSnapshot.hiddenCardIds]);
        setEditingHiddenCardIds([...safeSnapshot.hiddenCardIds]);
        setOperationalFilters(safeSnapshot.operationalFilters);
        setOperationalPinned(safeSnapshot.operationalPinned);
        setOperationalExpanded(safeSnapshot.operationalExpanded);
        setLastLayoutUpdateAt(safeSnapshot.lastLayoutUpdateAt);
        setStaleSnapshotAt(safeSnapshot.capturedAt);
        setError(
          isContractValidationError(requestError, "response")
            ? "Resposta do dashboard principal fora do contrato. Mantendo o ultimo layout valido em modo degradado."
            : "Falha transitoria ao atualizar o dashboard principal. Mantendo o ultimo layout valido.",
        );
      } else {
        if (snapshot && Date.now() - snapshot.capturedAt > DASHBOARD_HOME_SNAPSHOT_TTL_MS) {
          lastSuccessfulHomeStateRef.current = null;
        }
        setStaleSnapshotAt(null);
        const fallbackLayouts = normalizeLayoutForWidgets({}, []);
        setModuleCards([]);
        setLayouts(fallbackLayouts);
        setEditingLayouts(cloneLayouts(fallbackLayouts));
        setHiddenCardIds([]);
        setEditingHiddenCardIds([]);
        setOperationalFilters(defaultFilters);
        setError(`Falha ao carregar os cards do dashboard: ${message}`);
      }
    } finally {
      if (layoutRequestIdRef.current === requestId) {
        if (!silent) {
          setLoading(false);
        }
        setRefreshing(false);
      }
    }
  }, [defaultFilters, homeSnapshotKey, operationalPinnedStorageKey, role]);

  useEffect(() => {
    void loadDashboardHome();
  }, [loadDashboardHome]);

  useEffect(() => {
    if (!staleSnapshotActive || loading || refreshing) {
      return;
    }

    const retryTimeout = window.setTimeout(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      void loadDashboardHome(true);
    }, DASHBOARD_HOME_STALE_REFRESH_RETRY_MS);

    const handleOnline = () => {
      void loadDashboardHome(true);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        return;
      }
      void loadDashboardHome(true);
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(retryTimeout);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadDashboardHome, loading, refreshing, staleSnapshotActive]);

  useEffect(() => {
    operationalPreferenceInitializedRef.current = false;
  }, [actorStorageId, role]);

  useEffect(() => {
    const handleContractDegradation = (event: Event) => {
      const detail = (event as CustomEvent<ContractVersionDowngradeDetail>).detail;
      if (!detail || !detail.context.startsWith("/system/dashboard")) {
        return;
      }

      setContractDegradationMessage(
        `API respondeu com contrato legado v${detail.parsedVersion} para ${detail.context}. O dashboard principal esta em modo degradado visivel.`,
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

  useEffect(() => {
    const pinnedFromStorage = readOperationalPinnedFromStorage(operationalPinnedStorageKey);
    if (pinnedFromStorage === null) {
      return;
    }

    operationalPreferenceInitializedRef.current = true;
    setOperationalPinned(pinnedFromStorage);
    setOperationalExpanded((current) => (pinnedFromStorage ? true : current));
  }, [operationalPinnedStorageKey]);

  useEffect(() => {
    setLayouts((current) => {
      const normalized = normalizeLayoutForWidgets(current, stableAvailableCardIds);
      return JSON.stringify(current) === JSON.stringify(normalized) ? current : normalized;
    });

    setEditingLayouts((current) => {
      const normalized = normalizeLayoutForWidgets(current, stableAvailableCardIds);
      return JSON.stringify(current) === JSON.stringify(normalized) ? current : normalized;
    });

    setHiddenCardIds((current) => {
      const normalized = normalizeMainHiddenCardIds(current, stableAvailableCardIds);
      return sameStringArray(current, normalized) ? current : normalized;
    });

    setEditingHiddenCardIds((current) => {
      const normalized = normalizeMainHiddenCardIds(current, stableAvailableCardIds);
      return sameStringArray(current, normalized) ? current : normalized;
    });
  }, [stableAvailableCardIds]);

  useEffect(() => {
    if (!isMobileViewport || !isLayoutEditing) {
      return;
    }

    setEditingLayouts(cloneLayouts(layouts));
    setEditingHiddenCardIds([...hiddenCardIds]);
    setIsLayoutEditing(false);
  }, [hiddenCardIds, isLayoutEditing, isMobileViewport, layouts]);

  const hasPendingLayoutChanges = useMemo(() => {
    if (!layoutEditingActive) {
      return false;
    }

    return (
      buildLayoutComparisonSnapshot(editingLayouts, editingHiddenCardIds) !==
      buildLayoutComparisonSnapshot(layouts, hiddenCardIds)
    );
  }, [editingHiddenCardIds, editingLayouts, hiddenCardIds, layoutEditingActive, layouts]);

  const beginLayoutEditing = useCallback(() => {
    if (!canEditLayout || staleSnapshotActive) {
      return;
    }

    setEditingLayouts(cloneLayouts(layouts));
    setEditingHiddenCardIds([...hiddenCardIds]);
    setIsLayoutEditing(true);
  }, [canEditLayout, hiddenCardIds, layouts, staleSnapshotActive]);

  const cancelLayoutEditing = useCallback(() => {
    setEditingLayouts(cloneLayouts(layouts));
    setEditingHiddenCardIds([...hiddenCardIds]);
    setIsLayoutEditing(false);
  }, [hiddenCardIds, layouts]);

  const resetLayoutEditing = useCallback(() => {
    const fallback = normalizeLayoutForWidgets({}, stableAvailableCardIds);
    setEditingLayouts(cloneLayouts(fallback));
    setEditingHiddenCardIds([]);
  }, [stableAvailableCardIds]);

  const saveLayoutEditing = useCallback(async () => {
    if (staleSnapshotActive) {
      toast({
        title: "Atualizacao obrigatoria",
        description: "Atualize os cards antes de salvar alteracoes com snapshot desatualizado.",
        variant: "destructive",
      });
      return;
    }

    const nextLayouts = cloneLayouts(editingLayouts);
    const nextHidden = normalizeMainHiddenCardIds(editingHiddenCardIds, stableAvailableCardIds);
    const saved = await persistDashboardLayout(
      nextLayouts,
      operationalFilters,
      nextHidden,
      operationalPinned,
    );

    if (!saved) {
      return;
    }

    setLayouts(nextLayouts);
    setHiddenCardIds(nextHidden);
    setEditingLayouts(cloneLayouts(nextLayouts));
    setEditingHiddenCardIds(nextHidden);
    setIsLayoutEditing(false);
    toast({
      title: "Layout salvo",
      description: "A organizacao dos cards principais foi atualizada.",
    });
  }, [
    editingHiddenCardIds,
    editingLayouts,
    operationalFilters,
    operationalPinned,
    persistDashboardLayout,
    staleSnapshotActive,
    stableAvailableCardIds,
    toast,
  ]);

  const handleOperationalFiltersChange = useCallback(async (nextFilters: OperationalDashboardFiltersState) => {
    setOperationalFilters(nextFilters);
    await persistDashboardLayout(layouts, nextFilters, hiddenCardIds, operationalPinned);
  }, [hiddenCardIds, layouts, operationalPinned, persistDashboardLayout]);

  const handleOperationalCardSelect = useCallback(() => {
    setOperationalExpanded((current) => (operationalPinned ? true : !current));
  }, [operationalPinned]);

  const handleOperationalPinToggle = useCallback(async () => {
    if (staleSnapshotActive) {
      toast({
        title: "Atualizacao obrigatoria",
        description: "Atualize o dashboard principal antes de alterar a abertura padrao da secao operacional.",
        variant: "destructive",
      });
      return;
    }

    const nextPinned = !operationalPinned;
    const previousExpanded = operationalExpanded;
    writeOperationalPinnedToStorage(operationalPinnedStorageKey, nextPinned);
    setOperationalPinned(nextPinned);
    if (nextPinned) {
      setOperationalExpanded(true);
    }

    const saved = await persistDashboardLayout(
      layouts,
      operationalFilters,
      hiddenCardIds,
      nextPinned,
    );

    if (!saved) {
      setOperationalExpanded(nextPinned ? true : previousExpanded);
    }
  }, [
    hiddenCardIds,
    layouts,
    operationalPinnedStorageKey,
    operationalExpanded,
    operationalFilters,
    operationalPinned,
    persistDashboardLayout,
    staleSnapshotActive,
    toast,
  ]);

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
      <div className="rounded-[28px] border border-skin-border/80 bg-skin-surface/85 px-4 py-4 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm ">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-skin-border bg-skin-background-elevated px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-skin-text">
                Dashboard principal
              </span>
              {isSuperAdmin ? (
                <span className="rounded-full border border-skin-info/30 bg-skin-info/10 px-3 py-1 text-[11px] font-medium text-skin-info">
                  SUPER_ADMIN com visao operacional recolhida
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-skin-text-muted">
              <span className="rounded-full border border-skin-border px-2.5 py-1">
                Role: {role}
              </span>
              <span className="rounded-full border border-skin-border px-2.5 py-1">
                Cards: {visibleCardIds.length}
              </span>
              <span className="rounded-full border border-skin-border px-2.5 py-1">
                Layout: {lastLayoutUpdateAt ? `salvo em ${lastLayoutUpdateAt}` : "padrao ativo"}
              </span>
              {isMobileViewport ? (
                <span className="rounded-full border border-skin-border px-2.5 py-1 text-skin-text">
                  Edicao disponivel em tela maior
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DashboardShellActionButton
              label="Atualizar cards"
              onClick={() => {
                void loadDashboardHome(true);
              }}
              active={refreshing}
              disabled={refreshing}
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
            </DashboardShellActionButton>
            <DashboardShellActionButton
              label={
                !canEditLayout
                  ? "Editar layout disponivel apenas em telas maiores"
                  : staleSnapshotActive
                    ? "Atualize os cards antes de editar o layout"
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
            </DashboardShellActionButton>
          </div>
        </div>
      </div>

      {layoutEditingActive ? (
        <div className="rounded-[28px] border border-skin-info/30 bg-skin-info/10 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-skin-info">
                <LayoutGrid className="h-4 w-4" />
                <p className="text-sm font-semibold">Editar layout principal</p>
              </div>
              <p className="mt-1 text-xs text-skin-text-muted">
                Arraste os cards do dashboard, reorganize os modulos e salve quando terminar.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-skin-border-strong bg-skin-surface/70 text-skin-text hover:bg-skin-surface"
                onClick={resetLayoutEditing}
                disabled={savingLayout}
              >
                <RefreshCw className="h-4 w-4" />
                Restaurar padrao
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-skin-border-strong bg-skin-surface/70 text-skin-text hover:bg-skin-surface"
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
            {stableAvailableCardIds.map((cardId) => {
                const card = cards.find((entry) => entry.id === cardId);
                const isHidden = editingHiddenCardIds.includes(cardId);
                return (
                  <button
                    key={cardId}
                    type="button"
                    onClick={() => {
                      setEditingHiddenCardIds((previous) => {
                        if (previous.includes(cardId)) {
                          return previous.filter((item) => item !== cardId);
                        }

                        return [...previous, cardId];
                      });
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${isHidden
                        ? "border-skin-border-strong bg-skin-surface text-skin-text-muted hover:border-skin-border-strong hover:text-skin-text"
                        : "border-skin-info/30 bg-skin-info/15 text-skin-info hover:bg-skin-info/20"
                      }`}
                    aria-pressed={!isHidden}
                  >
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {card?.title || cardId}
                  </button>
                );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-skin-danger/30 bg-skin-danger/10 px-4 py-3 text-skin-danger">
          <Rows3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Falha ao carregar os cards do dashboard</p>
            <p className="text-xs text-skin-danger/90">{error}</p>
          </div>
        </div>
      ) : null}

      {contractDegradationMessage ? (
        <div className="flex items-start gap-3 rounded-2xl border border-skin-warning/30 bg-skin-warning/10 px-4 py-3 text-skin-warning">
          <Rows3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Modo degradado de contrato</p>
            <p className="text-xs text-skin-warning/90">{contractDegradationMessage}</p>
          </div>
        </div>
      ) : null}

      {staleSnapshotAt ? (
        <div className="flex items-start gap-3 rounded-2xl border border-skin-info/30 bg-skin-info/10 px-4 py-3 text-skin-info">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Snapshot desatualizado em uso</p>
            <p className="text-xs text-skin-info/90">
              Ultimo layout valido coletado ha {formatSnapshotAgeLabel(staleSnapshotAt)}.
            </p>
            <p className="mt-1 text-xs text-skin-info/80">
              O dashboard tenta uma nova sincronizacao automaticamente quando a aba volta ao foco ou a conectividade retorna.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-skin-info/30 bg-skin-surface/70 text-skin-info hover:bg-skin-info/10"
                onClick={() => {
                  void loadDashboardHome(true);
                }}
              >
                Atualizar agora
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {operationalCard ? (
        <OperationalDashboardWidget
          id={operationalCard.id}
          title={operationalCard.title}
          subtitle={operationalCard.description}
          tone="modern"
          onSelect={handleOperationalCardSelect}
          actionLabel={operationalCard.actionLabel}
          headerActions={(
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-dashboard-stop-select="true"
              aria-pressed={operationalPinned}
              aria-label={
                operationalPinned
                  ? "Desafixar dashboard operacional aberto por padrao"
                  : "Fixar dashboard operacional aberto por padrao"
              }
              title={
                operationalPinned
                  ? "Desafixar abertura padrao"
                  : "Fixar abertura padrao"
              }
              className={`h-8 w-8 rounded-xl border transition-colors ${operationalPinned
                  ? "border-skin-info/30 bg-skin-info/15 text-skin-info hover:bg-skin-info/20 hover:text-skin-info"
                  : "border-white/10 bg-white/5 text-skin-text-muted hover:bg-white/10 hover:text-white"
                }`}
              disabled={staleSnapshotActive}
              onClick={(event) => {
                event.stopPropagation();
                void handleOperationalPinToggle();
              }}
            >
              <Pin className={`h-3.5 w-3.5 ${operationalPinned ? "rotate-45" : ""}`} />
            </Button>
          )}
        >
          <div className="min-h-1" />
        </OperationalDashboardWidget>
      ) : null}

      {isSuperAdmin && operationalExpanded ? (
        <div className="rounded-[32px] border border-skin-border/80 bg-skin-surface/60 p-3 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.4)] backdrop-blur-sm /80  md:p-4">
          <OperationalDashboard
            embedded
            storedFilters={operationalFilters}
            onFiltersChange={handleOperationalFiltersChange}
          />
        </div>
      ) : null}

      <div ref={containerRef}>
        {showInitialSkeleton ? (
          <DashboardHomeSkeleton />
        ) : visibleCardIds.length === 0 ? (
          <DashboardSurfaceState
            title="Sem cards"
            description="Nenhum card esta disponivel para a role e tenant atuais."
            centered
            className="min-h-[18rem]"
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

              setEditingLayouts(normalizeLayoutForWidgets(nextLayouts, stableAvailableCardIds));
            }}
          >
            {visibleCardIds.map((cardId) => (
              <div key={cardId}>{cardsById.get(cardId) || null}</div>
            ))}
          </Responsive>
        )}
      </div>

      {isSuperAdmin ? (
        <div className="rounded-[24px] border border-skin-border bg-skin-surface/80 px-4 py-3 text-xs text-skin-text-muted shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-skin-text">Contexto</span>
            <span className="rounded-full border border-skin-border px-2 py-1">
              Periodo operacional: {operationalFilters.periodMinutes} min
            </span>
            {operationalFilters.tenantId ? (
              <span className="rounded-full border border-skin-border px-2 py-1">
                Tenant operacional: {operationalFilters.tenantId}
              </span>
            ) : null}
            <span className="rounded-full border border-skin-border px-2 py-1">
              Secao operacional: {operationalExpanded ? "expandida" : "recolhida"}
            </span>
            <span className="rounded-full border border-skin-border px-2 py-1">
              Abertura padrao: {operationalPinned ? "fixada" : "livre"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
