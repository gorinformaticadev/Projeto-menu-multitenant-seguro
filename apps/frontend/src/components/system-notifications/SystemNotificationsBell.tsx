"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemNotificationsContext } from "@/contexts/SystemNotificationsContext";

export function SystemNotificationsBell() {
  const { unreadCount, openDrawer, isEnabled } = useSystemNotificationsContext();

  if (!isEnabled) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative text-skin-text-muted hover:bg-skin-background-elevated"
      onClick={openDrawer}
      aria-label="Abrir notificacoes do sistema"
    >
      <Bell className={`h-5 w-5 ${unreadCount > 0 ? "text-skin-info" : ""}`} />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-skin-danger px-1 text-[10px] font-bold text-skin-text-inverse shadow-sm ring-2 ring-skin-surface">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
