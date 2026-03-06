"use client";

import { AlertCircle, AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SystemNotification } from "@/contexts/SystemNotificationsContext";

interface SystemNotificationsListProps {
  items: SystemNotification[];
  loading: boolean;
  error: string | null;
  onMarkAsRead: (id: string) => Promise<void>;
}

const formatNotificationTime = (dateInput: string): string => {
  const now = new Date();
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "data invalida";
  }

  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return "agora";
  }
  if (minutes < 60) {
    return `ha ${minutes}min`;
  }
  if (hours < 24) {
    return `ha ${hours}h`;
  }
  if (days < 7) {
    return `ha ${days}d`;
  }

  return date.toLocaleDateString("pt-BR");
};

const severityLabel: Record<SystemNotification["severity"], string> = {
  info: "Info",
  warning: "Aviso",
  critical: "Critico",
};

const severityIcon = (severity: SystemNotification["severity"]) => {
  if (severity === "critical") {
    return {
      icon: AlertCircle,
      className: "text-red-600 dark:text-red-400",
      badgeClass: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    };
  }

  if (severity === "warning") {
    return {
      icon: AlertTriangle,
      className: "text-yellow-600 dark:text-yellow-400",
      badgeClass: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
    };
  }

  return {
    icon: CheckCircle2,
    className: "text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  };
};

export function SystemNotificationsList({
  items,
  loading,
  error,
  onMarkAsRead,
}: SystemNotificationsListProps) {
  if (loading && items.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Bell className="h-8 w-8 text-gray-300 dark:text-slate-600 mx-auto mb-2 animate-pulse" />
        <p className="text-sm text-gray-500 dark:text-muted-foreground">Carregando notificacoes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/30">
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Bell className="h-8 w-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-muted-foreground">Sem notificacoes</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Tudo sob controle.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {items.map((notification) => {
        const { icon: Icon, className, badgeClass } = severityIcon(notification.severity);
        const isUnread = !notification.isRead;

        return (
          <div
            key={notification.id}
            className={`px-4 py-3 border-b border-gray-100 dark:border-border last:border-b-0 transition-colors ${
              isUnread
                ? "bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                : "hover:bg-gray-50 dark:hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 relative">
                <Icon className={`h-4 w-4 mt-1 ${className}`} />
                {isUnread && <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm truncate ${
                      isUnread
                        ? "font-semibold text-gray-900 dark:text-foreground"
                        : "font-medium text-gray-700 dark:text-muted-foreground"
                    }`}
                  >
                    {notification.title}
                  </p>

                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium flex-shrink-0 ${badgeClass}`}
                  >
                    {severityLabel[notification.severity]}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-muted-foreground/80 mt-1 line-clamp-3">
                  {notification.body}
                </p>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    {formatNotificationTime(notification.createdAt)}
                  </span>

                  {!notification.isRead && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400"
                      onClick={() => {
                        void onMarkAsRead(notification.id);
                      }}
                    >
                      Marcar lida
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
