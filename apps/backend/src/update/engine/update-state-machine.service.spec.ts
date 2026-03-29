import { UpdateStateMachineService } from './update-state-machine.service';

describe('UpdateStateMachineService', () => {
  const service = new UpdateStateMachineService();

  it('cria execucao requested para native com fetch_code e total coerente', () => {
    const execution = service.createRequestedExecution({
      installationId: 'host-1',
      requestedBy: 'super-1',
      source: 'panel',
      mode: 'native',
      currentVersion: 'v1.0.0',
      targetVersion: 'v1.1.0',
      rollbackPolicy: 'code_only_safe',
    });

    expect(execution.status).toBe('requested');
    expect(execution.currentStep).toBe('precheck');
    expect(execution.progressUnitsDone).toBe(0);
    expect(execution.progressUnitsTotal).toBeGreaterThan(0);

    const view = service.buildExecutionView(execution);
    expect(view.stepsPlanned).toContain('fetch_code');
    expect(view.stepsPlanned).not.toContain('pull_images');
    expect(view.progressPercent).toBe(0);
  });

  it('cria plano docker com pull_images e rollback pendente ao final', () => {
    const execution = service.createRequestedExecution({
      installationId: 'host-1',
      requestedBy: 'super-1',
      source: 'panel',
      mode: 'docker',
      currentVersion: 'v1.0.0',
      targetVersion: 'v1.1.0',
      rollbackPolicy: 'restore_required',
    });

    const steps = service.buildStepPlan(execution, []);

    expect(steps[0].step).toBe('precheck');
    expect(steps.some((step) => step.step === 'pull_images')).toBe(true);
    expect(steps.some((step) => step.step === 'fetch_code')).toBe(false);
    expect(steps[steps.length - 1].step).toBe('rollback');
    expect(steps[steps.length - 1].status).toBe('pending');
  });

  it('aceita transicao valida para a proxima etapa planejada', () => {
    expect(() => service.assertStepTransition('native', 'prepare', 'fetch_code')).not.toThrow();
    expect(() => service.assertStepTransition('docker', 'prepare', 'pull_images')).not.toThrow();
  });

  it('rejeita transicao invalida fora da ordem canônica', () => {
    expect(() => service.assertStepTransition('native', 'prepare', 'build_frontend')).toThrow(
      'Transicao invalida para o pipeline de update',
    );
  });
});
