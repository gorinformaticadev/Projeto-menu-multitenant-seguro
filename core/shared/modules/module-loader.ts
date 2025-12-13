/**
 * CARREGADOR EXPLÍCITO DE MÓDULOS
 * 
 * Sistema determinístico para carregar módulos externos
 * SEM auto-discovery, SEM lógica mágica
 * 
 * Cada módulo deve ser explicitamente declarado aqui
 */

import { moduleRegistry } from '../registry/module-registry';
import { ModuleContribution } from '../types/module.types';

/**
 * LISTA EXPLÍCITA DE MÓDULOS DISPONÍVEIS
 * 
 * Para adicionar um novo módulo:
 * 1. Adicione o ID na lista abaixo
 * 2. Implemente a função de registro correspondente
 * 3. Adicione a chamada em loadExternalModules()
 */
const AVAILABLE_MODULES = [
  'sample-module',
  // 'financeiro',
  // 'os',
  // 'whatsboost'
] as const;

type ModuleId = typeof AVAILABLE_MODULES[number];

/**
 * Carrega todos os módulos externos registrados
 */
export async function loadExternalModules(): Promise<void> {
  console.log('Carregando módulos externos...');

  for (const moduleId of AVAILABLE_MODULES) {
    try {
      await loadModule(moduleId);
    } catch (error) {
      console.error(`Erro ao carregar módulo ${moduleId}:`, error);
      // Continua carregando outros módulos mesmo se um falhar
    }
  }

  console.log('Carregamento de módulos externos concluído');
}

/**
 * Carrega um módulo específico
 */
async function loadModule(moduleId: ModuleId): Promise<void> {
  switch (moduleId) {
    case 'sample-module':
      await registerSampleModule();
      break;
    
    // case 'financeiro':
    //   await registerFinanceiroModule();
    //   break;
    
    // case 'os':
    //   await registerOSModule();
    //   break;
    
    default:
      console.warn(`Módulo não implementado: ${moduleId}`);
  }
}

/**
 * REGISTRO DO MÓDULO SAMPLE
 */
async function registerSampleModule(): Promise<void> {
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
        icon: 'Shield',
        order: 50
      }
    ],
    
    dashboard: [
      {
        id: 'sample-widget',
        name: 'Widget de Exemplo',
        component: 'SampleWidget',
        order: 10,
        size: 'small'
      }
    ]
  };

  moduleRegistry.register(contribution);
  console.log('Módulo Sample registrado');
}

/**
 * TEMPLATE PARA NOVOS MÓDULOS
 * 
 * async function registerNomeDoModuloModule(): Promise<void> {
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
 *     ],
 *     
 *     dashboard: [
 *       {
 *         id: 'modulo-widget',
 *         name: 'Widget do Módulo',
 *         component: 'ModuloWidget',
 *         order: 20,
 *         size: 'medium'
 *       }
 *     ]
 *   };
 * 
 *   moduleRegistry.register(contribution);
 *   console.log('Módulo Nome registrado');
 * }
 */