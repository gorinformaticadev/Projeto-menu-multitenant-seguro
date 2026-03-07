"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SVGProps } from "react";
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
import api from "@/lib/api";
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

type DashboardLayoutResponse = {
  role?: DashboardRole;
  layoutJson?: unknown;
  filtersJson?: {
    periodMinutes?: number;
    tenantId?: string | null;
    severity?: string;
    operationalPinned?: boolean;
    hiddenWidgetIds?: unknown;
  } | null;
  updatedAt?: string | null;
  resolution?: {
    source?: "user_role" | "role_default";
  } | null;
};

type ModuleCardItem = {
  id: string;
  title: string;
  description?: string | null;
  module: string;
  visibilityRole?: DashboardRole;
  kind?: "summary" | "list" | "kanban";
  icon?: string | null;
  href?: string | null;
  actionLabel?: string | null;
  size?: "small" | "medium" | "large";
  stats?: Array<{
    label: string;
    value: string;
  }>;
  items?: Array<{
    id: string;
    label: string;
    value?: string;
    column?: string;
    tone?: "neutral" | "good" | "warn" | "danger";
  }>;
};

type ModuleCardsResponse = {
  generatedAt?: string;
  cards?: ModuleCardItem[];
};

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
    severity: "all",
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
          ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
          : "border-slate-200/80 bg-white/90 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-950 dark:hover:text-slate-50"
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
    return "border-emerald-200/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100";
  }
  if (tone === "warn") {
    return "border-amber-200/80 bg-amber-50/80 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100";
  }
  if (tone === "danger") {
    return "border-rose-200/80 bg-rose-50/80 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100";
  }
  return "border-slate-200/80 bg-slate-50/80 text-slate-700 dark:border-slate-800/80 dark:bg-slate-900/50 dark:text-slate-200";
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
          <p className="text-[1.95rem] font-bold tracking-tight text-blue-400/95">
            SUPER_ADMIN
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Expanda esta area para acessar panorama, telemetria, seguranca e a grade operacional.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={`operational-overview-stat-${stat.label}`}
              className="rounded-[18px] border border-white/10 bg-white/5 px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                {stat.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{stat.value}</p>
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
          <div className="rounded-[16px] border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/45">
            <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
              {card.description}
            </p>
          </div>
        ) : null}

        {stats.length > 0 ? (
          <div className={statsGridClassName}>
            {stats.slice(0, 4).map((stat) => (
              <div
                key={`${card.id}-${stat.label}`}
                className="rounded-[16px] border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/45"
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-1 break-words text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
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
                className="rounded-[16px] border border-slate-200/80 bg-slate-50/70 px-3 py-2 dark:border-slate-800/80 dark:bg-slate-900/45"
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
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
                className="flex min-h-[9rem] flex-col rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {column}
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
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
                className="rounded-[16px] border border-slate-200/80 bg-slate-50/70 px-3 py-2 dark:border-slate-800/80 dark:bg-slate-900/45"
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
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
            className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/45"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
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

  const layoutRequestIdRef = useRef(0);
  const operationalPreferenceInitializedRef = useRef(false);

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
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
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
        const response = await api.put<DashboardLayoutResponse>("/system/dashboard/layout", {
          layoutJson: nextLayouts,
          filtersJson: {
            periodMinutes: nextFilters.periodMinutes,
            tenantId: nextFilters.tenantId || null,
            severity: "all",
            operationalPinned: role === "SUPER_ADMIN" ? nextOperationalPinned : false,
            hiddenWidgetIds: normalizeMainHiddenCardIds(nextHiddenCardIds, stableAvailableCardIds),
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
    [role, stableAvailableCardIds, toast],
  );

  const loadDashboardHome = useCallback(async () => {
    const requestId = layoutRequestIdRef.current + 1;
    layoutRequestIdRef.current = requestId;
    setLoading(true);

    try {
      const [cardsResponse, layoutResponse] = await Promise.all([
        api.get<ModuleCardsResponse>("/system/dashboard/module-cards"),
        api.get<DashboardLayoutResponse>("/system/dashboard/layout"),
      ]);

      if (layoutRequestIdRef.current !== requestId) {
        return;
      }

      const nextModuleCards = normalizeDashboardHomeCards(
        Array.isArray(cardsResponse.data?.cards)
          ? cardsResponse.data.cards
          : [],
      );
      const nextCardIds = nextModuleCards.map((card) => card.id);
      const layoutPayload = layoutResponse.data || {};
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
    } catch (requestError) {
      if (layoutRequestIdRef.current !== requestId) {
        return;
      }

      const message = normalizeErrorMessage(requestError);
      const fallbackLayouts = normalizeLayoutForWidgets({}, []);
      setModuleCards([]);
      setLayouts(fallbackLayouts);
      setEditingLayouts(cloneLayouts(fallbackLayouts));
      setHiddenCardIds([]);
      setEditingHiddenCardIds([]);
      setOperationalFilters(defaultFilters);
      setError(`Falha ao carregar os cards do dashboard: ${message}`);
    } finally {
      if (layoutRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [defaultFilters, operationalPinnedStorageKey, role]);

  useEffect(() => {
    void loadDashboardHome();
  }, [loadDashboardHome]);

  useEffect(() => {
    operationalPreferenceInitializedRef.current = false;
  }, [actorStorageId, role]);

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
    if (!canEditLayout) {
      return;
    }

    setEditingLayouts(cloneLayouts(layouts));
    setEditingHiddenCardIds([...hiddenCardIds]);
    setIsLayoutEditing(true);
  }, [canEditLayout, hiddenCardIds, layouts]);

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
  ]);

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
      <div className="rounded-[28px] border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/45">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                Dashboard principal
              </span>
              {isSuperAdmin ? (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200">
                  SUPER_ADMIN com visao operacional recolhida
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="rounded-full border border-slate-200 px-2.5 py-1 dark:border-slate-800">
                Role: {role}
              </span>
              <span className="rounded-full border border-slate-200 px-2.5 py-1 dark:border-slate-800">
                Cards: {visibleCardIds.length}
              </span>
              <span className="rounded-full border border-slate-200 px-2.5 py-1 dark:border-slate-800">
                Layout: {lastLayoutUpdateAt ? `salvo em ${lastLayoutUpdateAt}` : "padrao ativo"}
              </span>
              {isMobileViewport ? (
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  Edicao disponivel em tela maior
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DashboardShellActionButton
              label="Atualizar cards"
              onClick={() => {
                setRefreshing(true);
                void loadDashboardHome();
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
              disabled={savingLayout || !canEditLayout}
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
        <div className="rounded-[28px] border border-blue-200 bg-blue-50/80 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <LayoutGrid className="h-4 w-4" />
                <p className="text-sm font-semibold">Editar layout principal</p>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Arraste os cards do dashboard, reorganize os modulos e salve quando terminar.
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
                Restaurar padrao
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
                        ? "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400 dark:hover:text-slate-200"
                        : "border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-100"
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
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <Rows3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Falha ao carregar os cards do dashboard</p>
            <p className="text-xs text-red-700/90 dark:text-red-200/90">{error}</p>
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
                  ? "border-blue-300/60 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25 hover:text-white"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
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
        <div className="rounded-[32px] border border-slate-200/80 bg-white/60 p-3 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.4)] backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/35 md:p-4">
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
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-100">Contexto</span>
            <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
              Periodo operacional: {operationalFilters.periodMinutes} min
            </span>
            {operationalFilters.tenantId ? (
              <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
                Tenant operacional: {operationalFilters.tenantId}
              </span>
            ) : null}
            <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
              Secao operacional: {operationalExpanded ? "expandida" : "recolhida"}
            </span>
            <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
              Abertura padrao: {operationalPinned ? "fixada" : "livre"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
