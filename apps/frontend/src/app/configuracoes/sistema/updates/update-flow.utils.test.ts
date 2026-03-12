import { describe, expect, it } from 'vitest';
import {
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
    expect(formatUpdateLifecycleStatus('pending_confirmation')).toBe('Aguardando confirmacao');
    expect(formatUpdateLifecycleStatus('completed')).toBe('Concluido');
    expect(formatUpdateStage('health_check-step')).toBe('health check step');
    expect(formatUpdateStage(null)).toBe('desconhecida');
  });
});
