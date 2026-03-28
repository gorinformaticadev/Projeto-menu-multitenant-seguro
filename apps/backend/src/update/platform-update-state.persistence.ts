import * as path from 'path';
import * as fsp from 'fs/promises';
import {
  inferPlatformUpdateStepFromLogLine,
  resolvePlatformUpdateStep,
  type PlatformUpdateMode,
  type PlatformUpdateStepCode,
} from './platform-update-steps';

export type PersistedUpdateStateStatus = 'idle' | 'running' | 'success' | 'failed' | 'rolled_back';

export type PersistedUpdateState = {
  status: PersistedUpdateStateStatus;
  mode: PlatformUpdateMode;
  startedAt: string | null;
  finishedAt: string | null;
  fromVersion: string;
  toVersion: string;
  step: string;
  progress: number;
  lock: boolean;
  lastError: string | null;
  errorCode: string | null;
  errorCategory: string | null;
  errorStage: string | null;
  exitCode: number | null;
  userMessage: string | null;
  technicalMessage: string | null;
  rollback: {
    attempted: boolean;
    completed: boolean;
    reason: string | null;
  };
};

export type PersistedStateSource =
  | 'state_file'
  | 'state_missing'
  | 'state_empty'
  | 'state_invalid_json'
  | 'state_invalid_shape'
  | 'partial_state_recovery'
  | 'last_good_state'
  | 'log_recovery';

export type PersistedUpdateDiagnostics = {
  healthy: boolean;
  source: PersistedStateSource;
  fallbackApplied: boolean;
  progressKnown: boolean;
  statePath: string;
  logPath: string | null;
  issueCode: string | null;
  message: string | null;
  technicalMessage: string | null;
  rawExcerpt: string | null;
  recoveredStepCode: PlatformUpdateStepCode | null;
};

export type PersistedUpdateReadResult = {
  state: PersistedUpdateState;
  diagnostics: PersistedUpdateDiagnostics;
};

type ReadPersistedUpdateStateParams = {
  statePath: string;
  logPath?: string | null;
  lastKnownState?: PersistedUpdateState | null;
  detectMode: () => PlatformUpdateMode;
  activeOperation: {
    active: boolean;
    type: 'update' | 'rollback' | null;
  };
};

type FileSystemAdapter = Pick<typeof fsp, 'mkdir' | 'readFile' | 'rename' | 'rm' | 'writeFile'>;

const DEFAULT_STATE: PersistedUpdateState = {
  status: 'idle',
  mode: 'native',
  startedAt: null,
  finishedAt: null,
  fromVersion: 'unknown',
  toVersion: 'unknown',
  step: 'idle',
  progress: 0,
  lock: false,
  lastError: null,
  errorCode: null,
  errorCategory: null,
  errorStage: null,
  exitCode: null,
  userMessage: null,
  technicalMessage: null,
  rollback: {
    attempted: false,
    completed: false,
    reason: null,
  },
};

function normalizeStateStatus(value: unknown): PersistedUpdateStateStatus {
  const normalized = String(value || '').trim();
  if (normalized === 'idle' || normalized === 'running' || normalized === 'success' || normalized === 'failed' || normalized === 'rolled_back') {
    return normalized;
  }
  return 'idle';
}

function normalizeMode(value: unknown, detectMode: () => PlatformUpdateMode): PlatformUpdateMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'docker' || normalized === 'native') {
    return normalized;
  }
  return detectMode();
}

