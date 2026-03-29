"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, RefreshCw, Sparkles, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

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
    deleteReadNotifications,
  } = useSystemNotificationsContext();

  const { toast } = useToast();
  const [deletingRead, setDeletingRead] = useState(false);

  const readCount = items.filter((item) => item.isRead).length;

  const handleDeleteRead = async () => {
    setDeletingRead(true);
    try {
      const count = await deleteReadNotifications();
      toast({
        title: "Limpeza concluida",
        description: `${count} notificacao(oes) lida(s) removida(s).`,
      });
    } catch {
      toast({
        title: "Erro ao limpar notificacoes",
        description: "Nao foi possivel remover as notificacoes lidas.",
        variant: "destructive",
      });
    } finally {
      setDeletingRead(false);
    }
  };

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
        <DialogHeader className="border-b border-skin-border bg-gradient-to-r from-skin-info/5 to-skin-primary/5 px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-skin-info/10">
                <Bell className="h-4 w-4 text-skin-info" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold text-skin-text">
                  Notificacoes do sistema
                </DialogTitle>
                {unreadCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-skin-text-muted">
                    <Sparkles className="h-3 w-3 text-skin-warning" />
                    {unreadCount} nao lida{unreadCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-[11px] text-skin-text-muted">Tudo em dia</span>
                )}
              </div>
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
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  void markAllAsRead();
                }}
                disabled={unreadCount === 0}
                aria-label="Marcar todas como lidas"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  void handleDeleteRead();
                }}
                disabled={readCount === 0 || deletingRead}
                aria-label="Apagar notificacoes lidas"
                title="Apagar lidas"
              >
                <Trash2 className={`h-4 w-4 ${deletingRead ? "animate-pulse" : ""}`} />
              </Button>
              <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                <Link href="/notifications" onClick={() => closeDrawer()} aria-label="Ver central de notificacoes">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

        <DialogDescription className="sr-only">
          Lista de notificacoes operacionais persistidas para super administrador.
        </DialogDescription>
        </DialogHeader>

        <SystemNotificationsList
          items={items}
          loading={loading}
          error={error}
          hasActiveFilters={false}
          variant="compact"
          onMarkAsRead={markAsRead}
        />
      </DialogContent>
    </Dialog>
  );
}
