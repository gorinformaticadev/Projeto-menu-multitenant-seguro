import { describe, expect, it } from 'vitest';
import {
  buildUpdateLifecycleViewModel,
  formatUpdateLifecycleStatus,
  formatUpdateStage,
  isUpdateLifecycleRunning,
  parseUpdateApiError,
} from '@/app/configuracoes/sistema/updates/update-flow.utils';

describe('update-flow.utils', () => {
  it('parseia erro estruturado do backend com contexto de operacao', () => {
    const parsed = parseUpdateApiError({
      response: {
        status: 500,
        data: {
          message: 'Falha ao aplicar update',
          userMessage: 'A nova versao falhou no healthcheck.',
          technicalMessage: 'exitCode=50 healthcheck failed',
          code: 'UPDATE_RESTART_ERROR',
          category: 'UPDATE_RESTART_ERROR',
          stage: 'healthcheck',
          operationId: 'update-abc',
          updateLogId: 'log-xyz',
          exitCode: 50,
        },
      },
    });

    expect(parsed.userMessage).toBe('A nova versao falhou no healthcheck.');
    expect(parsed.technicalMessage).toContain('exitCode=50');
    expect(parsed.code).toBe('UPDATE_RESTART_ERROR');
    expect(parsed.stage).toBe('healthcheck');
    expect(parsed.operationId).toBe('update-abc');
    expect(parsed.updateLogId).toBe('log-xyz');
    expect(parsed.statusCode).toBe(500);
    expect(parsed.exitCode).toBe(50);
  });

  it('usa fallback quando erro nao tem payload estruturado', () => {
    const parsed = parseUpdateApiError(new Error('Request failed with status code 50'));
    expect(parsed.userMessage).toBe('Request failed with status code 50');
    expect(parsed.code).toBeNull();
    expect(parsed.stage).toBeNull();
  });

  it('identifica estados ativos para polling continuo', () => {
    expect(isUpdateLifecycleRunning('starting')).toBe(true);
    expect(isUpdateLifecycleRunning('running')).toBe(true);
    expect(isUpdateLifecycleRunning('restarting_services')).toBe(true);
    expect(isUpdateLifecycleRunning('completed')).toBe(false);
    expect(isUpdateLifecycleRunning('failed')).toBe(false);
  });

  it('normaliza labels de status e etapa', () => {
    expect(formatUpdateLifecycleStatus('pending_confirmation')).toBe('Aguardando confirmação');
    expect(formatUpdateLifecycleStatus('completed')).toBe('Concluído');
    expect(formatUpdateStage('build_frontend')).toBe('compilando frontend');
    expect(formatUpdateStage('build_prisma_client')).toBe('gerando cliente do banco');
    expect(formatUpdateStage('install_dependencies')).toBe('instalando dependências');
    expect(formatUpdateStage('package_frontend_assets')).toBe('preparando artefato standalone do frontend');
    expect(formatUpdateStage('publish_release')).toBe('publicando release ativa');
    expect(formatUpdateStage('post_deploy_validation')).toBe('validando release publicada');
    expect(formatUpdateStage('health_check-step')).toBe('health check step');
    expect(formatUpdateStage(null)).toBe('desconhecida');
  });

  it('monta view model usando etapa real enviada pelo backend', () => {
    const view = buildUpdateLifecycleViewModel({
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
    });

    expect(view.currentStepLabel).toBe('Build do backend');
    expect(view.progressPercent).toBe(48);
    expect(view.showProgressBar).toBe(true);
  });

  it('mantem fallback honesto quando o percentual nao e confiavel', () => {
    const view = buildUpdateLifecycleViewModel({
      status: 'running',
      availabilityStatus: 'available',
      rawStatus: 'running',
      step: 'pull_images',
      progress: 0,
      progressPercent: null,
      progressKnown: false,
      startedAt: '2026-03-28T12:00:00.000Z',
      finishedAt: null,
      mode: 'docker',
      lock: true,
      stale: false,
      currentStep: {
        code: 'pull_images',
        label: 'Pull das imagens',
        raw: '[deploy] pull',
        source: 'log_recovery',
        detail: '[deploy] pull',
        status: 'running',
      },
      lastCompletedStep: null,
      failedStep: null,
      operation: {
        active: true,
        operationId: 'op-2',
        type: 'update',
      },
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
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
      error: null,
    });

    expect(view.currentStepLabel).toBe('Pull das imagens');
    expect(view.progressPercent).toBeNull();
    expect(view.showProgressBar).toBe(false);
    expect(view.persistenceError?.code).toBe('UPDATE_STATUS_PERSISTENCE_ERROR');
  });
});
