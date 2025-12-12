"use client";

import { useState, useEffect } from 'react';

interface MenuItem {
  name: string;
  icon: string;
  path: string;
}

const MenuLoader = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    loadModuleMenus();
  }, []);

  /**
   * Carrega os itens de menu de todos os módulos disponíveis
   */
  const loadModuleMenus = async () => {
    try {
      // Em uma implementação real, isso faria chamadas à API
      // para obter os menus dos módulos ativos
      
      // Por enquanto, vamos simular alguns itens de menu
      const simulatedMenuItems: MenuItem[] = [
        {
          name: "Dashboard",
          icon: "LayoutDashboard",
          path: "/dashboard"
        },
        {
          name: "Empresas",
          icon: "Building2",
          path: "/empresas"
        },
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
      ];

      setMenuItems(simulatedMenuItems);
    } catch (error) {
      console.error('Erro ao carregar menus dos módulos:', error);
    }
  };

  return menuItems;
};

export default MenuLoader;