'use client';

import React, { useState, useRef } from 'react';
import { Bell, Volume2, VolumeX, CheckCheck, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface NotificationTaskbarProps {
  className?: string;
}

export function NotificationTaskbar({ className = '' }: NotificationTaskbarProps) {
  const {
    notifications,
    connectionStatus,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isSoundEnabled,
    toggleSound
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `há ${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `há ${Math.floor(diff / 3600000)}h`;
    return `há ${Math.floor(diff / 86400000)}d`;
  };

  const getSeverityStyles = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-50 border-l-red-500 text-red-900';
      case 'warning': return 'bg-amber-50 border-l-amber-500 text-amber-900';
      case 'success': return 'bg-emerald-50 border-l-emerald-500 text-emerald-900';
      case 'info':
      default: return 'bg-blue-50 border-l-blue-500 text-blue-900';
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.metadata?.context) {
      window.location.href = notification.metadata.context;
    }
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-gray-600 hover:text-primary hover:bg-primary/10 transition-colors"
        aria-label="Notificações"
      >
        <Bell className={cn("h-5 w-5 transition-all", unreadCount > 0 && "animate-tada")} />

        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 translate-x-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 border border-white text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 && '9+'}
            {unreadCount <= 9 && unreadCount}
          </span>
        )}

        {/* Connection Status Indicator */}
        <span className={cn(
          "absolute bottom-2 right-2 translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white",
          connectionStatus === 'connected' ? 'bg-emerald-500' :
            connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
              'bg-red-500'
        )} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[400px] bg-white rounded-xl shadow-2xl border border-gray-100/50 ring-1 ring-black/5 z-50 overflow-hidden transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
          {/* Create a glassy header effect */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">Notificações</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                  {unreadCount} novas
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500 hover:text-primary"
                onClick={toggleSound}
                title={isSoundEnabled ? 'Silenciar' : 'Ativar som'}
              >
                {isSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-primary"
                  onClick={() => markAllAsRead()}
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={16} />
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-gray-50/30">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-gray-900 font-medium mb-1">Tudo limpo!</h4>
                <p className="text-sm text-gray-500 max-w-[200px]">
                  Você não tem novas notificações no momento.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "p-4 transition-all hover:bg-gray-50 cursor-pointer group border-l-4",
                      !notification.read ? "bg-white" : "bg-gray-50/50 opacity-75 grayscale-[0.3] hover:opacity-100 hover:grayscale-0",
                      getSeverityStyles(notification.type)
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={cn("text-sm font-medium leading-none", !notification.read && "font-semibold")}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                            {formatTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm opacity-90 line-clamp-2 mb-1.5">
                          {notification.message}
                        </p>
                        {notification.metadata?.module && (
                          <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-black/5 font-medium opacity-70">
                            {notification.metadata.module}
                          </div>
                        )}
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0 animate-pulse" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-white border-t border-gray-100 grid place-items-center relative z-20">
            <Link
              href="/notificacoes"
              className="text-xs font-medium text-primary hover:text-primary/80 hover:underline flex items-center gap-1.5 py-1 px-3 rounded-full hover:bg-primary/5 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Ver todas as notificações <ExternalLink size={12} />
            </Link>
          </div>

          {/* Connection status footer */}
          <div className={cn(
            "h-1 transition-colors duration-500",
            connectionStatus === 'connected' ? 'bg-emerald-500' :
              connectionStatus === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
          )} />
        </div>
      )}
    </div>
  );
}