/**
 * Utilidades e tipos para o sistema de módulos
 * Implementa controle rigoroso de ciclo de vida conforme design document
 */

// Tipos de status do módulo (deve coincidir com backend)
export type ModuleStatus = 'detected' | 'installed' | 'db_ready' | 'active' | 'disabled' | 'corrupted';
export type ModuleLifecycleCurrent = 'uploaded' | 'files_installed' | 'db_ready' | 'approved' | 'active' | 'disabled' | 'error';
export type ModuleLifecycleStepStatus = 'pending' | 'ready' | 'blocked' | 'error';

export interface ModuleLifecycleStep {
  status: ModuleLifecycleStepStatus;
  detail: string;
}

export interface ModuleLifecycle {
  current: ModuleLifecycleCurrent;
  blockers: string[];
  dependencies: string[];
  frontendInspectMode: 'filesystem' | 'unavailable' | 'not_required';
  frontendValidationLevel: 'structural' | 'permissive' | 'not_required';
  steps: {
    files: ModuleLifecycleStep;
    database: ModuleLifecycleStep;
    dependencies: ModuleLifecycleStep;
    build: ModuleLifecycleStep;
    approval: ModuleLifecycleStep;
    activation: ModuleLifecycleStep;
  };
}

// Interface de ações permitidas
export interface AllowedModuleActions {
  updateDatabase: boolean;
  runMigrationsSeeds: boolean;
  activate: boolean;
  deactivate: boolean;
  uninstall: boolean;
  viewInfo: boolean;
}

// Interface de módulo instalado
export interface InstalledModule {
  slug: string;
  name: string;
  version: string;
  description: string;
  status: ModuleStatus;
  hasBackend: boolean;
  hasFrontend: boolean;
  installedAt: string;
  activatedAt: string | null;
  stats?: {
    tenants: number;
    migrations: number;
    menus: number;
  };
  lifecycle?: ModuleLifecycle;
}

/**
 * Função de controle de ações permitidas por status
 * Implementação conforme matriz de controle do design document
 * 
 * REGRAS:
 * - detected: Nenhuma ação permitida (apenas visualizar)
 * - installed: Atualizar Banco + Executar Migrations/Seeds + Desinstalar
 * - db_ready: Ativar + Executar Migrations/Seeds + Desinstalar
 * - active: Desativar + Executar Migrations/Seeds (apenas)
 * - disabled: Ativar + Executar Migrations/Seeds + Desinstalar
 */
export function getAllowedModuleActions(module: Pick<InstalledModule, 'status' | 'lifecycle'>): AllowedModuleActions {
  const { status, lifecycle } = module;

  if (lifecycle) {
    const filesReady = lifecycle.steps.files.status === 'ready';
    const dependenciesReady = lifecycle.steps.dependencies.status === 'ready';
    const databaseReady = lifecycle.steps.database.status === 'ready';
    const buildReady = lifecycle.steps.build.status !== 'blocked';

    return {
      updateDatabase:
        status !== 'active' &&
        status !== 'disabled' &&
        filesReady &&
        dependenciesReady &&
        !databaseReady,
      runMigrationsSeeds: false,
      activate:
        status !== 'active' &&
        filesReady &&
        dependenciesReady &&
        databaseReady &&
        buildReady,
      deactivate: status === 'active',
      uninstall: status !== 'active' && status !== 'detected',
      viewInfo: true,
    };
  }

  switch (status) {
    case 'detected':
      return {
        updateDatabase: false,
        runMigrationsSeeds: false,
        activate: false,
        deactivate: false,
        uninstall: false,
        viewInfo: true
      };
    
    case 'installed':
      return {
        updateDatabase: true,
        runMigrationsSeeds: true,
        activate: false,
        deactivate: false,
        uninstall: true,
        viewInfo: true
      };
    
    case 'db_ready':
      return {
        updateDatabase: false,
        runMigrationsSeeds: true,
        activate: true,
        deactivate: false,
        uninstall: true,
        viewInfo: true
      };
    
    case 'active':
      return {
        updateDatabase: false,
        runMigrationsSeeds: true,
        activate: false,
        deactivate: true,
        uninstall: false,
        viewInfo: true
      };
    
    case 'disabled':
      return {
        updateDatabase: false,
        runMigrationsSeeds: true,
        activate: true,
        deactivate: false,
        uninstall: true,
        viewInfo: true
      };
    
    default:
      // Fallback seguro: bloquear tudo
      return {
        updateDatabase: false,
        runMigrationsSeeds: false,
        activate: false,
        deactivate: false,
        uninstall: false,
        viewInfo: true
      };
  }
}

/**
 * Configuração de badges de status
 * Retorna cor, label e ícone apropriados
 */
