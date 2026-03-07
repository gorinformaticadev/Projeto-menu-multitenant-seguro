import { CronService } from '../../core/cron/cron.service';
import { SystemJobWatchdogService } from './system-job-watchdog.service';
import { SystemOperationalAlertsService } from './system-operational-alerts.service';

describe('SystemJobWatchdogService', () => {
  const cronServiceMock = {
    register: jest.fn(),
    getRuntimeJobs: jest.fn(),
    isMaintenancePaused: jest.fn(),
  };
  const operationalAlertsServiceMock = {
    dispatchOperationalAlert: jest.fn(),
  };

  let service: SystemJobWatchdogService;
  let previousFailureThreshold: string | undefined;

  const createService = () =>
    new SystemJobWatchdogService(
      cronServiceMock as unknown as CronService,
      operationalAlertsServiceMock as unknown as SystemOperationalAlertsService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T15:00:00.000Z'));
    previousFailureThreshold = process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD;
    process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD = '3';

    cronServiceMock.register.mockResolvedValue(undefined);
    cronServiceMock.getRuntimeJobs.mockResolvedValue([]);
    cronServiceMock.isMaintenancePaused.mockReturnValue(false);
    operationalAlertsServiceMock.dispatchOperationalAlert.mockResolvedValue(true);

    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (previousFailureThreshold === undefined) {
      delete process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD;
    } else {
      process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD = previousFailureThreshold;
    }
  });

  it('registers the watchdog evaluator in the dynamic cron runtime', async () => {
    await service.onModuleInit();

    expect(cronServiceMock.register).toHaveBeenCalledWith(
      'system.job_watchdog_evaluator',
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        name: 'Job watchdog evaluator',
        origin: 'core',
        watchdogEnabled: false,
      }),
    );
  });

  it('emits a critical alert for a stale job and respects cooldown', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.update_check',
        name: 'Update check',
        description: 'Checks for updates',
        schedule: '0 * * * *',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        lastStatus: 'success',
        lastStartedAt: new Date('2026-03-07T12:00:00.000Z'),
        lastSucceededAt: new Date('2026-03-07T12:01:00.000Z'),
        nextExpectedRunAt: new Date('2026-03-07T13:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);

    await service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'));
    await service.evaluateWatchdog(new Date('2026-03-07T15:05:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_NOT_RUNNING',
        pushEligible: true,
        source: 'job-watchdog',
      }),
      expect.any(Number),
    );
  });

  it('emits a warning for repeated failures without push', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.log_cleanup',
        name: 'Log cleanup',
        description: 'Removes old update logs',
        schedule: '0 0 * * 0',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        lastStatus: 'failed',
        lastStartedAt: new Date('2026-03-07T02:00:00.000Z'),
        lastFailedAt: new Date('2026-03-07T02:05:00.000Z'),
        nextExpectedRunAt: new Date('2026-03-14T00:00:00.000Z'),
        consecutiveFailureCount: 3,
      },
    ]);

    await service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_REPEATED_FAILURES',
        title: 'Falhas repetidas em job',
        severity: 'warning',
      }),
      expect.any(Number),
    );
  });

  it('emits a critical alert for a stuck running job', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.backup_auto_create',
        name: 'Backup automatico',
        description: 'Enfileira backup automatico',
        schedule: '*/5 * * * *',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        lastStatus: 'running',
        lastStartedAt: new Date('2026-03-07T14:30:00.000Z'),
        nextExpectedRunAt: new Date('2026-03-07T14:35:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);

    await service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_STUCK_RUNNING',
        title: 'Job travado em execucao',
        severity: 'critical',
      }),
      expect.any(Number),
    );
  });

  it('skips evaluation while cron jobs are paused for maintenance', async () => {
    cronServiceMock.isMaintenancePaused.mockReturnValue(true);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'));

    expect(result).toEqual({
      emitted: [],
      skipped: ['maintenance_paused'],
    });
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('ignores jobs explicitly excluded from watchdog monitoring', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.operational_alerts_evaluator',
        name: 'Operational alerts evaluator',
        description: 'Avalia alertas operacionais',
        schedule: '* * * * *',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        watchdogEnabled: false,
        lastStatus: 'running',
        lastStartedAt: new Date('2026-03-07T14:30:00.000Z'),
        nextExpectedRunAt: new Date('2026-03-07T14:31:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'));

    expect(result).toEqual({
      emitted: [],
      skipped: [],
    });
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });
});
