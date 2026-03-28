"use client";

import { useMemo, useState } from "react";
import { Bell, CheckCheck, FolderOpen, List, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemNotificationsList } from "@/components/system-notifications/SystemNotificationsList";
import { GroupedNotificationsList } from "@/components/system-notifications/GroupedNotificationsList";
import {
  filterSystemNotifications,
  getNotificationAction,
  type NotificationCategoryFilter,
  type NotificationReadFilter,
  type NotificationSeverityFilter,
} from "@/components/system-notifications/systemNotifications.utils";
import { useSystemNotificationsContext } from "@/contexts/SystemNotificationsContext";

const DEFAULT_READ_FILTER: NotificationReadFilter = "all";
const DEFAULT_SEVERITY_FILTER: NotificationSeverityFilter = "all";
const DEFAULT_CATEGORY_FILTER: NotificationCategoryFilter = "all";

type ViewMode = "individual" | "grouped";

export default function NotificationsPage() {
  const {
    items,
    unreadCount,
    loading,
    error,
    isEnabled,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useSystemNotificationsContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [readFilter, setReadFilter] = useState<NotificationReadFilter>(DEFAULT_READ_FILTER);
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverityFilter>(
    DEFAULT_SEVERITY_FILTER,
  );
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategoryFilter>(
    DEFAULT_CATEGORY_FILTER,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const base = filterSystemNotifications(items, {
      read: readFilter,
      severity: severityFilter,
      category: categoryFilter,
    });

    if (!query) {
      return base;
    }

    return base.filter((item) => {
      const action = getNotificationAction(item) || "";
      return (
        item.title.toLowerCase().includes(query) ||
        item.body.toLowerCase().includes(query) ||
        action.toLowerCase().includes(query)
      );
    });
  }, [categoryFilter, items, readFilter, searchTerm, severityFilter]);

  const criticalUnreadCount = useMemo(
    () => items.filter((item) => !item.isRead && item.severity === "critical").length,
    [items],
  );

  const hasActiveFilters =
    readFilter !== DEFAULT_READ_FILTER ||
    severityFilter !== DEFAULT_SEVERITY_FILTER ||
    categoryFilter !== DEFAULT_CATEGORY_FILTER ||
    searchTerm.trim().length > 0;

  const clearFilters = () => {
    setReadFilter(DEFAULT_READ_FILTER);
    setSeverityFilter(DEFAULT_SEVERITY_FILTER);
    setCategoryFilter(DEFAULT_CATEGORY_FILTER);
    setSearchTerm("");
  };

  if (!isEnabled) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-skin-text-muted" />
            <p className="text-sm font-medium">Central de notificacoes indisponivel.</p>
            <p className="mt-1 text-xs text-skin-text-muted">
              Este recurso e exclusivo para SUPER_ADMIN.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Central de notificacoes</h1>
          <p className="mt-1 text-sm text-skin-text-muted">
            Eventos operacionais persistidos para acompanhamento do SUPER_ADMIN.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-skin-background-elevated p-1">
            <button
              onClick={() => setViewMode("grouped")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "grouped"
                  ? "bg-skin-surface text-skin-text shadow-sm"
                  : "text-skin-text-muted hover:text-skin-text"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Agrupadas
            </button>
            <button
              onClick={() => setViewMode("individual")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "individual"
                  ? "bg-skin-surface text-skin-text shadow-sm"
                  : "text-skin-text-muted hover:text-skin-text"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Individuais
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refresh();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void markAllAsRead();
            }}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Marcar todas lidas
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-skin-text-muted">Total carregadas</p>
            <p className="text-2xl font-semibold mt-1">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-skin-text-muted">Nao lidas</p>
            <p className="text-2xl font-semibold mt-1">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-skin-text-muted">Criticas nao lidas</p>
            <p className="text-2xl font-semibold mt-1">{criticalUnreadCount}</p>
          </CardContent>
        </Card>
      </div>

      {viewMode === "grouped" ? (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notificacoes Agrupadas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <GroupedNotificationsList endpoint="/system/notifications" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-skin-text-muted">Busca</span>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-skin-text-muted" />
                    <Input
                      className="pl-8"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Titulo, mensagem ou acao"
                    />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-skin-text-muted">Leitura</span>
                  <select
                    className="h-9 w-full rounded-md border border-skin-input-border bg-skin-input-background px-2 text-sm text-skin-text"
                    value={readFilter}
                    onChange={(event) => setReadFilter(event.target.value as NotificationReadFilter)}
                  >
                    <option value="all">Todas</option>
                    <option value="unread">Nao lidas</option>
                    <option value="read">Lidas</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-skin-text-muted">Severidade</span>
                  <select
                    className="h-9 w-full rounded-md border border-skin-input-border bg-skin-input-background px-2 text-sm text-skin-text"
                    value={severityFilter}
                    onChange={(event) =>
                      setSeverityFilter(event.target.value as NotificationSeverityFilter)
                    }
                  >
                    <option value="all">Todas</option>
                    <option value="critical">Criticas</option>
                    <option value="warning">Avisos</option>
                    <option value="info">Informativas</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-skin-text-muted">Categoria</span>
                  <select
                    className="h-9 w-full rounded-md border border-skin-input-border bg-skin-input-background px-2 text-sm text-skin-text"
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(event.target.value as NotificationCategoryFilter)
                    }
                  >
                    <option value="all">Todas</option>
                    <option value="update">Atualizacoes</option>
                    <option value="maintenance">Manutencao</option>
                    <option value="backup">Backup</option>
                    <option value="restore">Restauracao</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  Limpar filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notificacoes ({filteredItems.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SystemNotificationsList
                items={filteredItems}
                loading={loading}
                error={error}
                hasActiveFilters={hasActiveFilters}
                variant="full"
                onMarkAsRead={markAsRead}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
