import { describe, expect, it } from "vitest";
import type { SystemNotification } from "@/contexts/SystemNotificationsContext";
import {
  filterSystemNotifications,
  getNotificationContextLink,
  getNotificationSafeMetadataRows,
} from "@/components/system-notifications/systemNotifications.utils";

const buildNotification = (overrides: Partial<SystemNotification>): SystemNotification => ({
  id: "n-1",
  createdAt: "2026-03-06T13:00:00.000Z",
  type: "SYSTEM_ALERT",
  severity: "info",
  title: "Titulo",
  body: "Mensagem",
  data: {
    action: "UPDATE_STARTED",
  },
  isRead: false,
  readAt: null,
  ...overrides,
});

describe("systemNotifications.utils", () => {
  it("filtra por leitura, severidade e categoria operacional", () => {
    const items: SystemNotification[] = [
      buildNotification({
        id: "n-update",
        severity: "critical",
        isRead: false,
        data: { action: "UPDATE_FAILED" },
      }),
      buildNotification({
        id: "n-backup",
        severity: "warning",
        isRead: true,
        data: { action: "BACKUP_FAILED" },
      }),
      buildNotification({
        id: "n-maintenance",
        severity: "info",
        isRead: false,
        data: { action: "MAINTENANCE_ENABLED" },
      }),
    ];

    const result = filterSystemNotifications(items, {
      read: "unread",
      severity: "critical",
      category: "update",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("n-update");
  });

  it("retorna link contextual por prefixo de acao", () => {
    const updateLink = getNotificationContextLink(
      buildNotification({ data: { action: "UPDATE_COMPLETED" } }),
    );
    const backupLink = getNotificationContextLink(
      buildNotification({ data: { action: "BACKUP_FAILED" } }),
    );
    const maintenanceLink = getNotificationContextLink(
      buildNotification({ data: { action: "MAINTENANCE_ENABLED" } }),
    );

    expect(updateLink).toEqual({
      href: "/configuracoes/sistema/updates?tab=status",
      label: "Abrir atualizacoes",
    });
    expect(backupLink).toEqual({
      href: "/configuracoes/sistema/updates?tab=backup",
      label: "Abrir backups",
    });
    expect(maintenanceLink).toEqual({
      href: "/configuracoes/sistema/updates?tab=status",
      label: "Abrir sistema",
    });
  });

  it("renderiza somente metadata segura e conhecida", () => {
    const rows = getNotificationSafeMetadataRows({
      fromVersion: "v1.0.0",
      toVersion: "v1.1.0",
      durationSeconds: 95,
      rollbackCompleted: true,
      unknownField: "nao deve aparecer",
      nested: { foo: "bar" },
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { key: "fromVersion", label: "Versao origem", value: "v1.0.0" },
        { key: "toVersion", label: "Versao destino", value: "v1.1.0" },
        { key: "durationSeconds", label: "Duracao", value: "1m 35s" },
        { key: "rollbackCompleted", label: "Rollback concluido", value: "Sim" },
      ]),
    );
    expect(rows.find((row) => row.key === "unknownField")).toBeUndefined();
    expect(rows.find((row) => row.key === "nested")).toBeUndefined();
  });
});
