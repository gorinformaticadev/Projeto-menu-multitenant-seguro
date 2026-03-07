import { describe, expect, it } from "vitest";
import { buildLogsQuery, buildLogsStatsQuery, resolveLogsDataSource } from "@/app/logs/logs.utils";

describe("logs.utils", () => {
  it("resolve a fonte completa para SUPER_ADMIN", () => {
    expect(resolveLogsDataSource("SUPER_ADMIN")).toEqual({
      listEndpoint: "/audit-logs",
      statsEndpoint: "/audit-logs/stats",
      title: "Logs de Auditoria",
      description: "Visualize a auditoria completa e eventos administrativos do sistema.",
      scopeLabel: "Auditoria completa",
    });
  });

  it("resolve a fonte do sistema para ADMIN", () => {
    expect(resolveLogsDataSource("ADMIN")).toEqual({
      listEndpoint: "/system/audit",
      statsEndpoint: "/system/audit/stats",
      title: "Auditoria do Sistema",
      description: "Acompanhe eventos operacionais e administrativos relevantes do sistema.",
      scopeLabel: "Auditoria do sistema",
    });
  });

  it("gera query compartilhada com datas nos dois formatos suportados", () => {
    const query = buildLogsQuery(2, {
      action: "UPDATE_FAILED",
      startDate: "2026-03-01",
      endDate: "2026-03-07",
    });

    expect(query).toContain("page=2");
    expect(query).toContain("action=UPDATE_FAILED");
    expect(query).toContain("startDate=2026-03-01T00%3A00%3A00.000");
    expect(query).toContain("from=2026-03-01T00%3A00%3A00.000");
    expect(query).toContain("endDate=2026-03-07T23%3A59%3A59.999");
    expect(query).toContain("to=2026-03-07T23%3A59%3A59.999");
  });

  it("gera query de estatisticas com janela inclusiva do dia", () => {
    const query = buildLogsStatsQuery({
      startDate: "2026-03-01",
      endDate: "2026-03-07",
    });

    expect(query).toContain("startDate=2026-03-01T00%3A00%3A00.000");
    expect(query).toContain("from=2026-03-01T00%3A00%3A00.000");
    expect(query).toContain("endDate=2026-03-07T23%3A59%3A59.999");
    expect(query).toContain("to=2026-03-07T23%3A59%3A59.999");
  });
});