function normalizeString(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeNullableNumber(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeProgress(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  if (numeric < 0) {
    return 0;
  }
  if (numeric > 100) {
    return 100;
  }
  return Math.floor(numeric);
}

function buildDiagnostics(params: Omit<PersistedUpdateDiagnostics, 'statePath' | 'logPath'> & {
  statePath: string;
  logPath?: string | null;
}): PersistedUpdateDiagnostics {
  return {
    healthy: params.healthy,
    source: params.source,
    fallbackApplied: params.fallbackApplied,
    progressKnown: params.progressKnown,
    statePath: params.statePath,
    logPath: params.logPath || null,
    issueCode: params.issueCode,
    message: params.message,
    technicalMessage: params.technicalMessage,
    rawExcerpt: params.rawExcerpt,
    recoveredStepCode: params.recoveredStepCode,
  };
}

function normalizeParsedState(parsed: Partial<PersistedUpdateState>, detectMode: () => PlatformUpdateMode): {
  state: PersistedUpdateState;
  degraded: boolean;
} {
  const state: PersistedUpdateState = {
    status: normalizeStateStatus(parsed.status),
    mode: normalizeMode(parsed.mode, detectMode),
    startedAt: normalizeNullableString(parsed.startedAt),
    finishedAt: normalizeNullableString(parsed.finishedAt),
    fromVersion: normalizeString(parsed.fromVersion, 'unknown'),
    toVersion: normalizeString(parsed.toVersion, 'unknown'),
    step: normalizeString(parsed.step, 'idle'),
    progress: normalizeProgress(parsed.progress),
    lock: Boolean(parsed.lock),
    lastError: normalizeNullableString(parsed.lastError),
    errorCode: normalizeNullableString(parsed.errorCode),
    errorCategory: normalizeNullableString(parsed.errorCategory),
    errorStage: normalizeNullableString(parsed.errorStage),
    exitCode: normalizeNullableNumber(parsed.exitCode),
    userMessage: normalizeNullableString(parsed.userMessage),
    technicalMessage: normalizeNullableString(parsed.technicalMessage),
    rollback: {
      attempted: Boolean(parsed.rollback?.attempted),
      completed: Boolean(parsed.rollback?.completed),
      reason: normalizeNullableString(parsed.rollback?.reason),
    },
  };

  const degraded =
    parsed.status === undefined ||
    parsed.step === undefined ||
    parsed.progress === undefined ||
    parsed.lock === undefined;

  return { state, degraded };
}

function extractRawExcerpt(raw: string): string {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.slice(0, 280);
}

function recoverPartialState(raw: string, detectMode: () => PlatformUpdateMode, lastKnownState?: PersistedUpdateState | null): PersistedUpdateState | null {
  const pullString = (field: string) => {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`));
    return match?.[1]?.trim() || null;
  };
  const pullBoolean = (field: string) => {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*(true|false)`));
    if (!match) {
      return null;
    }
    return match[1] === 'true';
  };
  const pullNumber = (field: string) => {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
    if (!match) {
      return null;
    }
    const numeric = Number(match[1]);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const partial: Partial<PersistedUpdateState> = {
    status: (pullString('status') as PersistedUpdateStateStatus | null) || undefined,
    mode: (pullString('mode') as PlatformUpdateMode | null) || undefined,
    startedAt: pullString('startedAt') || undefined,
    finishedAt: pullString('finishedAt') || undefined,
    fromVersion: pullString('fromVersion') || undefined,
    toVersion: pullString('toVersion') || undefined,
    step: pullString('step') || undefined,
    progress: pullNumber('progress') || undefined,
    lock: pullBoolean('lock') ?? undefined,
    lastError: pullString('lastError') || undefined,
    errorCode: pullString('errorCode') || undefined,
    errorCategory: pullString('errorCategory') || undefined,
    errorStage: pullString('errorStage') || undefined,
    exitCode: pullNumber('exitCode') || undefined,
    userMessage: pullString('userMessage') || undefined,
    technicalMessage: pullString('technicalMessage') || undefined,
    rollback: {
      attempted: pullBoolean('attempted') ?? false,
      completed: pullBoolean('completed') ?? false,
      reason: pullString('reason') || null,
    },
  };

  if (!partial.step && !partial.errorStage && !partial.lastError) {
    return null;
  }

  const base = lastKnownState ? { ...lastKnownState } : { ...DEFAULT_STATE, mode: detectMode() };
  const { state } = normalizeParsedState(
    {
      ...base,
      ...partial,
      rollback: {
        ...base.rollback,
        ...(partial.rollback || {}),
      },
    },
    detectMode,
  );
  return state;
}

async function readRecentLogLines(logPath: string | null | undefined, fsAdapter: FileSystemAdapter): Promise<string[]> {
  if (!logPath) {
    return [];
  }

  try {
    const content = await fsAdapter.readFile(logPath, 'utf8');
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-40);
  } catch {
    return [];
  }
}

