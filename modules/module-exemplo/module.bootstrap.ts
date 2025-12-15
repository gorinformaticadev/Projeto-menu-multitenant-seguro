/**
 * BOOTSTRAP ÚNICO DO MÓDULO - MODULE EXEMPLO
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
      id: 'module-exemplo-main',
      label: 'Module Exemplo',
      path: '/module-exemplo',
      icon: 'Package',
      order: 100,
      permissions: ['module-exemplo.view']
    },
    {
      id: 'module-exemplo-settings',
      label: 'Configurações',
      path: '/module-exemplo/settings',
      icon: 'Settings',
      order: 101,
      parentId: 'module-exemplo-main',
      permissions: ['module-exemplo.settings']
    }
  ];

  // Definir permissões do módulo
  const permissions: PermissionConfig[] = [
    {
      name: 'module-exemplo.view',
      description: 'Visualizar módulo exemplo',
      category: 'Module Exemplo'
    },
    {
      name: 'module-exemplo.settings',
      description: 'Gerenciar configurações do módulo exemplo',
      category: 'Module Exemplo'
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