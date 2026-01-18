/**
 * MÓDULO CORE - Registra funcionalidades básicas do sistema
 * 
 * Este é o único módulo que pode ser considerado "especial"
 * pois representa as funcionalidades básicas do core
 */

import { moduleRegistry } from '../registry/module-registry';
import { ModuleContribution } from '../types/module.types';

/**
 * Registra o módulo core com suas funcionalidades básicas
 */
export function registerCoreModule(): void {
  const coreContribution: ModuleContribution = {
    id: 'core',
    name: 'Sistema Core',
    version: '1.0.0',
    enabled: true,
    
    // Itens básicos do sidebar que sempre existem
    sidebar: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        href: '/dashboard',
        icon: 'LayoutDashboard',
        order: 1
      },
      {
        id: 'empresas',
        name: 'Empresas',
        href: '/empresas',
        icon: 'Building2',
        order: 10,
        roles: ['SUPER_ADMIN']
      },
      {
        id: 'usuarios',
        name: 'Usuários',
        href: '/usuarios',
        icon: 'User',
        order: 20,
        roles: ['SUPER_ADMIN', 'ADMIN']
      },
      {
        id: 'logs',
        name: 'Logs de Auditoria',
        href: '/logs',
        icon: 'FileText',
        order: 30,
        roles: ['SUPER_ADMIN']
      },
      {
        id: 'configuracoes',
        name: 'Configurações',
        href: '/configuracoes',
        icon: 'Settings',
        order: 40,
        roles: ['SUPER_ADMIN', 'ADMIN']
      }
    ],

    // Widgets básicos do dashboard
    dashboard: [
      {
        id: 'welcome-widget',
        name: 'Bem-vindo',
        component: 'WelcomeWidget',
        order: 1,
        size: 'large'
      },
      {
        id: 'stats-widget',
        name: 'Estatísticas',
        component: 'StatsWidget',
        order: 2,
        size: 'medium',
        roles: ['SUPER_ADMIN', 'ADMIN']
      }
    ],

    // Itens do menu do usuário
    userMenu: [
      {
        id: 'profile',
        name: 'Meu Perfil',
        href: '/perfil',
        icon: 'User',
        order: 1
      },
      {
        id: 'preferences',
        name: 'Preferências',
        href: '/preferencias',
        icon: 'Settings',
        order: 2
      }
    ]
  };

  // Registra o módulo core
  moduleRegistry.register(coreContribution);
  }