/**
 * COMPONENTE PARA MENU DO USUÁRIO DO MODULE REGISTRY
 */

"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry, ModuleUserMenuItem } from '@/lib/module-registry';
import * as LucideIcons from 'lucide-react';

// Helper para ícones dinâmicos
const getIconComponent = (iconName: string): React.ElementType => {
  const Icon = (LucideIcons as unknown as Record<string, React.ElementType>)[iconName];
  return Icon || LucideIcons.HelpCircle;
};

interface Props {
  onItemClick: () => void;
}

export function ModuleRegistryUserMenu({ onItemClick }: Props) {
  const { user } = useAuth();
  const [userMenuItems, setUserMenuItems] = useState<ModuleUserMenuItem[]>([]);

  const loadUserMenuItems = useCallback(() => {
    try {
      // console.log('🔍 [ModuleRegistryUserMenu] Carregando itens do menu do usuário...');
      const items = moduleRegistry.getUserMenuItems(user?.role);
      setUserMenuItems(items);
      // console.log('✅ [ModuleRegistryUserMenu] Itens carregados:', items.length);
      // console.log('👤 [ModuleRegistryUserMenu] Detalhes:', items);
    } catch (error) {
      console.error('❌ [ModuleRegistryUserMenu] Erro ao carregar menu do usuário:', error);
    }
  }, [user?.role]);

  useEffect(() => {
    loadUserMenuItems();
  }, [user, loadUserMenuItems]);

  // Escuta mudanças no status dos módulos
  useEffect(() => {
    const handleModuleStatusChange = () => {
      loadUserMenuItems();
    };

    window.addEventListener('moduleStatusChanged', handleModuleStatusChange);
    return () => {
      window.removeEventListener('moduleStatusChanged', handleModuleStatusChange);
    };
  }, [loadUserMenuItems]);



  if (userMenuItems.length === 0) {
    // console.log('⚠️ [ModuleRegistryUserMenu] Nenhum item para renderizar');
    return null;
  }

  // console.log('✅ [ModuleRegistryUserMenu] Renderizando', userMenuItems.length, 'item(s)');

  return (
    <>
      {userMenuItems.map((item) => {
        const Icon = getIconComponent(item.icon || 'Circle');
        return (
          <a
            key={item.id}
            href={item.href}
            onClick={onItemClick}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-skin-surface-hover"
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </a>
        );
      })}
    </>
  );
}
