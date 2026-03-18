/**
 * Utilities and types for module lifecycle UI.
 * Must stay aligned with backend runtime status and lifecycle contracts.
 */

export type ModuleStatus =
  | 'detected'
  | 'installed'
  | 'uploaded'
  | 'pending_dependencies'
  | 'dependencies_installed'
  | 'dependency_conflict'
  | 'db_ready'
  | 'ready'
  | 'active'
  | 'disabled'
  | 'corrupted';

export type ModuleLifecycleCurrent =
  | 'uploaded'
  | 'pending_dependencies'
  | 'dependencies_installed'
  | 'dependency_conflict'
  | 'files_installed'
  | 'db_ready'
  | 'ready'
  | 'approved'
  | 'active'
  | 'disabled'
  | 'error';

export type ModuleLifecycleStepStatus = 'pending' | 'ready' | 'blocked' | 'error';

export interface ModuleNpmDependency {
  packageName: string;
  version: string;
  target: 'backend' | 'frontend';
  status: 'pending' | 'installed' | 'conflict';
  note?: string | null;
}

export interface ModuleNpmDependencySummary {
  backend: ModuleNpmDependency[];
  frontend: ModuleNpmDependency[];
  total: number;
  pending: number;
  installed: number;
  conflicts: number;
}

export interface ModuleLifecycleStep {
  status: ModuleLifecycleStepStatus;
  detail: string;
}

export interface ModuleLifecycle {
  current: ModuleLifecycleCurrent;
  blockers: string[];
  dependencies: string[];
  npmDependencies: ModuleNpmDependencySummary;
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

export interface AllowedModuleActions {
  updateDatabase: boolean;
  runMigrationsSeeds: boolean;
  activate: boolean;
  deactivate: boolean;
  uninstall: boolean;
  viewInfo: boolean;
}

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
  npmDependencies?: ModuleNpmDependencySummary;
}

export function getAllowedModuleActions(
  module: Pick<InstalledModule, 'status' | 'lifecycle'>,
): AllowedModuleActions {
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
      activate: status !== 'active' && filesReady && dependenciesReady && databaseReady && buildReady,
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
        viewInfo: true,
      };

    case 'uploaded':
    case 'pending_dependencies':
    case 'dependency_conflict':
      return {
        updateDatabase: false,
        runMigrationsSeeds: false,
        activate: false,
        deactivate: false,
        uninstall: true,
        viewInfo: true,
      };

    case 'installed':
    case 'dependencies_installed':
      return {
        updateDatabase: true,
        runMigrationsSeeds: true,
        activate: false,
        deactivate: false,
        uninstall: true,
        viewInfo: true,
      };

    case 'db_ready':
    case 'ready':
      return {
        updateDatabase: false,
        runMigrationsSeeds: true,
        activate: true,
        deactivate: false,
        uninstall: true,
        viewInfo: true,
      };

    case 'active':
      return {
        updateDatabase: false,
        runMigrationsSeeds: true,
        activate: false,
        deactivate: true,
        uninstall: false,
        viewInfo: true,
      };

    case 'disabled':
      return {
        updateDatabase: false,
        runMigrationsSeeds: true,
        activate: true,
        deactivate: false,
        uninstall: true,
        viewInfo: true,
      };

    default:
      return {
        updateDatabase: false,
        runMigrationsSeeds: false,
        activate: false,
        deactivate: false,
        uninstall: false,
        viewInfo: true,
      };
  }
}

export function getStatusBadgeConfig(status: ModuleStatus) {
  switch (status) {
    case 'detected':
      return {
        label: 'Detectado',
        color: 'bg-skin-background-elevated text-skin-text border-skin-border',
        icon: 'SCAN',
      };

    case 'uploaded':
      return {
        label: 'Upload concluido',
        color: 'bg-skin-background-elevated text-skin-text border-skin-border',
        icon: 'UP',
      };

    case 'pending_dependencies':
      return {
        label: 'Dependencias pendentes',
        color: 'bg-skin-warning/15 text-skin-warning border-skin-warning/30',
        icon: 'WAIT',
      };

    case 'dependency_conflict':
      return {
        label: 'Conflito de dependencia',
        color: 'bg-skin-danger/15 text-skin-danger border-skin-danger/30',
        icon: 'ERR',
      };

    case 'installed':
    case 'dependencies_installed':
      return {
        label: 'Dependencias instaladas',
        color: 'bg-skin-warning/15 text-skin-warning border-skin-warning/30',
        icon: 'NPM',
      };

    case 'db_ready':
    case 'ready':
      return {
        label: 'Pronto',
        color: 'bg-skin-info/15 text-skin-info border-skin-info/30',
        icon: 'DB',
      };

    case 'active':
      return {
        label: 'Ativo',
        color: 'bg-skin-success/15 text-skin-success border-skin-success/30',
        icon: 'ON',
      };

    case 'disabled':
      return {
        label: 'Desativado',
        color: 'bg-skin-warning/15 text-skin-warning border-skin-warning/30',
        icon: 'OFF',
      };

    case 'corrupted':
      return {
        label: 'Corrompido',
        color: 'bg-skin-danger/15 text-skin-danger border-skin-danger/30',
        icon: 'BAD',
      };

    default:
      return {
        label: 'Desconhecido',
        color: 'bg-skin-background-elevated text-skin-text border-skin-border',
        icon: '?',
      };
  }
}

