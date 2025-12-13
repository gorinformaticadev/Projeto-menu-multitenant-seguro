/**
 * CARREGADOR EXPLÍCITO DE MÓDULOS - FRONTEND PRINCIPAL
 * 
 * Sistema determinístico para carregar módulos
 * SEM auto-discovery, SEM lógica mágica
 */

import { moduleRegistry, ModuleContribution } from './module-registry';

/**
 * LISTA EXPLÍCITA DE MÓDULOS DISPONÍVEIS
 * 
 * Para adicionar um novo módulo:
 * 1. Adicione o ID na lista abaixo
 * 2. Implemente a função de registro correspondente
 * 3. Adicione a chamada em loadAllModules()
 */
const AVAILABLE_MODULES = [
  'core',
  'sample-module',
  'modeloModel',
  'exemploAssets',
  // 'whatsboost' // Descomente para ativar
] as const;

type ModuleId = typeof AVAILABLE_MODULES[number];

/**
 * Carrega todos os módulos de forma explícita
 */
export async function loadAllModules(): Promise<void> {
  console.log('🚀 Iniciando carregamento de módulos...');

  for (const moduleId of AVAILABLE_MODULES) {
    try {
      await loadModule(moduleId);
    } catch (error) {
      console.error(`❌ Erro ao carregar módulo ${moduleId}:`, error);
      // Continua carregando outros módulos mesmo se um falhar
    }
  }

  console.log('✅ Carregamento de módulos concluído');
  moduleRegistry.debug();
}

/**
 * Carrega um módulo específico
 */
async function loadModule(moduleId: ModuleId): Promise<void> {
  switch (moduleId) {
    case 'core':
      registerCoreModule();
      break;
    
    case 'sample-module':
      registerSampleModule();
      break;
    
    case 'modeloModel':
      registerModeloModelModule();
      break;
    
    case 'exemploAssets':
      registerExemploAssetsModule();
      break;
    
    default:
      console.warn(`⚠️ Módulo não implementado: ${moduleId}`);
  }
}

/**
 * REGISTRO DO MÓDULO CORE
 */
function registerCoreModule(): void {
  const contribution: ModuleContribution = {
    id: 'core',
    name: 'Sistema Core',
    version: '1.0.0',
    enabled: true,
    
    sidebar: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        href: '/dashboard',
        icon: 'LayoutDashboard',
        order: 1
      },
      // Itens do grupo Administração (ordem 2-5 para ficar logo após Dashboard)
      {
        id: 'empresas',
        name: 'Empresas',
        href: '/empresas',
        icon: 'Building2',
        order: 2,
        roles: ['SUPER_ADMIN'],
        group: 'administration'
      },
      {
        id: 'usuarios',
        name: 'Usuários',
        href: '/usuarios',
        icon: 'User',
        order: 3,
        roles: ['SUPER_ADMIN', 'ADMIN'],
        group: 'administration'
      },
      {
        id: 'logs',
        name: 'Logs de Auditoria',
        href: '/logs',
        icon: 'FileText',
        order: 4,
        roles: ['SUPER_ADMIN'],
        group: 'administration'
      },
      {
        id: 'configuracoes',
        name: 'Configurações',
        href: '/configuracoes',
        icon: 'Settings',
        order: 5,
        roles: ['SUPER_ADMIN', 'ADMIN'],
        group: 'administration'
      }
    ]
  };

  moduleRegistry.register(contribution);
}

/**
 * REGISTRO DO MÓDULO SAMPLE
 */
function registerSampleModule(): void {
  const contribution: ModuleContribution = {
    id: 'sample-module',
    name: 'Módulo de Exemplo',
    version: '1.0.0',
    enabled: true,
    
    sidebar: [
      {
        id: 'sample',
        name: 'Exemplo',
        href: '/sample',
        icon: 'HelpCircle',
        order: 100 // Módulos começam na ordem 100+
      }
    ]
  };

  moduleRegistry.register(contribution);
}

/**
 * REGISTRO DO MÓDULO MODELO MODEL
 */
function registerModeloModelModule(): void {
  const contribution: ModuleContribution = {
    id: 'modeloModel',
    name: 'Modelo Model',
    version: '1.0.0',
    enabled: true,
    
    sidebar: [
      {
        id: 'modelo',
        name: 'Modelo',
        href: '/modelo',
        icon: 'FileText',
        order: 110 // Módulos começam na ordem 100+
      }
    ]
  };

  moduleRegistry.register(contribution);
}

/**
 * REGISTRO DO MÓDULO EXEMPLO ASSETS
 */
function registerExemploAssetsModule(): void {
  const contribution: ModuleContribution = {
    id: 'exemploAssets',
    name: 'Exemplo Assets',
    version: '1.0.0',
    enabled: true,
    
    sidebar: [
      {
        id: 'assets',
        name: 'Assets',
        href: '/assets',
        icon: 'Shield',
        order: 120 // Módulos começam na ordem 100+
      }
    ]
  };

  moduleRegistry.register(contribution);
}

/**
 * TEMPLATE PARA NOVOS MÓDULOS
 * 
 * function registerNomeDoModuloModule(): void {
 *   const contribution: ModuleContribution = {
 *     id: 'nome-do-modulo',
 *     name: 'Nome do Módulo',
 *     version: '1.0.0',
 *     enabled: true,
 *     
 *     sidebar: [
 *       {
 *         id: 'modulo-item',
 *         name: 'Item do Módulo',
 *         href: '/modulo',
 *         icon: 'IconName',
 *         order: 60,
 *         roles: ['ADMIN', 'USER'] // opcional
 *       }
 *     ]
 *   };
 * 
 *   moduleRegistry.register(contribution);
 * }
 */