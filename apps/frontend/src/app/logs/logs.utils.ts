import type { Role } from "@/contexts/AuthContext";

export interface LogsFilters {
  action: string;
  startDate: string;
  endDate: string;
}

export function resolveLogsDataSource(role?: Role | null) {
  if (role === "SUPER_ADMIN") {
    return {
      listEndpoint: "/audit-logs",
      statsEndpoint: "/audit-logs/stats",
      title: "Logs de Auditoria",
      description: "Visualize a auditoria completa e eventos administrativos do sistema.",
      scopeLabel: "Auditoria completa",
    };
  }

  if (role === "ADMIN") {
    return {
      listEndpoint: "/system/audit",
      statsEndpoint: "/system/audit/stats",
      title: "Auditoria do Sistema",
      description: "Acompanhe eventos operacionais e administrativos relevantes do sistema.",
      scopeLabel: "Auditoria do sistema",
    };
  }

  return null;
}

function normalizeDateBoundary(value: string, type: "start" | "end") {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return type === "start" ? `${trimmed}T00:00:00.000` : `${trimmed}T23:59:59.999`;
}

export function buildLogsQuery(page: number, filters: LogsFilters) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: "20",
  });

  if (filters.action.trim()) {
    params.set("action", filters.action.trim());
  }

  if (filters.startDate) {
    const startDate = normalizeDateBoundary(filters.startDate, "start");
    params.set("startDate", startDate);
    params.set("from", startDate);
  }

  if (filters.endDate) {
    const endDate = normalizeDateBoundary(filters.endDate, "end");
    params.set("endDate", endDate);
    params.set("to", endDate);
  }

  return params.toString();
}

export function buildLogsStatsQuery(filters: Pick<LogsFilters, "startDate" | "endDate">) {
  const params = new URLSearchParams();

  if (filters.startDate) {
    const startDate = normalizeDateBoundary(filters.startDate, "start");
    params.set("startDate", startDate);
    params.set("from", startDate);
  }

  if (filters.endDate) {
    const endDate = normalizeDateBoundary(filters.endDate, "end");
    params.set("endDate", endDate);
    params.set("to", endDate);
  }

  return params.toString();
}
