/**
 * COMPONENTE PARA NOTIFICAÇÕES DO MODULE REGISTRY
 */

"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry, ModuleNotification } from '@/lib/module-registry';
import { Bell, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

const notificationIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle
};

const notificationColors = {
  info: 'text-blue-600 bg-blue-50 border-blue-200',
  warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  error: 'text-red-600 bg-red-50 border-red-200',
  success: 'text-green-600 bg-green-50 border-green-200'
};

export function ModuleRegistryNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ModuleNotification[]>([]);

  useEffect(() => {
    loadNotifications();
  }, [user]);

  // Escuta mudanças no status dos módulos
  useEffect(() => {
    const handleModuleStatusChange = () => {
      loadNotifications();
    };

    window.addEventListener('moduleStatusChanged', handleModuleStatusChange);
    return () => {
      window.removeEventListener('moduleStatusChanged', handleModuleStatusChange);
    };
  }, []);

  const loadNotifications = () => {
    try {
      const moduleNotifications = moduleRegistry.getNotifications();
      setNotifications(moduleNotifications);
      console.log('🔔 Notificações do Module Registry carregadas:', moduleNotifications.length);
    } catch (error) {
      console.error('❌ Erro ao carregar notificações do Module Registry:', error);
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Bell className="h-5 w-5" />
        Notificações dos Módulos
      </h3>
      
      <div className="space-y-3">
        {notifications.map((notification) => {
          const Icon = notificationIcons[notification.type];
          const colorClass = notificationColors[notification.type];
          
          return (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border ${colorClass}`}
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium">{notification.title}</h4>
                  <p className="text-sm mt-1">{notification.message}</p>
                  {notification.timestamp && (
                    <p className="text-xs mt-2 opacity-75">
                      {notification.timestamp.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}