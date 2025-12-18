/**
 * Utilidades e tipos para o sistema de módulos
 * Implementa controle rigoroso de ciclo de vida conforme design document
 */

// Tipos de status do módulo (deve coincidir com backend)
export type ModuleStatus = 'detected' | 'installed' | 'db_ready' | 'active' | 'disabled';

// Interface de ações permitidas
export interface AllowedModuleActions {
  updateDatabase: boolean;
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
}

/**
 * Função de controle de ações permitidas por status
 * Implementação conforme matriz de controle do design document
 * 
 * REGRAS:
 * - detected: Nenhuma ação permitida (apenas visualizar)
 * - installed: Atualizar Banco + Desinstalar
 * - db_ready: Ativar + Desinstalar
 * - active: Desativar (apenas)
 * - disabled: Ativar + Desinstalar
 */
export function getAllowedModuleActions(status: ModuleStatus): AllowedModuleActions {
  switch (status) {
    case 'detected':
      return {
        updateDatabase: false,
        activate: false,
        deactivate: false,
        uninstall: false,
        viewInfo: true
      };
    
    case 'installed':
      return {
        updateDatabase: true,
        activate: false,
        deactivate: false,
        uninstall: true,
        viewInfo: true
      };
    
    case 'db_ready':
      return {
        updateDatabase: false,
        activate: true,
        deactivate: false,
        uninstall: true,
        viewInfo: true
      };
    
    case 'active':
      return {
        updateDatabase: false,
        activate: false,
        deactivate: true,
        uninstall: false,
        viewInfo: true
      };
    
    case 'disabled':
      return {
        updateDatabase: false,
        activate: true,
        deactivate: false,
        uninstall: true,
        viewInfo: true
      };
    
    default:
      // Fallback seguro: bloquear tudo
      return {
        updateDatabase: false,
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
        suggestion: 'Clique em "Atualizar Banco"'
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

/**
 * Tooltips para botões desabilitados
 */
export function getDisabledTooltip(action: keyof AllowedModuleActions, status: ModuleStatus): string {
  switch (action) {
    case 'updateDatabase':
      if (status === 'db_ready' || status === 'active' || status === 'disabled') {
        return 'Preparação de banco já realizada';
      }
      return 'Status atual não permite atualização de banco';
    
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
