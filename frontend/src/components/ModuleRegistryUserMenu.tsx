/**
 * COMPONENTE PARA MENU DO USUÁRIO DO MODULE REGISTRY
 */

"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry, ModuleUserMenuItem } from '@/lib/module-registry';
import * as LucideIcons from 'lucide-react';

// Helper para ícones dinâmicos
const getIconComponent = (iconName: string): any => {
  return (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
};

interface Props {
  onItemClick: () => void;
}

export function ModuleRegistryUserMenu({ onItemClick }: Props) {
  const { user } = useAuth();
  const [userMenuItems, setUserMenuItems] = useState<ModuleUserMenuItem[]>([]);

  useEffect(() => {
    loadUserMenuItems();
  }, [user]);

  // Escuta mudanças no status dos módulos
  useEffect(() => {
    const handleModuleStatusChange = () => {
      loadUserMenuItems();
    };

    window.addEventListener('moduleStatusChanged', handleModuleStatusChange);
    return () => {
      window.removeEventListener('moduleStatusChanged', handleModuleStatusChange);
    };
  }, []);

  const loadUserMenuItems = () => {
    try {
      const items = moduleRegistry.getUserMenuItems(user?.role);
      setUserMenuItems(items);
      console.log('👤 Itens do menu do usuário carregados:', items.length);
    } catch (error) {
      console.error('❌ Erro ao carregar menu do usuário:', error);
    }
  };

  if (userMenuItems.length === 0) {
    return null;
  }

  return (
    <>
      {userMenuItems.map((item) => {
        const Icon = getIconComponent(item.icon || 'Circle');
        return (
          <a
            key={item.id}
            href={item.href}
            onClick={onItemClick}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </a>
        );
      })}
    </>
  );
}