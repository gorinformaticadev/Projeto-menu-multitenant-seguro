export type PlatformUpdateMode = 'docker' | 'native';

export type PlatformUpdateStepCode =
  | 'starting'
  | 'precheck'
  | 'prepare'
  | 'download'
  | 'install_dependencies'
  | 'build_prisma_client'
  | 'build_backend'
  | 'build_frontend'
  | 'package_frontend_assets'
  | 'validate_frontend_artifact'
  | 'pre_swap_smoke_test'
  | 'migrate'
  | 'seed'
  | 'enable_maintenance'
  | 'publish_release'
  | 'restart_pm2'
  | 'validate_backend_storage'
  | 'post_deploy_validation'
  | 'cleanup_old_releases'
  | 'pull_images'
  | 'recreate_containers'
  | 'healthcheck_frontend'
  | 'healthcheck_backend'
  | 'completed'
  | 'rollback'
  | 'idle'
  | 'unknown';

export type PlatformUpdateStepStatus = 'idle' | 'running' | 'completed' | 'failed' | 'unknown';

export type PlatformUpdateStepSource =
  | 'state_file'
  | 'partial_state_recovery'
  | 'log_recovery'
  | 'last_good_state'
  | 'fallback'
  | 'none';

export type PlatformStepPresentation = {
  code: PlatformUpdateStepCode;
  label: string;
  raw: string | null;
  source: PlatformUpdateStepSource;
  detail: string | null;
  status: PlatformUpdateStepStatus;
};

type PlatformUpdateStepDefinition = {
  code: PlatformUpdateStepCode;
  label: string;
  aliases: string[];
  logPatterns?: RegExp[];
};

const STEP_DEFINITIONS: PlatformUpdateStepDefinition[] = [
  { code: 'idle', label: 'Ocioso', aliases: ['idle'] },
  {
    code: 'starting',
    label: 'Inicialização do update',
    aliases: ['starting', 'init', 'api-triggered', 'job-started'],
    logPatterns: [/iniciando atualizacao/i, /update solicitado/i, /update iniciado/i],
  },
  { code: 'precheck', label: 'Validação inicial', aliases: ['precheck'] },
  { code: 'prepare', label: 'Preparação da release', aliases: ['prepare'] },
  {
    code: 'download',
    label: 'Download da release',
    aliases: ['download', 'checkout'],
    logPatterns: [/baixando release tarball/i],
  },
  { code: 'install_dependencies', label: 'Instalação de dependências', aliases: ['install_dependencies', 'build_dependencies'] },
  { code: 'build_prisma_client', label: 'Geração do Prisma Client', aliases: ['build_prisma_client'] },
  { code: 'build_backend', label: 'Build do backend', aliases: ['build_backend'] },
  { code: 'build_frontend', label: 'Build do frontend', aliases: ['build_frontend'] },
  { code: 'package_frontend_assets', label: 'Empacotamento do frontend standalone', aliases: ['package_frontend_assets', 'build_frontend_assets'] },
  {
    code: 'validate_frontend_artifact',
    label: 'Validação do artefato do frontend',
    aliases: ['validate_frontend_artifact'],
    logPatterns: [/integridade do artefato standalone/i],
  },
  { code: 'pre_swap_smoke_test', label: 'Smoke test pré-swap', aliases: ['pre_swap_smoke_test'] },
  {
    code: 'migrate',
    label: 'Migração do banco',
    aliases: ['migrate'],
    logPatterns: [/executando migrations/i, /executando migration job/i],
  },
  {
    code: 'seed',
    label: 'Seed versionado',
    aliases: ['seed'],
    logPatterns: [/executando seed versionado/i],
  },
  {
    code: 'enable_maintenance',
    label: 'Ativação do modo manutenção',
    aliases: ['enable_maintenance'],
    logPatterns: [/maintenance mode ativado/i],
  },
  { code: 'publish_release', label: 'Publicação da release', aliases: ['publish_release', 'switch_release', 'switch'] },
  {
    code: 'restart_pm2',
    label: 'Reinício dos serviços',
    aliases: ['restart_pm2', 'restart', 'restart_services'],
    logPatterns: [/reiniciando pm2/i],
  },
  {
    code: 'validate_backend_storage',
    label: 'Validação do storage compartilhado',
    aliases: ['validate_backend_storage'],
    logPatterns: [/validando storage compartilhado do backend/i],
  },
  {
    code: 'post_deploy_validation',
    label: 'Validação pós-deploy',
    aliases: ['post_deploy_validation', 'healthcheck', 'validate'],
    logPatterns: [/validando backend, frontend, assets estaticos/i, /aguardando healthchecks/i],
  },
  {
    code: 'cleanup_old_releases',
    label: 'Limpeza de releases antigas',
    aliases: ['cleanup_old_releases'],
    logPatterns: [/limpando releases antigas/i],
  },
  {
    code: 'pull_images',
    label: 'Pull das imagens',
    aliases: ['pull_images'],
    logPatterns: [/efetuando pull das imagens/i],
  },
  {
    code: 'recreate_containers',
    label: 'Recriação dos containers da aplicação',
    aliases: ['recreate_containers'],
    logPatterns: [/recriando containers frontend\/backend/i],
  },
  {
    code: 'healthcheck_frontend',
    label: 'Healthcheck do frontend',
    aliases: ['healthcheck_frontend'],
    logPatterns: [/servico 'frontend'/i, /healthcheck do frontend/i],
  },
  {
    code: 'healthcheck_backend',
    label: 'Healthcheck do backend',
    aliases: ['healthcheck_backend'],
    logPatterns: [/servico 'backend'/i, /healthcheck do backend/i],
  },
  {
    code: 'completed',
    label: 'Conclusão do update',
    aliases: ['completed'],
    logPatterns: [/deploy concluido com sucesso/i, /update concluido com sucesso/i],
  },
  {
    code: 'rollback',
    label: 'Rollback',
    aliases: ['rollback'],
    logPatterns: [/rollback/i],
  },
];

