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
      id: 'm-dulo-exemplo-novo-main',
      label: 'Módulo Exemplo Novo',
      path: '/m-dulo-exemplo-novo',
      icon: 'FileMódulo',
      order: 954,
      permissions: ['m-dulo-exemplo-novo.view']
    },
    {
      id: 'm-dulo-exemplo-novo-settings',
      label: 'Configurações',
      path: '/m-dulo-exemplo-novo/settings',
      icon: 'Settings',
      order: 201,
      parentId: 'm-dulo-exemplo-novo-main',
      permissions: ['m-dulo-exemplo-novo.settings']
    }
  ];

  // Definir permissões do módulo
  const permissions: PermissionConfig[] = [
    {
      name: 'm-dulo-exemplo-novo.view',
      description: 'Visualizar módulo mduloexemplonovo',
      category: 'Módulo Exemplo Novo'
    },
    {
      name: 'm-dulo-exemplo-novo.settings',
      description: 'Gerenciar configurações do módulo mduloexemplonovo',
      category: 'Módulo Exemplo Novo'
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