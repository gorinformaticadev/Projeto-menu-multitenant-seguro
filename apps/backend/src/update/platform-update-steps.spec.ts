import {
  getPlatformUpdateStepLabel,
  inferPlatformUpdateStepFromLogLine,
  resolvePlatformUpdateStep,
} from './platform-update-steps';

describe('platform-update-steps', () => {
  it('resolve etapa real conhecida do fluxo nativo', () => {
    expect(resolvePlatformUpdateStep('build_frontend')).toMatchObject({
      code: 'build_frontend',
      label: 'Build do frontend',
    });
  });

  it('mantem etapa desconhecida sem inventar codigo conhecido', () => {
    expect(resolvePlatformUpdateStep('custom_future_step')).toMatchObject({
      code: 'unknown',
      label: 'Etapa desconhecida (custom_future_step)',
    });
  });

  it('infere etapa a partir de log docker', () => {
    expect(inferPlatformUpdateStepFromLogLine("[deploy] [2026-03-28T12:00:00Z] Efetuando pull das imagens...")).toMatchObject({
      code: 'pull_images',
      label: 'Pull das imagens',
    });
  });

  it('retorna label estavel para uso na UI', () => {
    expect(getPlatformUpdateStepLabel('restart_pm2')).toBe('Reinício dos serviços');
  });
});
