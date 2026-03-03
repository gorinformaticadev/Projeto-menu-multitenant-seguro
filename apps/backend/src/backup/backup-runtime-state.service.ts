import { Injectable } from '@nestjs/common';

export interface MaintenanceState {
  enabled: boolean;
  jobId?: string;
  reason?: string;
  startedAt?: Date;
}

@Injectable()
export class BackupRuntimeStateService {
  private state: MaintenanceState = { enabled: false };

  enableMaintenance(jobId: string, reason: string): void {
    this.state = {
      enabled: true,
      jobId,
      reason,
      startedAt: new Date(),
    };
  }

  disableMaintenance(jobId?: string): void {
    if (jobId && this.state.jobId && this.state.jobId !== jobId) {
      return;
    }
    this.state = { enabled: false };
  }

  getState(): MaintenanceState {
    return { ...this.state };
  }

  isMaintenanceEnabled(): boolean {
    return this.state.enabled;
  }
}
