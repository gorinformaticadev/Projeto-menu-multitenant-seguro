import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DashboardSurfaceState,
  DashboardMetricState,
  resolveDashboardMetricState,
} from "@/components/operational-dashboard/DashboardMetricState";

describe("DashboardMetricState", () => {
  it("renderiza widget indisponivel quando status vem com erro", () => {
    render(<DashboardMetricState metric={{ status: "error", error: "timeout" }} />);

    expect(screen.getByText("Indisponivel")).toBeInTheDocument();
    expect(screen.getByText("Tentando recuperar.")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-metric-state")).toHaveAttribute("data-tone", "danger");
  });

  it("renderiza widget degradado quando status vem parcial", () => {
    render(<DashboardMetricState metric={{ status: "degraded" }} />);

    expect(screen.getByText("Degradado")).toBeInTheDocument();
    expect(screen.getByText("Dados parciais neste ciclo.")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-metric-state")).toHaveAttribute("data-tone", "warn");
  });

  it("renderiza sem dados para widget sem leitura utilizavel", () => {
    render(<DashboardMetricState metric={{ status: "not_configured" }} />);

    expect(screen.getByText("Sem dados")).toBeInTheDocument();
    expect(screen.getByText("Sem leitura disponivel.")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-metric-state")).toHaveAttribute("data-tone", "neutral");
  });

  it("nao renderiza fallback quando a metrica esta saudavel", () => {
    expect(resolveDashboardMetricState({ status: "healthy" })).toBeNull();
  });

  it("reaproveita o estado visual compartilhado para vazios e mensagens contextuais", () => {
    render(
      <DashboardSurfaceState
        title="Sem dados"
        description="Nenhuma leitura recente."
        centered
      />,
    );

    expect(screen.getByText("Sem dados")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma leitura recente.")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-surface-state")).toHaveAttribute("data-tone", "neutral");
  });
});
