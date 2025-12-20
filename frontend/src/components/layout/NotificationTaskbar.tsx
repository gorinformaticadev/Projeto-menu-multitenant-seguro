'use client';

import React, { useState, useRef } from 'react';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useClickOutside } from '@/hooks/useClickOutside';

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
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
      return 'agora';
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `há ${minutes}min`;
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `há ${hours}h`;
    } else {
      const days = Math.floor(diff / 86400000);
      return `há ${days}d`;
    }
  };

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getSeverityColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'border-l-red-500 bg-red-50';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'info':
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  const handleBellClick = () => {
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.metadata?.context) {
      window.location.href = notification.metadata.context;
    }
  };

  const clearNotifications = () => {
    // Not implemented in context yet, skipping for now
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Botão do sino */}
      <button
        onClick={handleBellClick}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        title={`${unreadCount} notificação(ões) não lida(s)`}
      >
        <Bell size={20} />

        {/* Indicador de notificações não lidas */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Indicador de status da conexão */}
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              connectionStatus === 'error' ? 'bg-red-500' :
                'bg-gray-400'
          }`} />
      </button>

      {/* Dropdown de notificações */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Notificações {unreadCount > 0 && `(${unreadCount})`}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded"
                  title={soundEnabled ? 'Desativar som' : 'Ativar som'}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Status: <span className={
                connectionStatus === 'connected' ? 'text-green-600' :
                  connectionStatus === 'connecting' ? 'text-yellow-600' :
                    connectionStatus === 'error' ? 'text-red-600' :
                      'text-gray-600'
              }>
                {connectionStatus === 'connected' ? 'Conectado' :
                  connectionStatus === 'connecting' ? 'Conectando...' :
                    connectionStatus === 'error' ? 'Erro na conexão' :
                      'Desconectado'}
              </span>
            </div>
          </div>

          {/* Lista de notificações */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p>Sem notificações</p>
                <p className="text-xs mt-1">
                  As notificações aparecerão aqui em tempo real
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 hover:bg-gray-50 cursor-pointer border-l-4 ${getSeverityColor(notification.type)} ${!notification.read ? 'bg-blue-50' : ''
                      }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">
                        {getSeverityIcon(notification.type)}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h4 className={`text-sm font-medium text-gray-900 ${!notification.read ? 'font-semibold' : ''
                            }`}>
                            {notification.title}
                          </h4>

                          <div className="flex items-center space-x-2 ml-2">
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {formatTime(notification.createdAt)}
                            </span>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.description}
                        </p>

                        {notification.metadata?.module && (
                          <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500">
                            <span>Módulo: {notification.metadata.module}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer com ações */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">
                  {notifications.length} notificação(ões)
                </span>

                <div className="space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Marcar todas como lidas
                    </button>
                  )}

                  <button
                    onClick={() => window.location.href = '/configuracoes/notificacoes'}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Ver todas
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}