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
      id: 'module-template-main',
      label: 'Module Template',
      path: '/module-template',
      icon: 'FileTemplate',
      order: 200,
      permissions: ['module-template.view']
    },
    {
      id: 'module-template-settings',
      label: 'Configurações',
      path: '/module-template/settings',
      icon: 'Settings',
      order: 201,
      parentId: 'module-template-main',
      permissions: ['module-template.settings']
    }
  ];

  // Definir permissões do módulo
  const permissions: PermissionConfig[] = [
    {
      name: 'module-template.view',
      description: 'Visualizar módulo template',
      category: 'Module Template'
    },
    {
      name: 'module-template.settings',
      description: 'Gerenciar configurações do módulo template',
      category: 'Module Template'
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