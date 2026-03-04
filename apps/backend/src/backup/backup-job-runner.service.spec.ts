import { BackupJobRunnerService } from './backup-job-runner.service';

describe('BackupJobRunnerService', () => {
  it('nao processa job quando claim retorna null (ex.: nextRunAt no futuro)', async () => {
    const backupConfig = {
      getQueuePollMs: jest.fn().mockReturnValue(2000),
    };

    const backupService = {
      claimNextPendingJob: jest.fn().mockResolvedValue(null),
      updateJobProgress: jest.fn(),
      executeJob: jest.fn(),
      markJobFailed: jest.fn(),
      getJobStatus: jest.fn(),
      heartbeat: jest.fn(),
      returnJobToPending: jest.fn(),
    };

    const backupLock = {
      acquire: jest.fn(),
      release: jest.fn(),
      heartbeat: jest.fn(),
    };

    const runner = new BackupJobRunnerService(
      backupConfig as any,
      backupService as any,
      backupLock as any,
    );

    await (runner as any).tick();

    expect(backupService.claimNextPendingJob).toHaveBeenCalledTimes(1);
    expect(backupLock.acquire).not.toHaveBeenCalled();
    expect(backupService.executeJob).not.toHaveBeenCalled();
  });
});