const STEP_BY_ALIAS = new Map<string, PlatformUpdateStepDefinition>();

for (const definition of STEP_DEFINITIONS) {
  for (const alias of definition.aliases) {
    STEP_BY_ALIAS.set(normalizeStepKey(alias), definition);
  }
}

function normalizeStepKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function lookupByRawStep(rawStep: string | null | undefined): PlatformUpdateStepDefinition | null {
  const normalized = normalizeStepKey(rawStep || '');
  if (!normalized) {
    return null;
  }
  return STEP_BY_ALIAS.get(normalized) || null;
}

export function resolvePlatformUpdateStep(rawStep: string | null | undefined, options?: {
  source?: PlatformUpdateStepSource;
  detail?: string | null;
  status?: PlatformUpdateStepStatus;
}): PlatformStepPresentation | null {
  const definition = lookupByRawStep(rawStep);
  if (!definition) {
    const normalized = normalizeStepKey(rawStep || '');
    if (!normalized) {
      return null;
    }
    return {
      code: 'unknown',
      label: `Etapa desconhecida (${normalized})`,
      raw: rawStep || null,
      source: options?.source || 'fallback',
      detail: options?.detail || null,
      status: options?.status || 'unknown',
    };
  }

  return {
    code: definition.code,
    label: definition.label,
    raw: rawStep || null,
    source: options?.source || 'state_file',
    detail: options?.detail || null,
    status: options?.status || 'running',
  };
}

export function inferPlatformUpdateStepFromLogLine(
  line: string | null | undefined,
  options?: {
    source?: PlatformUpdateStepSource;
    status?: PlatformUpdateStepStatus;
  },
): PlatformStepPresentation | null {
  const rawLine = String(line || '').trim();
  if (!rawLine) {
    return null;
  }

  for (const definition of STEP_DEFINITIONS) {
    for (const pattern of definition.logPatterns || []) {
      if (pattern.test(rawLine)) {
        return {
          code: definition.code,
          label: definition.label,
          raw: rawLine,
          source: options?.source || 'log_recovery',
          detail: rawLine,
          status: options?.status || 'running',
        };
      }
    }
  }

  return null;
}

export function getPlatformUpdateStepLabel(stepCode: string | null | undefined): string | null {
  return resolvePlatformUpdateStep(stepCode)?.label || null;
}
