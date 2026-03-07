import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  OperationalDashboardWidget,
  OperationalDashboardWidgetSkeleton,
} from "@/components/operational-dashboard/OperationalDashboardWidget";

describe("OperationalDashboardWidget", () => {
  it("abre a acao do card por clique e teclado quando o widget e interativo", () => {
    const onSelect = vi.fn();

    render(
      <OperationalDashboardWidget
        id="backup"
        title="Backup"
        onSelect={onSelect}
        actionLabel="Abrir backups"
      >
        <div>Conteudo</div>
      </OperationalDashboardWidget>,
    );

    const widget = screen.getByRole("button", { name: "Abrir backups" });

    fireEvent.click(widget);
    fireEvent.keyDown(widget, { key: "Enter" });
    fireEvent.keyDown(widget, { key: " ", code: "Space", keyCode: 32 });

    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("ignora clique vindo de controle interno para evitar navegacao dupla", () => {
    const onSelect = vi.fn();

    render(
      <OperationalDashboardWidget
        id="errors"
        title="Eventos"
        onSelect={onSelect}
        actionLabel="Abrir auditoria"
      >
        <button type="button">Acao interna</button>
      </OperationalDashboardWidget>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Acao interna" }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renderiza skeleton reutilizavel para carregamento inicial", () => {
    render(<OperationalDashboardWidgetSkeleton compact />);

    expect(screen.getByTestId("operational-dashboard-widget-skeleton")).toBeInTheDocument();
  });
});
