"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  Info,
  Search,
  Trash2,
} from "lucide-react";
import { useNotificationContext } from "@/providers/NotificationProvider";
import { Button } from "./ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    isConnected,
    connectionError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationContext();

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "unread" && notification.read) {
      return false;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        notification.title.toLowerCase().includes(search) ||
        notification.description.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredNotifications.map((notification) => notification.id));
      return;
    }

    setSelectedIds([]);
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((previous) => [...previous, id]);
      return;
    }

    setSelectedIds((previous) => previous.filter((value) => value !== id));
  };

  const handleDeleteSelected = () => {
    if (confirm(`Tem certeza que deseja excluir ${selectedIds.length} notificacoes?`)) {
      selectedIds.forEach((id) => deleteNotification(id));
      setSelectedIds([]);
    }
  };

  const handleMarkSelectedAsRead = () => {
    selectedIds.forEach((id) => markAsRead(id));
    setSelectedIds([]);
  };

  const isAllSelected =
    filteredNotifications.length > 0 && selectedIds.length === filteredNotifications.length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "warning":
        return AlertTriangle;
      case "error":
        return AlertCircle;
      case "success":
        return CheckCircle;
      default:
        return Info;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "warning":
        return "text-skin-warning";
      case "error":
        return "text-skin-danger";
      case "success":
        return "text-skin-success";
      default:
        return "text-skin-info";
    }
  };

  const getSeverityBadgeColor = (type: string) => {
    switch (type) {
      case "warning":
        return "border-skin-warning/20 bg-skin-warning/10 text-skin-warning";
      case "error":
        return "border-skin-danger/20 bg-skin-danger/10 text-skin-danger";
      case "success":
        return "border-skin-success/20 bg-skin-success/10 text-skin-success";
      default:
        return "border-skin-info/20 bg-skin-info/10 text-skin-info";
    }
  };

  const formatNotificationTime = (dateInput: Date | string) => {
    const now = new Date();
    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) {
      return "data invalida";
    }

    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) {
      return "agora";
    }
    if (minutes < 60) {
      return `${minutes} min atras`;
    }
    if (hours < 24) {
      return `${hours} h atras`;
    }
    return date.toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-4xl p-6 text-skin-text">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-skin-text">
            <Bell className="h-6 w-6 text-skin-info" />
            Central de Notificacoes
          </h1>
          <p className="mt-1 text-skin-text-muted">
            Gerencie seus alertas e mensagens do sistema
          </p>
        </div>

        <div className="flex gap-3">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllAsRead()}
              className="flex items-center gap-2 text-skin-primary hover:text-skin-primary/80"
            >
              <Check className="h-4 w-4" />
              Marcar tudo como lido
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-skin-border bg-skin-surface p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="rounded-lg bg-skin-info/10 p-3">
            <Bell className="h-6 w-6 text-skin-info" />
          </div>
          <div>
            <p className="text-sm font-medium text-skin-text-muted">Total recebidas</p>
            <p className="text-2xl font-bold text-skin-text">{notifications.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-skin-border bg-skin-surface p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="rounded-lg bg-skin-warning/10 p-3">
            <AlertCircle className="h-6 w-6 text-skin-warning" />
          </div>
          <div>
            <p className="text-sm font-medium text-skin-text-muted">Nao lidas</p>
            <p className="text-2xl font-bold text-skin-text">{unreadCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-skin-border bg-skin-surface p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="rounded-lg bg-skin-success/10 p-3">
            <CheckCircle className="h-6 w-6 text-skin-success" />
          </div>
          <div>
            <p className="text-sm font-medium text-skin-text-muted">Lidas</p>
            <p className="text-2xl font-bold text-skin-text">
              {notifications.length - unreadCount}
            </p>
          </div>
        </div>
      </div>

      {!isConnected && (
        <div className="mb-6 rounded-r-lg border-l-4 border-skin-warning bg-skin-warning/10 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-skin-warning" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-skin-warning">
                Voce esta desconectado do servidor de notificacoes em tempo real.
                {connectionError && (
                  <span className="mt-1 block text-xs text-skin-warning/80">{connectionError}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-skin-border bg-skin-surface p-4 shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex w-full items-center gap-4">
            <div className="flex items-center gap-2 border-r border-skin-border pr-4">
              <Checkbox
                id="select-all"
                checked={isAllSelected}
                onCheckedChange={(checked: boolean) => handleSelectAll(checked as boolean)}
              />
              <label htmlFor="select-all" className="cursor-pointer text-sm font-medium text-skin-text">
                Todos
              </label>
            </div>

            {selectedIds.length > 0 && (
              <div className="animate-in fade-in zoom-in duration-200 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkSelectedAsRead}
                  className="flex items-center gap-2 border-skin-info/20 text-skin-info hover:bg-skin-info/10"
                >
                  <Check className="h-4 w-4" />
                  Marcar Lidas
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir ({selectedIds.length})
                </Button>
              </div>
            )}

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-skin-text-muted" />
              <input
                type="text"
                placeholder="Buscar notificacoes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-skin-input-border bg-skin-input-background py-2 pl-10 pr-4 text-sm text-skin-text focus:border-transparent focus:outline-none focus:ring-2 focus:ring-skin-focus-ring"
              />
            </div>

            <div className="flex shrink-0 rounded-lg bg-skin-background-elevated p-1">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${filter === "all"
                  ? "bg-skin-surface text-skin-text shadow-sm"
                  : "text-skin-text-muted hover:text-skin-text"
                  }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${filter === "unread"
                  ? "bg-skin-surface text-skin-text shadow-sm"
                  : "text-skin-text-muted hover:text-skin-text"
                  }`}
              >
                Nao Lidas
                {unreadCount > 0 && (
                  <span className="rounded-full bg-skin-primary px-1.5 py-0.5 text-[10px] text-skin-text-inverse">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-skin-border bg-skin-background-elevated py-20 text-center">
            <div className="mb-4 inline-block rounded-full bg-skin-surface p-4 shadow-sm">
              <Bell className="h-8 w-8 text-skin-text-muted/50" />
            </div>
            <h3 className="text-lg font-medium text-skin-text">Nenhuma notificacao encontrada</h3>
            <p className="mx-auto mt-1 max-w-sm text-skin-text-muted">
              {searchTerm
                ? `Nao encontramos resultados para "${searchTerm}"`
                : filter === "unread"
                  ? "Voce leu todas as suas notificacoes!"
                  : "Seu historico de notificacoes esta vazio."}
            </p>
            {filter !== "all" && (
              <Button variant="link" onClick={() => setFilter("all")} className="mt-4 text-skin-primary">
                Ver todas as notificacoes
              </Button>
            )}
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type);
            const isUnread = !notification.read;
            const isSelected = selectedIds.includes(notification.id);

            return (
              <div
                key={notification.id}
                className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${isUnread
                  ? "border-skin-info/25 ring-1 ring-skin-info/10 shadow-sm"
                  : "border-skin-border hover:border-skin-border-strong"
                  } ${isSelected ? "border-skin-info/35 bg-skin-info/10" : "bg-skin-surface"}`}
              >
                {isUnread && (
                  <div className="absolute bottom-0 left-0 top-0 w-1 bg-skin-info" />
                )}

                <div className="flex items-start gap-4 p-5">
                  <div className="pt-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked: boolean) => handleSelect(notification.id, checked as boolean)}
                    />
                  </div>

                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${isUnread
                      ? "bg-skin-info/10"
                      : "bg-skin-background-elevated group-hover:bg-skin-surface-hover"
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${getIconColor(notification.type)}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-4">
                      <div>
                        <h3 className={`text-base ${isUnread ? "font-semibold text-skin-text" : "font-medium text-skin-text-muted"}`}>
                          {notification.title}
                        </h3>
                      </div>
                    </div>

                    <p className="mb-3 text-sm leading-relaxed text-skin-text-muted">
                      {notification.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getSeverityBadgeColor(notification.type)}`}>
                          {notification.type === "error"
                            ? "Erro"
                            : notification.type === "warning"
                              ? "Aviso"
                              : notification.type === "success"
                                ? "Sucesso"
                                : "Informativo"}
                        </span>

                        <span className="ml-1 flex items-center gap-1 border-l border-skin-border pl-3 text-xs text-skin-text-muted">
                          {formatNotificationTime(notification.createdAt)}
                        </span>
                      </div>

                      {isUnread && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="flex items-center gap-1 text-xs font-medium text-skin-info opacity-0 transition-colors group-hover:opacity-100 hover:text-skin-primary"
                        >
                          <Check className="h-3 w-3" />
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
