"use client";

import { useMemo, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSystemNotificationsContext } from "@/contexts/SystemNotificationsContext";
import { SystemNotificationsList } from "@/components/system-notifications/SystemNotificationsList";
import {
  filterSystemNotifications,
  type NotificationCategoryFilter,
  type NotificationReadFilter,
  type NotificationSeverityFilter,
} from "@/components/system-notifications/systemNotifications.utils";

export function SystemNotificationsDrawer() {
  const {
    items,
    unreadCount,
    loading,
    error,
    isDrawerOpen,
    isEnabled,
    closeDrawer,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useSystemNotificationsContext();
  const [readFilter, setReadFilter] = useState<NotificationReadFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategoryFilter>("all");

  const filteredItems = useMemo(() => {
    return filterSystemNotifications(items, {
      read: readFilter,
      severity: severityFilter,
      category: categoryFilter,
    });
  }, [categoryFilter, items, readFilter, severityFilter]);

  const hasActiveFilters =
    readFilter !== "all" || severityFilter !== "all" || categoryFilter !== "all";

  if (!isEnabled) {
    return null;
  }

  return (
    <Dialog
      open={isDrawerOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeDrawer();
        }
      }}
    >
      <DialogContent className="left-auto right-0 top-0 translate-x-0 translate-y-0 h-[100dvh] max-h-[100dvh] w-full max-w-[30rem] rounded-none border-l border-border p-0 gap-0 sm:rounded-none">
        <DialogHeader className="px-4 py-3 border-b border-gray-200 dark:border-border text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <DialogTitle className="text-sm font-semibold text-gray-900 dark:text-foreground">
                Notificacoes do sistema
              </DialogTitle>
              {unreadCount > 0 && (
                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs rounded-full font-medium">
                  {unreadCount} nova{unreadCount === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  void refresh();
                }}
                aria-label="Atualizar notificacoes"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  void markAllAsRead();
                }}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Marcar todas
              </Button>
            </div>
          </div>

          <DialogDescription className="sr-only">
            Lista de notificacoes operacionais persistidas para super administrador.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-3 border-b border-gray-100 dark:border-border flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
              Leitura
            </span>
            <Button
              type="button"
              variant={readFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReadFilter("all")}
            >
              Todas
            </Button>
            <Button
              type="button"
              variant={readFilter === "unread" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReadFilter("unread")}
            >
              Nao lidas
            </Button>
            <Button
              type="button"
              variant={readFilter === "read" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReadFilter("read")}
            >
              Lidas
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
              Severidade
            </span>
            <Button
              type="button"
              variant={severityFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSeverityFilter("all")}
            >
              Todas
            </Button>
            <Button
              type="button"
              variant={severityFilter === "critical" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSeverityFilter("critical")}
            >
              Criticas
            </Button>
            <Button
              type="button"
              variant={severityFilter === "warning" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSeverityFilter("warning")}
            >
              Warnings
            </Button>
            <Button
              type="button"
              variant={severityFilter === "info" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSeverityFilter("info")}
            >
              Informativas
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
              Categoria
            </span>
            <Button
              type="button"
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCategoryFilter("all")}
            >
              Todas
            </Button>
            <Button
              type="button"
              variant={categoryFilter === "update" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCategoryFilter("update")}
            >
              Update
            </Button>
            <Button
              type="button"
              variant={categoryFilter === "maintenance" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCategoryFilter("maintenance")}
            >
              Maintenance
            </Button>
            <Button
              type="button"
              variant={categoryFilter === "backup" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCategoryFilter("backup")}
            >
              Backup
            </Button>
            <Button
              type="button"
              variant={categoryFilter === "restore" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCategoryFilter("restore")}
            >
              Restore
            </Button>
          </div>
        </div>

        <SystemNotificationsList
          items={filteredItems}
          loading={loading}
          error={error}
          hasActiveFilters={hasActiveFilters}
          onMarkAsRead={markAsRead}
        />
      </DialogContent>
    </Dialog>
  );
}
