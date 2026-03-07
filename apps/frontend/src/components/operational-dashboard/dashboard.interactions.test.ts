import { describe, expect, it } from "vitest";
import {
  filterDashboardWidgetIds,
  getDashboardQuickActions,
  getDashboardWidgetIntent,
} from "@/components/operational-dashboard/dashboard.interactions";

describe("dashboard.interactions", () => {
  it("filtra widgets com problemas operacionais reais no modo problems", () => {
    const widgetIds = ["version", "maintenance", "jobs", "notifications", "routeErrors", "security", "api"];

    const result = filterDashboardWidgetIds(widgetIds, "problems", {
      version: { status: "healthy" },
      maintenance: { status: "healthy", enabled: true },
      jobs: { status: "healthy", failedLast24h: 2 },
      notifications: { status: "healthy", criticalUnread: 1 },
      routeErrors: { status: "healthy", totalErrorCount: 3, errorRateRecent: 6.2 },
      security: { status: "healthy", topRateLimitedIps: [{ ip: "10.0.0.2", count: 2 }] },
      api: { status: "healthy" },
    });

    expect(result).toEqual(["maintenance", "jobs", "notifications", "routeErrors", "security"]);
  });

  it("mantem apenas falhas graves no modo critical", () => {
    const widgetIds = ["database", "jobs", "notifications", "errors"];

    const result = filterDashboardWidgetIds(widgetIds, "critical", {
      database: { status: "error" },
      jobs: { status: "healthy", failedLast24h: 3 },
      notifications: { status: "healthy", criticalUnread: 2 },
      errors: { status: "healthy", recent: [{ id: "audit-1" }] },
    });

    expect(result).toEqual(["database", "notifications", "errors"]);
  });

  it("classifica telemetria de rota como infraestrutura", () => {
    const result = filterDashboardWidgetIds(["routeLatency", "routeErrors", "jobs"], "infrastructure", {
      routeLatency: { status: "healthy" },
      routeErrors: { status: "healthy" },
      jobs: { status: "healthy" },
    });

    expect(result).toEqual(["routeLatency", "routeErrors"]);
  });

  it("retorna o drill-down correto por widget quando existe destino util", () => {
    expect(getDashboardWidgetIntent("version", "ADMIN", false)).toEqual({
      type: "route",
      href: "/configuracoes/sistema/updates?tab=status",
      label: "Abrir atualizacoes",
    });

    expect(getDashboardWidgetIntent("backup", "SUPER_ADMIN", false)).toEqual({
      type: "route",
      href: "/configuracoes/sistema/updates?tab=backup",
      label: "Abrir backups",
    });

    expect(getDashboardWidgetIntent("errors", "SUPER_ADMIN", false)).toEqual({
      type: "route",
      href: "/logs",
      label: "Abrir auditoria",
    });

    expect(getDashboardWidgetIntent("notifications", "SUPER_ADMIN", true)).toEqual({
      type: "notifications-drawer",
      label: "Ver notificacoes criticas",
    });
  });

  it("nao expoe links indevidos quando a role nao pode navegar", () => {
    expect(getDashboardWidgetIntent("errors", "ADMIN", false)).toBeNull();
    expect(getDashboardWidgetIntent("notifications", "ADMIN", true)).toBeNull();
    expect(getDashboardWidgetIntent("notifications", "SUPER_ADMIN", false)).toBeNull();
  });

  it("gera acoes rapidas de acordo com a role e o drawer de notificacoes", () => {
    const superAdminActions = getDashboardQuickActions("SUPER_ADMIN", true);
    const adminActions = getDashboardQuickActions("ADMIN", false);

    expect(superAdminActions.map((item) => item.id)).toEqual([
      "updates",
      "backups",
      "notifications",
      "logs",
    ]);
    expect(adminActions.map((item) => item.id)).toEqual(["updates", "backups"]);
  });
});

