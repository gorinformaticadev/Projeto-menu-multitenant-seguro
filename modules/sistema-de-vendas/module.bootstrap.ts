/**
 * BOOTSTRAP ÚNICO DO MÓDULO - MODULE TEMPLATE
 * 
 * Este arquivo é responsável por exportar a função registerModule()
 * que retorna todas as configurações do módulo para o core
 */

import { moduleConfig } from './module.config';
import { modulePages } from './module.pages';

// Tipos para o bootstrap
interface ModuleBootstrapResult {
  pages: typeof modulePages;
  routes: any[];
  menus: MenuConfig[];
  permissions: PermissionConfig[];
  config: typeof moduleConfig;
}

interface MenuConfig {
  id: string;
  label: string;
  path: string;
  icon: string;
  order: number;
  parentId?: string;
  permissions?: string[];
}

interface PermissionConfig {
  name: string;
  description: string;
  category: string;
}

/**
 * Função principal de registro do módulo
 * Esta é a única função que o core chama
 */
export function registerModule(): ModuleBootstrapResult {
  // Validar configuração antes de retornar
  if (!moduleConfig.enabled) {
    throw new Error('Módulo está desabilitado');
  }

  // Definir menus do módulo
  const menus: MenuConfig[] = [
    {
      id: 'sistema-de-vendas-main',
      label: 'Sistema de Vendas',
      path: '/sistema-de-vendas',
      icon: 'FileMódulo',
      order: 609,
      permissions: ['sistema-de-vendas.view']
    },
    {
      id: 'sistema-de-vendas-settings',
      label: 'Configurações',
      path: '/sistema-de-vendas/settings',
      icon: 'Settings',
      order: 201,
      parentId: 'sistema-de-vendas-main',
      permissions: ['sistema-de-vendas.settings']
    }
  ];

  // Definir permissões do módulo
  const permissions: PermissionConfig[] = [
    {
      name: 'sistema-de-vendas.view',
      description: 'Visualizar módulo sistemadevendas',
      category: 'Sistema de Vendas'
    },
    {
      name: 'sistema-de-vendas.settings',
      description: 'Gerenciar configurações do módulo sistemadevendas',
      category: 'Sistema de Vendas'
    }
  ];

  // Retornar configuração completa
  return {
    pages: modulePages,
    routes: [], // Rotas adicionais se necessário
    menus,
    permissions,
    config: moduleConfig
  };
}

// NUNCA executar código diretamente no import
// O core chamará registerModule() quando necessário