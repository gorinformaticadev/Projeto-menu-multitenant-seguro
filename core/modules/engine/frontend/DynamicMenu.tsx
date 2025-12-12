"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ModuleMenuItem {
  name: string;
  icon: string;
  path: string;
}

export function DynamicMenu() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<ModuleMenuItem[]>([]);

  useEffect(() => {
    loadMenuItems();
  }, [user]);

  const loadMenuItems = async () => {
    try {
      // Em uma implementação real, isso faria chamadas à API
      // para obter os menus dos módulos ativos para o tenant do usuário
      
      // Por enquanto, vamos simular alguns itens de menu
      const baseMenuItems: ModuleMenuItem[] = [
        {
          name: "Dashboard",
          icon: "LayoutDashboard",
          path: "/dashboard"
        }
      ];

      // Adicionar itens específicos por role
      if (user?.role === "SUPER_ADMIN") {
        baseMenuItems.push(
          {
            name: "Empresas",
            icon: "Building2",
            path: "/empresas"
          },
          {
            name: "Logs de Auditoria",
            icon: "FileText",
            path: "/logs"
          }
        );
      }

      if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") {
        baseMenuItems.push(
          {
            name: "Usuários",
            icon: "User",
            path: "/usuarios"
          },
          {
            name: "Configurações",
            icon: "Settings",
            path: "/configuracoes"
          }
        );
      }

      setMenuItems(baseMenuItems);
    } catch (error) {
      console.error('Erro ao carregar menus:', error);
    }
  };

  return menuItems;
}