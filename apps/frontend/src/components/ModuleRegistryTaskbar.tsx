/**
 * COMPONENTE TASKBAR DO MODULE REGISTRY
 */

"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry } from '@/lib/module-registry';
import { Button } from './ui/button';
import * as LucideIcons from 'lucide-react';

// Interface local para itens da taskbar
interface ModuleTaskbarItem {
  id: string;
  name: string;
  icon: string;
  href: string;
  order?: number;
}

// Helper para ícones dinâmicos
const getIconComponent = (iconName: string): React.ComponentType | undefined => {
  // LucideIcons é um objeto de componentes React
  const Icon = (LucideIcons as Record<string, React.ComponentType | undefined>)[iconName];
  return Icon || LucideIcons.HelpCircle;
};

export function ModuleRegistryTaskbar() {
  const { user } = useAuth();
  const [taskbarItems, setTaskbarItems] = useState<ModuleTaskbarItem[]>([]);

  useEffect(() => {
    loadTaskbarItems();
  }, [user, loadTaskbarItems]);

  // Escuta mudanças no status dos módulos
  useEffect(() => {
    const handleModuleStatusChange = () => {
      loadTaskbarItems();
    };

    window.addEventListener('moduleStatusChanged', handleModuleStatusChange);
    return () => {
      window.removeEventListener('moduleStatusChanged', handleModuleStatusChange);
    };
  }, [loadTaskbarItems]);

  const loadTaskbarItems = () => {
    try {
      // console.log('🔍 [ModuleRegistryTaskbar] Carregando itens da taskbar...');
      
      // Verificação de segurança: método existe?
      if (typeof moduleRegistry.getTaskbarItems !== 'function') {
        console.warn('⚠️ [ModuleRegistryTaskbar] Método getTaskbarItems não disponível no moduleRegistry');
        setTaskbarItems([]);
        return;
      }

      const items = moduleRegistry.getTaskbarItems(user?.role);
      
      // Validação defensiva: items é um array?
      if (!Array.isArray(items)) {
        console.warn('⚠️ [ModuleRegistryTaskbar] getTaskbarItems não retornou um array válido');
        setTaskbarItems([]);
        return;
      }

      setTaskbarItems(items);
      // console.log('✅ [ModuleRegistryTaskbar] Itens da taskbar carregados:', items.length);
      // console.log('🔧 [ModuleRegistryTaskbar] Detalhes:', items);
    } catch (error) {
      console.warn('⚠️ [ModuleRegistryTaskbar] Erro ao carregar taskbar:', error);
      setTaskbarItems([]);
    }
  };

  if (taskbarItems.length === 0) {
    // console.log('⚠️ [ModuleRegistryTaskbar] Nenhum item para renderizar, taskbar oculta');
    return null;
  }

 // console.log('✅ [ModuleRegistryTaskbar] Renderizando taskbar com', taskbarItems.length, 'item(s)');

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