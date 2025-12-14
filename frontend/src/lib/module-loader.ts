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
  'module-exemplo',
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
    
    case 'module-exemplo':
      registerModuleExemploModule();
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
 * REGISTRO DO MODULE EXEMPLO
 * Demonstra todas as funcionalidades do sistema modular
 */
function registerModuleExemploModule(): void {
  const contribution: ModuleContribution = {
    id: 'module-exemplo',
    name: 'Module Exemplo',
    version: '1.0.0',
    enabled: true,
    
    // 1️⃣ Menu lateral - Grupo expansível "Module Exemplo"
    sidebar: [
      {
        id: 'module-exemplo-main',
        name: 'Página Principal',
        href: '/modules/module-exemplo',
        icon: 'Home',
        order: 100,
        group: 'module-exemplo'
      },
      {
        id: 'module-exemplo-settings',
        name: 'Configurações',
        href: '/modules/module-exemplo/settings',
        icon: 'Settings',
        order: 101,
        group: 'module-exemplo'
      }
    ],
    
    // 2️⃣ Widget para dashboard
    dashboard: [
      {
        id: 'module-exemplo-widget',
        name: 'Widget do Module Exemplo',
        component: 'ExemploWidget',
        module: 'module-exemplo',
        order: 50,
        size: 'medium'
      }
    ],
    
    // 3️⃣ Menu do usuário
    userMenu: [
      {
        id: 'module-exemplo-quick-access',
        name: 'Acesso rápido – Module Exemplo',
        href: '/modules/module-exemplo',
        icon: 'Package',
        order: 10
      }
    ],
    
    // 4️⃣ Notificações (agora integradas com o sistema centralizado)
    // As notificações são gerenciadas pelo sistema centralizado
    // Este módulo pode emitir notificações usando o NotificationsEmitter
    
    // 5️⃣ Taskbar
    taskbar: [
      {
        id: 'module-exemplo-taskbar',
        name: 'Atalho do Module Exemplo',
        href: '/modules/module-exemplo',
        icon: 'Package',
        order: 10
      }
    ]
  };

  moduleRegistry.register(contribution);
  console.log('✅ Module Exemplo registrado com TODAS as funcionalidades');
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