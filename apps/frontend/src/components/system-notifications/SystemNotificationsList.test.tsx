import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SystemNotification } from "@/contexts/SystemNotificationsContext";
import { SystemNotificationsList } from "@/components/system-notifications/SystemNotificationsList";

const buildNotification = (overrides: Partial<SystemNotification>): SystemNotification => ({
  id: "notification-1",
  createdAt: "2026-03-06T13:00:00.000Z",
  type: "SYSTEM_ALERT",
  severity: "critical",
  title: "Atualizacao falhou",
  body: "A atualizacao falhou e exigiu rollback.",
  data: {
    action: "UPDATE_FAILED",
    fromVersion: "v1.0.0",
    toVersion: "v1.1.0",
  },
  isRead: false,
  readAt: null,
  ...overrides,
});

describe("SystemNotificationsList", () => {
  it("destaca item critico visualmente", () => {
    const item = buildNotification({});
    const onMarkAsRead = vi.fn().mockResolvedValue(undefined);

    render(
      <SystemNotificationsList
        items={[item]}
        loading={false}
        error={null}
        hasActiveFilters={false}
        onMarkAsRead={onMarkAsRead}
      />,
    );

    const article = screen.getByTestId("system-notification-item-notification-1");
    expect(article).toHaveAttribute("data-severity", "critical");
    expect(article.className).toContain("border-l-red-500");
  });

  it("abre detalhe ao clicar e mantem mark-as-read funcional", async () => {
    const user = userEvent.setup();
    const item = buildNotification({});
    const onMarkAsRead = vi.fn().mockResolvedValue(undefined);

    render(
      <SystemNotificationsList
        items={[item]}
        loading={false}
        error={null}
        hasActiveFilters={false}
        onMarkAsRead={onMarkAsRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Atualizacao falhou/i }));

    expect(screen.getByText("Detalhes operacionais")).toBeInTheDocument();
    expect(onMarkAsRead).toHaveBeenCalledWith("notification-1");

    await user.click(screen.getByRole("button", { name: /Marcar lida/i }));
    expect(onMarkAsRead).toHaveBeenCalledTimes(2);
  });

  it("exibe link contextual para eventos de update", async () => {
    const user = userEvent.setup();
    const item = buildNotification({});
    const onMarkAsRead = vi.fn().mockResolvedValue(undefined);

    render(
      <SystemNotificationsList
        items={[item]}
        loading={false}
        error={null}
        hasActiveFilters={false}
        onMarkAsRead={onMarkAsRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Atualizacao falhou/i }));

    const link = screen.getByRole("link", { name: /Abrir atualizacoes/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/configuracoes/sistema/updates?tab=status");
  });
});