export async function readPersistedUpdateState(
  params: ReadPersistedUpdateStateParams,
  fsAdapter: FileSystemAdapter = fsp,
): Promise<PersistedUpdateReadResult> {
  const { statePath, detectMode, lastKnownState, activeOperation } = params;
  const logPath = params.logPath || null;
  let raw = '';

  try {
    raw = await fsAdapter.readFile(statePath, 'utf8');
  } catch (error: unknown) {
    const technicalMessage = String(error || 'arquivo nao encontrado');
    const state: PersistedUpdateState = lastKnownState && activeOperation.active
      ? {
          ...lastKnownState,
          status: 'running',
          lock: true,
        }
      : {
          ...DEFAULT_STATE,
          mode: detectMode(),
          status: activeOperation.active ? 'running' : 'idle',
          step: activeOperation.active ? 'starting' : 'idle',
          lock: activeOperation.active,
        };

    return {
      state,
      diagnostics: buildDiagnostics({
        healthy: !activeOperation.active,
        source: 'state_missing',
        fallbackApplied: true,
        progressKnown: Boolean(lastKnownState && activeOperation.active),
        statePath,
        logPath,
        issueCode: activeOperation.active ? 'UPDATE_STATUS_PERSISTENCE_ERROR' : null,
        message: activeOperation.active ? 'Arquivo de estado ausente durante o update.' : null,
        technicalMessage,
        rawExcerpt: null,
        recoveredStepCode: null,
      }),
    };
  }

  if (!raw.trim()) {
    const recovered: PersistedUpdateState = lastKnownState && activeOperation.active
      ? {
          ...lastKnownState,
          status: 'running',
          lock: true,
        }
      : {
          ...DEFAULT_STATE,
          mode: detectMode(),
          status: activeOperation.active ? 'running' : 'failed',
          step: activeOperation.active ? 'starting' : 'unknown',
          lock: activeOperation.active,
        };

    return {
      state: recovered,
      diagnostics: buildDiagnostics({
        healthy: false,
        source: 'state_empty',
        fallbackApplied: true,
        progressKnown: Boolean(lastKnownState && activeOperation.active),
        statePath,
        logPath,
        issueCode: 'UPDATE_STATUS_PERSISTENCE_ERROR',
        message: 'Arquivo de estado vazio.',
        technicalMessage: 'Arquivo update-state.json vazio.',
        rawExcerpt: null,
        recoveredStepCode: null,
      }),
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedUpdateState>;
    const { state, degraded } = normalizeParsedState(parsed, detectMode);

    return {
      state,
      diagnostics: buildDiagnostics({
        healthy: !degraded,
        source: degraded ? 'state_invalid_shape' : 'state_file',
        fallbackApplied: degraded,
        progressKnown: true,
        statePath,
        logPath,
        issueCode: degraded ? 'UPDATE_STATUS_PERSISTENCE_ERROR' : null,
        message: degraded ? 'Estado persistido incompleto. Campos ausentes foram normalizados.' : null,
        technicalMessage: degraded ? 'Campos obrigatorios ausentes ou invalidos no update-state.json.' : null,
        rawExcerpt: degraded ? extractRawExcerpt(raw) : null,
        recoveredStepCode: resolvePlatformUpdateStep(state.step)?.code || null,
      }),
    };
  } catch (error: unknown) {
    const partialState = recoverPartialState(raw, detectMode, lastKnownState);
    const logLines = await readRecentLogLines(logPath, fsAdapter);
    const inferredFromLog = [...logLines].reverse().map((line) => inferPlatformUpdateStepFromLogLine(line)).find(Boolean) || null;

    let state: PersistedUpdateState;
    let source: PersistedStateSource;
    let progressKnown = false;
    let recoveredStepCode: PlatformUpdateStepCode | null = null;

    if (partialState) {
      state = {
        ...partialState,
        status: activeOperation.active && partialState.status === 'idle' ? 'running' : partialState.status,
        lock: activeOperation.active || partialState.lock,
      };
      source = 'partial_state_recovery';
      progressKnown = typeof partialState.progress === 'number';
      recoveredStepCode = resolvePlatformUpdateStep(partialState.step)?.code || null;
    } else if (lastKnownState && activeOperation.active) {
      state = {
        ...lastKnownState,
        status: 'running',
        lock: true,
      };
      source = 'last_good_state';
      progressKnown = true;
      recoveredStepCode = resolvePlatformUpdateStep(lastKnownState.step)?.code || null;
    } else if (inferredFromLog) {
      state = {
        ...DEFAULT_STATE,
        mode: detectMode(),
        status: activeOperation.active ? 'running' : inferredFromLog.code === 'completed' ? 'success' : inferredFromLog.code === 'rollback' ? 'rolled_back' : 'failed',
        step: inferredFromLog.code,
        lock: activeOperation.active,
        lastError: activeOperation.active ? null : 'Falha ao reconstruir o estado persistido do update.',
      };
      source = 'log_recovery';
      progressKnown = false;
      recoveredStepCode = inferredFromLog.code;
    } else {
      state = {
        ...DEFAULT_STATE,
        mode: detectMode(),
        status: activeOperation.active ? 'running' : 'failed',
        step: activeOperation.active ? 'starting' : 'unknown',
        lock: activeOperation.active,
        lastError: 'Falha ao ler o estado persistido da atualizacao.',
      };
      source = activeOperation.active && lastKnownState ? 'last_good_state' : 'state_invalid_json';
    }

    return {
      state,
      diagnostics: buildDiagnostics({
        healthy: false,
        source,
        fallbackApplied: true,
        progressKnown,
        statePath,
        logPath,
        issueCode: 'UPDATE_STATUS_PERSISTENCE_ERROR',
        message: 'Falha ao ler o estado persistido da atualizacao.',
        technicalMessage: String(error || 'Arquivo update-state.json invalido'),
        rawExcerpt: extractRawExcerpt(raw),
        recoveredStepCode,
      }),
    };
  }
}

export async function writePersistedUpdateState(
  statePath: string,
  state: PersistedUpdateState,
  fsAdapter: FileSystemAdapter = fsp,
): Promise<void> {
  await fsAdapter.mkdir(path.dirname(statePath), { recursive: true });
  const tmpPath = `${statePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const content = `${JSON.stringify(state, null, 2)}\n`;

  try {
    JSON.parse(content);
    await fsAdapter.writeFile(tmpPath, content, 'utf8');
    await fsAdapter.rename(tmpPath, statePath);
  } catch (error) {
    await fsAdapter.rm(tmpPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
