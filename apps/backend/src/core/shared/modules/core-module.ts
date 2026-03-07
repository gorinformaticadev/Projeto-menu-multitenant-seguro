/**
 * MODULO CORE - Registra funcionalidades basicas do sistema.
 *
 * Este e o unico modulo que pode ser considerado especial,
 * pois representa as funcionalidades basicas do core.
 */

import { moduleRegistry } from '../registry/module-registry';
import { ModuleContribution } from '../types/module.types';

/**
 * Registra o modulo core com suas funcionalidades basicas.
 */
export function registerCoreModule(): void {
  const coreContribution: ModuleContribution = {
    id: 'core',
    name: 'Sistema Core',
    version: '1.0.0',
    enabled: true,

    // Itens basicos do sidebar que sempre existem.
    sidebar: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        href: '/dashboard',
        icon: 'LayoutDashboard',
        order: 1,
      },
      {
        id: 'empresas',
        name: 'Empresas',
        href: '/empresas',
        icon: 'Building2',
        order: 10,
        roles: ['SUPER_ADMIN'],
      },
      {
        id: 'usuarios',
        name: 'Usuarios',
        href: '/usuarios',
        icon: 'User',
        order: 20,
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        id: 'logs',
        name: 'Logs de Auditoria',
        href: '/logs',
        icon: 'FileText',
        order: 30,
        roles: ['SUPER_ADMIN'],
      },
      {
        id: 'configuracoes',
        name: 'Configuracoes',
        href: '/configuracoes',
        icon: 'Settings',
        order: 40,
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
    ],

    // Itens do menu do usuario.
    userMenu: [
      {
        id: 'profile',
        name: 'Meu Perfil',
        href: '/perfil',
        icon: 'User',
        order: 1,
      },
      {
        id: 'preferences',
        name: 'Preferencias',
        href: '/preferencias',
        icon: 'Settings',
        order: 2,
      },
    ],
  };

  moduleRegistry.register(coreContribution);
}
