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
      className: "text-skin-danger",
      badgeClass: "bg-skin-danger/10 text-skin-danger",
      itemClassUnread: "border-l-skin-danger bg-skin-danger/10 hover:bg-skin-danger/15",
      itemClassRead: "border-l-skin-danger/40 hover:bg-skin-danger/5",
      markerClass: "bg-skin-danger",
    };
  }

  if (severity === "warning") {
    return {
      icon: AlertTriangle,
      className: "text-skin-warning",
      badgeClass: "bg-skin-warning/10 text-skin-warning",
      itemClassUnread: "border-l-skin-warning bg-skin-warning/10 hover:bg-skin-warning/15",
      itemClassRead: "border-l-skin-warning/40 hover:bg-skin-warning/5",
      markerClass: "bg-skin-warning",
    };
  }

  return {
    icon: CheckCircle2,
    className: "text-skin-info",
    badgeClass: "bg-skin-info/10 text-skin-info",
    itemClassUnread: "border-l-skin-info bg-skin-info/10 hover:bg-skin-info/15",
    itemClassRead: "border-l-skin-info/40 hover:bg-skin-info/5",
    markerClass: "bg-skin-info",
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
        <Bell className="mx-auto mb-2 h-8 w-8 animate-pulse text-skin-text-muted/50" />
        <p className="text-sm text-skin-text-muted">Carregando notificacoes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-b border-skin-danger/20 bg-skin-danger/10 px-4 py-4">
        <p className="text-sm font-medium text-skin-danger">
          Nao foi possivel carregar notificacoes.
        </p>
        <p className="mt-1 text-xs text-skin-danger/80">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Bell className="mx-auto mb-2 h-8 w-8 text-skin-text-muted/50" />
        <p className="text-sm text-skin-text-muted">
          {hasActiveFilters
            ? "Nenhuma notificacao encontrada para os filtros aplicados."
            : "Nenhuma notificacao do sistema."}
        </p>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar flex-1 overflow-y-auto">
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
            className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} last:border-b-0 border-b border-l-4 border-skin-border transition-colors ${
              isUnread ? itemClassUnread : itemClassRead
            }`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => handleOpenDetails(notification)}
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <Icon className={`mt-1 h-4 w-4 ${className}`} />
                  {isUnread && <div className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${markerClass}`} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`${isCompact ? "text-[13px]" : "text-sm"} truncate ${
                        isUnread ? "font-semibold text-skin-text" : "font-medium text-skin-text-muted"
                      }`}
                    >
                      {notification.title}
                    </p>

                    <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                      {severityLabel[notification.severity]}
                    </span>
                  </div>

                  {isCompact ? (
                    <div className="mt-1 flex max-w-full flex-wrap items-center gap-1.5">
                      <p className="max-w-full truncate text-[11px] leading-4 text-skin-text-muted">
                        {getPreviewBody(notification.body)}
                      </p>
                      <span className="rounded bg-skin-background-elevated px-1.5 py-0.5 text-[10px] text-skin-text">
                        {getNotificationCategoryLabel(category)}
                      </span>
                      {action && (
                        <span className="rounded bg-skin-background-elevated px-1.5 py-0.5 font-mono text-[10px] text-skin-text-muted">
                          {action}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 line-clamp-2 text-xs text-skin-text-muted">
                        {notification.body}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-skin-background-elevated px-2 py-0.5 text-[11px] text-skin-text">
                          {getNotificationCategoryLabel(category)}
                        </span>
                        {action && (
                          <span className="rounded-md bg-skin-background-elevated px-2 py-0.5 font-mono text-[11px] text-skin-text-muted">
                            {action}
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  <div className={`${isCompact ? "mt-1.5" : "mt-2"} flex items-center justify-between gap-2`}>
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="truncate text-[11px] text-skin-text-muted">
                        {formatNotificationRelativeTime(notification.createdAt)}
                      </span>
                      <span className="rounded bg-skin-background-elevated px-1.5 py-0.5 text-[10px] text-skin-text-muted">
                        {notification.isRead ? "Lida" : "Nao lida"}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-skin-text-muted">
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
              <div className={`${isCompact ? "ml-6 mt-2 p-2.5" : "ml-7 mt-3 p-3"} space-y-3 rounded-md border border-skin-border bg-skin-surface`}>
                <div>
                  <p className="text-xs font-semibold text-skin-text">
                    Detalhes operacionais
                  </p>
                  <p className="mt-1 text-xs text-skin-text-muted">{notification.body}</p>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div className="flex items-center gap-1 text-skin-text-muted">
                    <span className="font-medium">Status:</span>
                    <span>{notification.isRead ? "Lida" : "Nao lida"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-skin-text-muted">
                    <span className="font-medium">Data:</span>
                    <span>{formatNotificationFullDate(notification.createdAt)}</span>
                  </div>
                </div>

                {safeMetadataRows.length > 0 && (
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                    {safeMetadataRows.map((row) => (
                      <div key={`${notification.id}-${row.key}`} className="flex flex-col">
                        <dt className="text-skin-text-muted">{row.label}</dt>
                        <dd className="break-words font-medium text-skin-text">
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
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}

                  {!notification.isRead && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-skin-info"
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
