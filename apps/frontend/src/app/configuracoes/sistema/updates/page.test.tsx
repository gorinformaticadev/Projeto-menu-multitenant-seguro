import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UpdatesPage from '@/app/configuracoes/sistema/updates/page';

const { apiMock, toastMock, useSystemVersionMock, useMaintenanceMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  toastMock: vi.fn(),
  useSystemVersionMock: vi.fn(),
  useMaintenanceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock('@/lib/api', () => ({
  default: apiMock,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock('@/hooks/useSystemVersion', () => ({
  useSystemVersion: () => useSystemVersionMock(),
}));

vi.mock('@/contexts/MaintenanceContext', () => ({
  useMaintenance: () => useMaintenanceMock(),
}));

vi.mock('@/app/configuracoes/sistema/updates/components/BackupSection', () => ({
  BackupSection: () => <div data-testid="backup-section" />,
}));

vi.mock('@/app/configuracoes/sistema/updates/components/RestoreSection', () => ({
  RestoreSection: () => <div data-testid="restore-section" />,
}));

function buildLifecycle(overrides?: Record<string, unknown>) {
  return {
    status: 'running',
    availabilityStatus: 'available',
    rawStatus: 'running',
    step: 'build_backend',
    progress: 48,
    progressPercent: 48,
    progressKnown: true,
    startedAt: '2026-03-28T12:00:00.000Z',
    finishedAt: null,
    mode: 'native',
    lock: true,
    stale: false,
    currentStep: {
      code: 'build_backend',
      label: 'Build do backend',
      raw: 'build_backend',
      source: 'state_file',
      detail: null,
      status: 'running',
    },
    lastCompletedStep: null,
    failedStep: null,
    operation: {
      active: true,
      operationId: 'op-1',
      type: 'update',
    },
    rollback: {
      attempted: false,
      completed: false,
      reason: null,
    },
    persistence: {
      healthy: true,
      source: 'state_file',
      fallbackApplied: false,
      progressKnown: true,
      statePath: '/tmp/update-state.json',
      logPath: '/tmp/update.log',
      issueCode: null,
      message: null,
      technicalMessage: null,
      rawExcerpt: null,
      recoveredStepCode: 'build_backend',
    },
    persistenceError: null,
    error: null,
    ...overrides,
  };
}

function setupApi(statusSequence: Array<Record<string, unknown>>) {
  let statusIndex = 0;

  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/api/update/status') {
      const current = statusSequence[Math.min(statusIndex, statusSequence.length - 1)];
      statusIndex += 1;
      return { data: current };
    }
    if (url === '/api/update/config') {
      return { data: { hasGitToken: true, packageManager: 'native', updateChannel: 'release', updateCheckEnabled: true } };
    }
    if (url === '/api/update/logs?limit=20') {
      return { data: [] };
    }
    throw new Error(`GET nao tratado: ${url}`);
  });
}

describe('UpdatesPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    toastMock.mockReset();
    useSystemVersionMock.mockReturnValue({
      version: 'v1.0.0',
      loading: false,
    });
    useMaintenanceMock.mockReturnValue({
      state: {
        reason: null,
      },
      isMaintenanceActive: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza a etapa real enviada pelo backend', async () => {
    setupApi([
      {
        currentVersion: 'v1.0.0',
        availableVersion: 'v1.2.3',
        updateAvailable: true,
        isConfigured: true,
        checkEnabled: true,
        mode: 'native',
        configuredMode: 'native',
        effectiveMode: 'native',
        detectedHostMode: 'native',
        modeSource: 'configured',
        updateChannel: 'release',
        updateLifecycle: buildLifecycle(),
      },
    ]);

    render(<UpdatesPage />);

    expect(await screen.findByText(/Etapa real: Build do backend/i)).toBeInTheDocument();
    expect(screen.getByText('48%')).toBeInTheDocument();
  });

  it('exibe nativo usando effectiveMode mesmo quando mode legado e host detectado indicam docker', async () => {
    setupApi([
      {
        currentVersion: 'v1.0.0',
        availableVersion: 'v1.2.3',
        updateAvailable: true,
        isConfigured: true,
        checkEnabled: true,
        mode: 'docker',
        configuredMode: 'native',
        effectiveMode: 'native',
        detectedHostMode: 'docker',
        modeSource: 'legacy_state',
        updateChannel: 'release',
        updateLifecycle: buildLifecycle({
          mode: 'native',
        }),
      },
    ]);

    render(<UpdatesPage />);

    expect(await screen.findByText('Nativo (PM2)')).toBeInTheDocument();
    expect(screen.queryByText('Container Docker')).not.toBeInTheDocument();
  });

  it('exibe docker quando o modo efetivo da execucao e docker', async () => {
    setupApi([
      {
        currentVersion: 'v1.0.0',
        availableVersion: 'v1.2.3',
        updateAvailable: true,
        isConfigured: true,
        checkEnabled: true,
        mode: 'native',
        configuredMode: 'native',
        effectiveMode: 'docker',
        detectedHostMode: 'docker',
        modeSource: 'canonical_execution',
        updateChannel: 'release',
        updateLifecycle: buildLifecycle({
          mode: 'docker',
          step: 'pull_images',
          currentStep: {
            code: 'pull_images',
            label: 'Pull das imagens',
            raw: 'pull_images',
            source: 'canonical_db',
            detail: null,
            status: 'running',
          },
        }),
      },
    ]);

    render(<UpdatesPage />);

    expect(await screen.findByText('Container Docker')).toBeInTheDocument();
  });

  it('renderiza falha de leitura do estado sem travar a tela', async () => {
    setupApi([
      {
        currentVersion: 'v1.0.0',
        availableVersion: 'v1.2.3',
        updateAvailable: true,
        isConfigured: true,
        checkEnabled: true,
        mode: 'docker',
        configuredMode: 'docker',
        effectiveMode: 'docker',
        detectedHostMode: 'docker',
        modeSource: 'configured',
        updateChannel: 'release',
        updateLifecycle: buildLifecycle({
          mode: 'docker',
          step: 'pull_images',
          progress: 0,
          progressPercent: null,
          progressKnown: false,
          currentStep: {
            code: 'pull_images',
            label: 'Pull das imagens',
            raw: '[deploy] pull',
            source: 'log_recovery',
            detail: '[deploy] pull',
            status: 'running',
          },
          persistence: {
            healthy: false,
            source: 'log_recovery',
            fallbackApplied: true,
            progressKnown: false,
            statePath: '/tmp/update-state.json',
            logPath: '/tmp/update.log',
            issueCode: 'UPDATE_STATUS_PERSISTENCE_ERROR',
            message: 'Falha ao ler o estado persistido da atualizacao.',
            technicalMessage: 'Arquivo update-state.json invalido',
            rawExcerpt: '{INVALID',
            recoveredStepCode: 'pull_images',
          },
          persistenceError: {
            code: 'UPDATE_STATUS_PERSISTENCE_ERROR',
            category: 'UPDATE_STATUS_PERSISTENCE_ERROR',
            stage: 'state_read',
            userMessage: 'Falha ao ler o estado persistido da atualizacao.',
            technicalMessage: 'Arquivo update-state.json invalido',
            exitCode: null,
          },
        }),
      },
    ]);

    render(<UpdatesPage />);

    expect(await screen.findByText(/Etapa real: Pull das imagens/i)).toBeInTheDocument();
    expect(screen.getByText(/Falha de observabilidade:/i)).toBeInTheDocument();
    expect(screen.getByText('Sem percentual confiável')).toBeInTheDocument();
  });

  it('atualiza a etapa corretamente no polling', async () => {
    let pollingCallback: (() => void) | null = null;
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((callback: TimerHandler) => {
      pollingCallback = typeof callback === 'function' ? (callback as () => void) : null;
      return 1 as unknown as number;
    }) as typeof window.setInterval);
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);

    setupApi([
      {
        currentVersion: 'v1.0.0',
        availableVersion: 'v1.2.3',
        updateAvailable: true,
        isConfigured: true,
        checkEnabled: true,
        mode: 'native',
        configuredMode: 'native',
        effectiveMode: 'native',
        detectedHostMode: 'native',
        modeSource: 'configured',
        updateChannel: 'release',
        updateLifecycle: buildLifecycle(),
      },
      {
        currentVersion: 'v1.0.0',
        availableVersion: 'v1.2.3',
        updateAvailable: true,
        isConfigured: true,
        checkEnabled: true,
        mode: 'native',
        configuredMode: 'native',
        effectiveMode: 'native',
        detectedHostMode: 'native',
        modeSource: 'configured',
        updateChannel: 'release',
        updateLifecycle: buildLifecycle({
          step: 'migrate',
          progress: 72,
          progressPercent: 72,
          currentStep: {
            code: 'migrate',
            label: 'Migração do banco',
            raw: 'migrate',
            source: 'state_file',
            detail: null,
            status: 'running',
          },
        }),
      },
    ]);

    render(<UpdatesPage />);

    expect(await screen.findByText(/Etapa real: Build do backend/i)).toBeInTheDocument();
    expect(pollingCallback).not.toBeNull();

    await act(async () => {
      pollingCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText(/Etapa real: Migração do banco/i)).toBeInTheDocument();

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  }, 10000);
});
