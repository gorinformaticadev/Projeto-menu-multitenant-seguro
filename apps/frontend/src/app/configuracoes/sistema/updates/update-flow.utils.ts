export type UpdateLifecycleStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not_available'
  | 'pending_confirmation'
  | 'starting'
  | 'running'
  | 'restarting_services'
  | 'completed'
  | 'failed';

export type UpdateLifecycleStep = {
  code: string;
  label: string;
  raw: string | null;
  source: string;
  detail: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'unknown';
};

export type UpdateLifecycleError = {
  code: string;
  category: string;
  stage: string;
  userMessage: string;
  technicalMessage: string | null;
  exitCode: number | null;
};

export type UpdateLifecycleObservability = {
  healthy: boolean;
  source: string;
  fallbackApplied: boolean;
  progressKnown: boolean;
  statePath: string;
  logPath: string | null;
  issueCode: string | null;
  message: string | null;
  technicalMessage: string | null;
  rawExcerpt: string | null;
  recoveredStepCode: string | null;
};

export type UpdateLifecyclePayload = {
  status: UpdateLifecycleStatus;
  availabilityStatus: 'available' | 'not_available';
  rawStatus: 'idle' | 'running' | 'success' | 'failed' | 'rolled_back';
  step: string;
  progress: number;
  progressPercent: number | null;
  progressKnown: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  mode: 'docker' | 'native';
  lock: boolean;
  stale: boolean;
  currentStep: UpdateLifecycleStep | null;
  lastCompletedStep: UpdateLifecycleStep | null;
  failedStep: UpdateLifecycleStep | null;
  operation: {
    active: boolean;
    operationId: string | null;
    type: 'update' | 'rollback' | null;
  };
  rollback: {
    attempted: boolean;
    completed: boolean;
    reason: string | null;
  };
  persistence: UpdateLifecycleObservability;
  persistenceError: UpdateLifecycleError | null;
  error: UpdateLifecycleError | null;
};

export type UpdateLifecycleViewModel = {
  currentStepLabel: string;
  currentStepCode: string | null;
  currentStepRaw: string | null;
  currentStepDetail: string | null;
  progressPercent: number | null;
  progressKnown: boolean;
  failedStepLabel: string | null;
  lastCompletedStepLabel: string | null;
  persistenceError: UpdateLifecycleError | null;
  persistenceSource: string;
  showProgressBar: boolean;
};

type ApiErrorPayload = {
  message?: string;
  code?: string;
  category?: string;
  stage?: string;
  userMessage?: string;
  technicalMessage?: string;
  operationId?: string;
  updateLogId?: string;
  exitCode?: number;
};

type ApiErrorLike = {
  message?: string;
  response?: {
    status?: number;
    data?: ApiErrorPayload;
  };
};

export type ParsedUpdateApiError = {
  message: string;
  userMessage: string;
  technicalMessage: string | null;
  code: string | null;
  category: string | null;
  stage: string | null;
  statusCode: number | null;
  operationId: string | null;
  updateLogId: string | null;
  exitCode: number | null;
};

export function parseUpdateApiError(
  error: unknown,
  fallbackMessage = 'Erro interno do servidor',
): ParsedUpdateApiError {
  const typed = (error || {}) as ApiErrorLike;
  const payload = (typed.response?.data || {}) as ApiErrorPayload;

  const message = String(payload.userMessage || payload.message || typed.message || fallbackMessage);
  const technicalMessageRaw = payload.technicalMessage;
  const technicalMessage = typeof technicalMessageRaw === 'string' && technicalMessageRaw.trim()
    ? technicalMessageRaw
    : null;

  return {
    message,
    userMessage: message,
    technicalMessage,
    code: normalizeNullableString(payload.code),
    category: normalizeNullableString(payload.category),
    stage: normalizeNullableString(payload.stage),
    statusCode: normalizeNullableNumber(typed.response?.status),
    operationId: normalizeNullableString(payload.operationId),
    updateLogId: normalizeNullableString(payload.updateLogId),
    exitCode: normalizeNullableNumber(payload.exitCode),
  };
}

export function isUpdateLifecycleRunning(status: UpdateLifecycleStatus | string | null | undefined): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'starting' || normalized === 'running' || normalized === 'restarting_services';
}

export function formatUpdateLifecycleStatus(status: UpdateLifecycleStatus | string | null | undefined): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'starting') return 'Iniciando';
  if (normalized === 'running') return 'Executando';
  if (normalized === 'restarting_services') return 'Reiniciando serviços';
  if (normalized === 'completed') return 'Concluído';
  if (normalized === 'failed') return 'Falhou';
  if (normalized === 'pending_confirmation') return 'Aguardando confirmação';
  if (normalized === 'available') return 'Atualização disponível';
  if (normalized === 'not_available') return 'Sem atualização';
  if (normalized === 'checking') return 'Verificando';
  return 'Ocioso';
}

export function formatUpdateStage(stage: string | null | undefined): string {
  const normalized = String(stage || '').trim();
  if (!normalized) {
    return 'desconhecida';
  }

  const compact = normalized.toLowerCase().replace(/[_-]+/g, ' ');
  const labels: Record<string, string> = {
    starting: 'inicializando atualização',
    precheck: 'validando configurações',
    prepare: 'preparando release',
    download: 'baixando release',
    build: 'compilando sistema',
    'build dependencies': 'instalando dependências',
    'install dependencies': 'instalando dependências',
    'build prisma client': 'gerando cliente do banco',
    'build backend': 'compilando backend',
    'build frontend': 'compilando frontend',
    'build frontend assets': 'organizando arquivos do frontend',
    'package frontend assets': 'preparando artefato standalone do frontend',
    'validate frontend artifact': 'validando integridade do artefato standalone',
    'pre swap smoke test': 'executando smoke test pré-swap',
    migrate: 'executando migrations',
    seed: 'aplicando seed versionado',
    switch: 'trocando release ativa',
    'publish release': 'publicando release ativa',
    restart: 'reiniciando serviços',
    'restart pm2': 'reiniciando PM2',
    validate: 'validando integrações',
    'validate backend storage': 'validando storage compartilhado',
    healthcheck: 'validando saúde do sistema',
    'post deploy validation': 'validando release publicada',
    rollback: 'executando rollback',
    completed: 'concluindo atualização',
  };

  return labels[compact] || compact;
}

export function buildUpdateLifecycleViewModel(
  lifecycle: UpdateLifecyclePayload | null | undefined,
): UpdateLifecycleViewModel {
  const currentStep = lifecycle?.currentStep || null;
  const lastCompletedStep = lifecycle?.lastCompletedStep || null;
  const failedStep = lifecycle?.failedStep || null;
  const progressKnown = lifecycle?.progressKnown === true && Number.isFinite(Number(lifecycle.progressPercent));
  const progressPercent = progressKnown ? Number(lifecycle?.progressPercent) : null;

  return {
    currentStepLabel: currentStep?.label || 'Etapa real indisponível',
    currentStepCode: currentStep?.code || null,
    currentStepRaw: currentStep?.raw || null,
    currentStepDetail: currentStep?.detail || null,
    progressPercent,
    progressKnown,
    failedStepLabel: failedStep?.label || null,
    lastCompletedStepLabel: lastCompletedStep?.label || null,
    persistenceError: lifecycle?.persistenceError || null,
    persistenceSource: lifecycle?.persistence?.source || 'none',
    showProgressBar: progressKnown,
  };
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeNullableNumber(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}
