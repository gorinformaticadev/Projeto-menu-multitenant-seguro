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
      className="relative text-gray-600 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent"
      onClick={openDrawer}
      aria-label="Abrir notificacoes do sistema"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium px-1 shadow-sm">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
