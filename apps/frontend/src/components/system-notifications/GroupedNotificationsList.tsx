"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGroupedNotifications } from "@/hooks/useGroupedNotifications";
import type { NotificationGroup, Notification } from "@/types/notifications";

interface GroupedNotificationsListProps {
  endpoint?: string;
}

export function GroupedNotificationsList({ endpoint = "/notifications" }: GroupedNotificationsListProps) {
  const {
    groups,
    loading,
    error,
    hasMore,
    fetchGroups,
    fetchGroupItems,
    markGroupAsRead,
  } = useGroupedNotifications(endpoint);

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupItems, setGroupItems] = useState<Notification[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  const handleToggleGroup = useCallback(async (group: NotificationGroup) => {
    if (expandedGroupId === group.id) {
      setExpandedGroupId(null);
      setGroupItems([]);
      return;
    }

    setExpandedGroupId(group.id);
    setLoadingItems(true);

    const result = await fetchGroupItems(group.id);
    if (result) {
      setGroupItems(result.notifications);
    }

    setLoadingItems(false);
  }, [expandedGroupId, fetchGroupItems]);

  const handleMarkGroupAsRead = useCallback(async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markGroupAsRead(groupId);
  }, [markGroupAsRead]);

  const formatTime = (dateInput: string) => {
    const now = new Date();
    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) {
      return "data invalida";
    }

    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return "agora";
    if (minutes < 60) return `${minutes} min atras`;
    if (hours < 24) return `${hours} h atras`;
    return date.toLocaleDateString();
  };

  const getScopeLabel = (scopeType: string, scopeKey: string) => {
    if (scopeType === "system" && scopeKey === "general") return "Sistema";
    if (scopeType === "module") return `Modulo: ${scopeKey}`;
    return `${scopeType}:${scopeKey}`;
  };

  const getPreviewBody = (body: string | null): string => {
    const normalized = String(body || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= 90) return normalized;
    return `${normalized.slice(0, 87)}...`;
  };

  if (loading && groups.length === 0) {
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
          Nao foi possivel carregar notificacoes agrupadas.
        </p>
        <p className="mt-1 text-xs text-skin-danger/80">{error}</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <FolderOpen className="mx-auto mb-2 h-8 w-8 text-skin-text-muted/50" />
        <p className="text-sm text-skin-text-muted">
          Nenhuma notificacao agrupada encontrada.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isExpanded = expandedGroupId === group.id;
        const hasUnread = group.unreadCount > 0;

        return (
          <div key={group.id} className="overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              className={`w-full cursor-pointer text-left rounded-xl border p-4 transition-all duration-200 ${
                hasUnread
                  ? "border-skin-info/25 ring-1 ring-skin-info/10 shadow-sm bg-skin-surface"
                  : "border-skin-border hover:border-skin-border-strong bg-skin-surface"
              }`}
              onClick={() => handleToggleGroup(group)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleGroup(group);
                }
              }}
            >
              {hasUnread && (
                <div className="absolute bottom-0 left-0 top-0 w-1 bg-skin-info" />
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-skin-background-elevated px-1.5 py-0.5 text-[10px] font-medium text-skin-text-muted">
                      {getScopeLabel(group.scopeType, group.scopeKey)}
                    </span>
                    {hasUnread && (
                      <span className="rounded-full bg-skin-primary px-1.5 py-0.5 text-[10px] font-medium text-skin-text-inverse">
                        {group.unreadCount} nao lida{group.unreadCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>

                  <h3 className={`text-sm ${hasUnread ? "font-semibold text-skin-text" : "font-medium text-skin-text-muted"}`}>
                    {group.lastTitle}
                  </h3>

                  {group.lastBody && (
                    <p className="mt-0.5 text-xs text-skin-text-muted">
                      {getPreviewBody(group.lastBody)}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-skin-text-muted">
                    <span>{formatTime(group.lastNotificationAt)}</span>
                    <span>{group.totalCount} notificacao{group.totalCount === 1 ? "" : "oes"}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {hasUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-skin-info"
                      onClick={(e) => handleMarkGroupAsRead(group.id, e)}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Ler todas
                    </Button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-skin-text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-skin-text-muted" />
                  )}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-skin-border pl-4">
                {loadingItems ? (
                  <div className="py-4 text-center text-xs text-skin-text-muted">
                    Carregando itens...
                  </div>
                ) : groupItems.length === 0 ? (
                  <div className="py-4 text-center text-xs text-skin-text-muted">
                    Nenhum item encontrado.
                  </div>
                ) : (
                  groupItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 text-sm ${
                        item.read
                          ? "border-skin-border bg-skin-background-elevated"
                          : "border-skin-info/20 bg-skin-info/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`${item.read ? "text-skin-text-muted" : "font-medium text-skin-text"}`}>
                          {item.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-skin-text-muted">
                          {formatTime(String(item.createdAt))}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-skin-text-muted">
                        {item.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {hasMore && (
        <div className="py-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchGroups(Math.ceil(groups.length / 20) + 1)}
            disabled={loading}
          >
            {loading ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}