export function getStatusBadgeConfig(status: ModuleStatus) {
  switch (status) {
    case 'detected':
      return {
        label: 'Detectado',
        color: 'bg-gray-100 text-gray-800 border-gray-300',
        icon: '🔍'
      };
    
    case 'installed':
      return {
        label: 'Instalado',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        icon: '⏳'
      };
    
    case 'db_ready':
      return {
        label: 'Pronto',
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: '✓'
      };
    
    case 'active':
      return {
        label: 'Ativo',
        color: 'bg-green-100 text-green-800 border-green-300',
        icon: '✅'
      };
    
    case 'disabled':
      return {
        label: 'Desativado',
        color: 'bg-orange-100 text-orange-800 border-orange-300',
        icon: '⏸️'
      };
    
    default:
      return {
        label: 'Desconhecido',
        color: 'bg-gray-100 text-gray-800 border-gray-300',
        icon: '❓'
      };
  }
}

/**
 * Mensagens de orientação por status
 */
export function getStatusGuidance(status: ModuleStatus) {
  switch (status) {
    case 'detected':
      return {
        title: 'Módulo Detectado',
        message: 'Este módulo foi detectado mas ainda não foi processado',
        suggestion: 'Aguarde o processamento automático'
      };
    
    case 'installed':
      return {
        title: 'Preparação Pendente',
        message: 'Execute a preparação do banco de dados antes de ativar este módulo',
        suggestion: 'Clique em "Preparar Banco"'
      };
    
    case 'db_ready':
      return {
        title: 'Pronto para Ativar',
        message: 'Banco de dados preparado. Ative o módulo para torná-lo operacional',
        suggestion: 'Clique em "Ativar"'
      };
    
    case 'active':
      return {
        title: 'Módulo Operacional',
        message: 'Este módulo está ativo e operacional no sistema',
        suggestion: 'Você pode desativar se necessário'
      };
    
    case 'disabled':
      return {
        title: 'Módulo Desativado',
        message: 'Este módulo está temporariamente desativado. Dados preservados',
        suggestion: 'Você pode ativar novamente ou desinstalar'
      };
    
    default:
      return {
        title: 'Status Desconhecido',
        message: 'Status do módulo não reconhecido',
        suggestion: 'Verifique os logs do sistema'
      };
  }
}

export function getLifecycleStepBadgeClass(status: ModuleLifecycleStepStatus) {
  switch (status) {
    case 'ready':
      return 'bg-green-50 text-green-800 border-green-200';
    case 'blocked':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'error':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

/**
 * Tooltips para botões desabilitados
 */
export function getDisabledTooltip(action: keyof AllowedModuleActions, module: Pick<InstalledModule, 'status' | 'lifecycle'>): string {
  const { status, lifecycle } = module;

  if (lifecycle) {
    switch (action) {
      case 'updateDatabase':
        if (lifecycle.steps.files.status !== 'ready') {
          return lifecycle.steps.files.detail;
        }
        if (lifecycle.steps.dependencies.status !== 'ready') {
          return lifecycle.steps.dependencies.detail;
        }
        if (lifecycle.steps.database.status === 'ready') {
          return 'Preparação de banco já realizada';
        }
        return 'A preparação oficial do banco está bloqueada no estado atual';

      case 'activate':
        if (status === 'active') {
          return 'Módulo já está ativo';
        }
        if (lifecycle.steps.files.status !== 'ready') {
          return lifecycle.steps.files.detail;
        }
        if (lifecycle.steps.dependencies.status !== 'ready') {
          return lifecycle.steps.dependencies.detail;
        }
        if (lifecycle.steps.database.status !== 'ready') {
          return lifecycle.steps.database.detail;
        }
        if (lifecycle.steps.build.status === 'blocked') {
          return lifecycle.steps.build.detail;
        }
        return 'Status atual não permite ativação';

      case 'deactivate':
        if (status !== 'active') {
          return 'Apenas módulos ativos podem ser desativados';
        }
        return '';

      case 'uninstall':
        if (status === 'active') {
          return 'Desative o módulo antes de desinstalar';
        }
        if (lifecycle.steps.files.status === 'error') {
          return 'Módulo com integridade inválida. Desinstalação ainda é permitida.';
        }
        return '';

      case 'runMigrationsSeeds':
        return 'Use a preparação oficial do banco do módulo';

      default:
        return '';
    }
  }

  switch (action) {
    case 'updateDatabase':
      if (status === 'db_ready' || status === 'active' || status === 'disabled') {
        return 'Preparação de banco já realizada';
      }
      return 'Status atual não permite atualização de banco';
    
    case 'runMigrationsSeeds':
      if (status === 'detected') {
        return 'Módulo ainda não foi instalado';
      }
      return 'Status atual não permite execução de migrations/seeds';
    
    case 'activate':
      if (status === 'installed') {
        return 'Execute preparação de banco primeiro';
      }
      if (status === 'active') {
        return 'Módulo já está ativo';
      }
      return 'Status atual não permite ativação';
    
    case 'deactivate':
      if (status !== 'active') {
        return 'Apenas módulos ativos podem ser desativados';
      }
      return '';
    
    case 'uninstall':
      if (status === 'active') {
        return 'Desative o módulo antes de desinstalar';
      }
      return '';
    
    default:
      return '';
  }
}
