import { CronController } from './cron.controller';
import { CronService } from './cron.service';

describe('CronController', () => {
  const cronServiceMock = {
    listJobs: jest.fn(),
    getRuntimeJobs: jest.fn(),
    trigger: jest.fn(),
    toggle: jest.fn(),
    updateSchedule: jest.fn(),
  };

  let controller: CronController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CronController(cronServiceMock as unknown as CronService);
  });

  it('returns runtime jobs from the dedicated endpoint', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([{ key: 'system.update_check' }]);

    await expect(controller.getRuntimeJobs()).resolves.toEqual([{ key: 'system.update_check' }]);
    expect(cronServiceMock.getRuntimeJobs).toHaveBeenCalledTimes(1);
  });
});
