/**
 * COMPONENTE TASKBAR DO MODULE REGISTRY
 */

"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry, ModuleTaskbarItem } from '@/lib/module-registry';
import { Button } from './ui/button';
import * as LucideIcons from 'lucide-react';

// Helper para ícones dinâmicos
const getIconComponent = (iconName: string): any => {
  return (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
};

export function ModuleRegistryTaskbar() {
  const { user } = useAuth();
  const [taskbarItems, setTaskbarItems] = useState<ModuleTaskbarItem[]>([]);

  useEffect(() => {
    loadTaskbarItems();
  }, [user]);

  const loadTaskbarItems = () => {
    try {
      const items = moduleRegistry.getTaskbarItems(user?.role);
      setTaskbarItems(items);
      console.log('🔧 Itens da taskbar carregados:', items.length);
    } catch (error) {
      console.error('❌ Erro ao carregar taskbar:', error);
    }
  };

  if (taskbarItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-card border rounded-lg shadow-lg p-2 flex gap-2">
        <div className="text-xs text-muted-foreground px-2 py-1 border-r">
          Taskbar
        </div>
        {taskbarItems.map((item) => {
          const Icon = getIconComponent(item.icon);
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => window.location.href = item.href}
              title={item.name}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}