export function getStatusGuidance(status: ModuleStatus) {
  switch (status) {
    case 'detected':
      return {
        title: 'Modulo detectado',
        message: 'O modulo foi detectado no sistema, mas ainda nao entrou no fluxo de instalacao.',
        suggestion: 'Reenvie o ZIP pelo instalador para iniciar o ciclo oficial.',
      };

    case 'uploaded':
      return {
        title: 'Upload concluido',
        message: 'Os arquivos do modulo foram recebidos e validados.',
        suggestion: 'Aguarde a etapa de analise de dependencias NPM.',
      };

    case 'pending_dependencies':
      return {
        title: 'Dependencias NPM pendentes',
        message: 'Ainda existem dependencias NPM para instalar antes de preparar o banco.',
        suggestion: 'Resolva pendencias e execute nova sincronizacao.',
      };

    case 'dependency_conflict':
      return {
        title: 'Conflito de dependencias',
        message: 'O modulo exige versoes NPM incompativeis com o projeto atual.',
        suggestion: 'Ajuste as versoes no modulo ou resolva o conflito no projeto.',
      };

    case 'installed':
    case 'dependencies_installed':
      return {
        title: 'Pronto para preparar banco',
        message: 'Dependencias ja foram validadas. Falta preparar o banco do modulo.',
        suggestion: 'Clique em "Preparar banco".',
      };

    case 'db_ready':
    case 'ready':
      return {
        title: 'Pronto para ativar',
        message: 'Banco de dados preparado e modulo apto para ativacao global.',
        suggestion: 'Clique em "Ativar".',
      };

    case 'active':
      return {
        title: 'Modulo operacional',
        message: 'Este modulo esta ativo e disponivel para uso.',
        suggestion: 'Desative apenas se precisar interromper o uso.',
      };

    case 'disabled':
      return {
        title: 'Modulo desativado',
        message: 'O modulo esta desativado, mas com dados preservados.',
        suggestion: 'Voce pode reativar ou desinstalar.',
      };

    case 'corrupted':
      return {
        title: 'Integridade comprometida',
        message: 'Foram detectados problemas fisicos nos arquivos do modulo.',
        suggestion: 'Reinstale o modulo ou desinstale para limpar o estado.',
      };

    default:
      return {
        title: 'Status desconhecido',
        message: 'O status retornado nao e reconhecido pelo frontend.',
        suggestion: 'Verifique logs e versao do backend.',
      };
  }
}

export function getLifecycleStepBadgeClass(status: ModuleLifecycleStepStatus) {
  switch (status) {
    case 'ready':
      return 'bg-skin-success/10 text-skin-success border-skin-success/30';
    case 'blocked':
      return 'bg-skin-warning/10 text-skin-warning border-skin-warning/30';
    case 'error':
      return 'bg-skin-danger/10 text-skin-danger border-skin-danger/30';
    default:
      return 'bg-skin-background-elevated text-skin-text border-skin-border';
  }
}

export function getDisabledTooltip(
  action: keyof AllowedModuleActions,
  module: Pick<InstalledModule, 'status' | 'lifecycle'>,
): string {
  const { status, lifecycle } = module;

  if (lifecycle) {
    switch (action) {
      case 'updateDatabase':
        if (lifecycle.steps.files.status !== 'ready') return lifecycle.steps.files.detail;
        if (lifecycle.steps.dependencies.status !== 'ready') return lifecycle.steps.dependencies.detail;
        if (lifecycle.steps.database.status === 'ready') return 'Preparacao de banco ja realizada';
        return 'A preparacao oficial do banco esta bloqueada no estado atual';

      case 'activate':
        if (status === 'active') return 'Modulo ja esta ativo';
        if (lifecycle.steps.files.status !== 'ready') return lifecycle.steps.files.detail;
        if (lifecycle.steps.dependencies.status !== 'ready') return lifecycle.steps.dependencies.detail;
        if (lifecycle.steps.database.status !== 'ready') return lifecycle.steps.database.detail;
        if (lifecycle.steps.build.status === 'blocked') return lifecycle.steps.build.detail;
        return 'Status atual nao permite ativacao';

      case 'deactivate':
        if (status !== 'active') return 'Apenas modulos ativos podem ser desativados';
        return '';

      case 'uninstall':
        if (status === 'active') return 'Desative o modulo antes de desinstalar';
        if (lifecycle.steps.files.status === 'error') {
          return 'Modulo com integridade invalida. A desinstalacao ainda e permitida.';
        }
        return '';

      case 'runMigrationsSeeds':
        return 'Use a preparacao oficial do banco do modulo';

      default:
        return '';
    }
  }

  switch (action) {
    case 'updateDatabase':
      if (status === 'db_ready' || status === 'ready' || status === 'active' || status === 'disabled') {
        return 'Preparacao de banco ja realizada';
      }
      if (status === 'pending_dependencies' || status === 'uploaded') {
        return 'Dependencias NPM ainda nao foram instaladas';
      }
      if (status === 'dependency_conflict') {
        return 'Conflito de dependencias NPM impede a preparacao do banco';
      }
      return 'Status atual nao permite atualizacao de banco';

    case 'runMigrationsSeeds':
      if (status === 'detected') return 'Modulo ainda nao foi instalado';
      return 'Status atual nao permite execucao de migrations/seeds';

    case 'activate':
      if (status === 'installed' || status === 'dependencies_installed') {
        return 'Execute preparacao de banco primeiro';
      }
      if (status === 'pending_dependencies' || status === 'uploaded') {
        return 'Dependencias NPM pendentes';
      }
      if (status === 'dependency_conflict') {
        return 'Conflito de dependencias NPM';
      }
      if (status === 'active') return 'Modulo ja esta ativo';
      return 'Status atual nao permite ativacao';

    case 'deactivate':
      if (status !== 'active') return 'Apenas modulos ativos podem ser desativados';
      return '';

    case 'uninstall':
      if (status === 'active') return 'Desative o modulo antes de desinstalar';
      return '';

    default:
      return '';
  }
}
