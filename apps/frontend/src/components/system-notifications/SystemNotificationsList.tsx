"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SystemNotification } from "@/contexts/SystemNotificationsContext";
import {
  formatNotificationFullDate,
  formatNotificationRelativeTime,
  getNotificationAction,
  getNotificationCategoryFromAction,
  getNotificationCategoryLabel,
  getNotificationContextLink,
  getNotificationSafeMetadataRows,
} from "@/components/system-notifications/systemNotifications.utils";

interface SystemNotificationsListProps {
  items: SystemNotification[];
  loading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  variant?: "compact" | "full";
  onMarkAsRead: (id: string) => Promise<void>;
}

const severityLabel: Record<SystemNotification["severity"], string> = {
  info: "Informativa",
  warning: "Aviso",
  critical: "Critica",
};

const severityVisual = (severity: SystemNotification["severity"]) => {
  if (severity === "critical") {
    return {
      icon: AlertCircle,
      className: "text-red-600 dark:text-red-400",
      badgeClass: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
      itemClassUnread:
        "border-l-red-500 bg-red-50/80 dark:bg-red-950/25 hover:bg-red-100 dark:hover:bg-red-900/35",
      itemClassRead: "border-l-red-300/70 dark:border-l-red-900/50 hover:bg-red-50/50 dark:hover:bg-red-900/20",
      markerClass: "bg-red-500",
    };
  }

  if (severity === "warning") {
    return {
      icon: AlertTriangle,
      className: "text-amber-600 dark:text-amber-400",
      badgeClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
      itemClassUnread:
        "border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/25 hover:bg-amber-100 dark:hover:bg-amber-900/35",
      itemClassRead:
        "border-l-amber-300/70 dark:border-l-amber-900/50 hover:bg-amber-50/40 dark:hover:bg-amber-900/20",
      markerClass: "bg-amber-500",
    };
  }

  return {
    icon: CheckCircle2,
    className: "text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    itemClassUnread:
      "border-l-blue-500 bg-blue-50/70 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30",
    itemClassRead: "border-l-blue-300/70 dark:border-l-blue-900/50 hover:bg-blue-50/40 dark:hover:bg-blue-900/20",
    markerClass: "bg-blue-500",
  };
};

export function SystemNotificationsList({
  items,
  loading,
  error,
  hasActiveFilters,
  variant = "full",
  onMarkAsRead,
}: SystemNotificationsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isCompact = variant === "compact";

  const safeRowsById = useMemo(() => {
    const rows = new Map<string, ReturnType<typeof getNotificationSafeMetadataRows>>();
    for (const item of items) {
      rows.set(item.id, getNotificationSafeMetadataRows(item.data));
    }
    return rows;
  }, [items]);

  const handleOpenDetails = (notification: SystemNotification) => {
    setExpandedId((previous) => (previous === notification.id ? null : notification.id));

    if (!notification.isRead) {
      void onMarkAsRead(notification.id);
    }
  };

  const getPreviewBody = (body: string): string => {
    const normalized = String(body || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= 90) {
      return normalized;
    }

    return `${normalized.slice(0, 87)}...`;
  };

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
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Nao foi possivel carregar notificacoes.
        </p>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Bell className="h-8 w-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          {hasActiveFilters
            ? "Nenhuma notificacao encontrada para os filtros aplicados."
            : "Nenhuma notificacao do sistema."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {items.map((notification) => {
        const { icon: Icon, className, badgeClass, itemClassUnread, itemClassRead, markerClass } =
          severityVisual(notification.severity);
        const isUnread = !notification.isRead;
        const isExpanded = expandedId === notification.id;
        const action = getNotificationAction(notification);
        const category = getNotificationCategoryFromAction(action);
        const contextLink = getNotificationContextLink(notification);
        const safeMetadataRows = safeRowsById.get(notification.id) || [];

        return (
          <article
            key={notification.id}
            data-testid={`system-notification-item-${notification.id}`}
            data-severity={notification.severity}
            className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} border-b border-gray-100 dark:border-border last:border-b-0 border-l-4 transition-colors ${
              isUnread ? itemClassUnread : itemClassRead
            }`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => handleOpenDetails(notification)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 relative">
                  <Icon className={`h-4 w-4 mt-1 ${className}`} />
                  {isUnread && <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${markerClass}`} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`${isCompact ? "text-[13px]" : "text-sm"} truncate ${
                        isUnread
                          ? "font-semibold text-gray-900 dark:text-foreground"
                          : "font-medium text-gray-700 dark:text-muted-foreground"
                      }`}
                    >
                      {notification.title}
                    </p>

                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium flex-shrink-0 ${badgeClass}`}
                    >
                      {severityLabel[notification.severity]}
                    </span>
                  </div>

                  {isCompact ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <p className="text-[11px] leading-4 text-gray-600 dark:text-muted-foreground/90 max-w-full truncate">
                        {getPreviewBody(notification.body)}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
                        {getNotificationCategoryLabel(category)}
                      </span>
                      {action && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-mono">
                          {action}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-600 dark:text-muted-foreground/90 mt-1 line-clamp-2">
                        {notification.body}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
                          {getNotificationCategoryLabel(category)}
                        </span>
                        {action && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-mono">
                            {action}
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  <div className={`${isCompact ? "mt-1.5" : "mt-2"} flex items-center justify-between gap-2`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                        {formatNotificationRelativeTime(notification.createdAt)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-300">
                        {notification.isRead ? "Lida" : "Nao lida"}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                      {isExpanded ? "Ocultar" : "Detalhes"}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </span>
                  </div>

                  {!isCompact && (
                    <span className="sr-only">
                      {formatNotificationRelativeTime(notification.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className={`${isCompact ? "mt-2 ml-6 p-2.5" : "mt-3 ml-7 p-3"} rounded-md border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/40 space-y-3`}>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Detalhes operacionais
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{notification.body}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-gray-500 dark:text-slate-400">
                    <span className="font-medium">Status:</span>
                    <span>{notification.isRead ? "Lida" : "Nao lida"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 dark:text-slate-400">
                    <span className="font-medium">Data:</span>
                    <span>{formatNotificationFullDate(notification.createdAt)}</span>
                  </div>
                </div>

                {safeMetadataRows.length > 0 && (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {safeMetadataRows.map((row) => (
                      <div key={`${notification.id}-${row.key}`} className="flex flex-col">
                        <dt className="text-gray-500 dark:text-slate-400">{row.label}</dt>
                        <dd className="text-gray-800 dark:text-slate-200 font-medium break-words">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {contextLink && (
                    <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                      <Link href={contextLink.href}>
                        {contextLink.label}
                        <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  )}

                  {!notification.isRead && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onMarkAsRead(notification.id);
                      }}
                    >
                      Marcar lida
                    </Button>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
