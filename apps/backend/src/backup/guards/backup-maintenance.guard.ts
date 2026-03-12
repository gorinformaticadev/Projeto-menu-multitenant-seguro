import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BackupRuntimeStateService } from '../backup-runtime-state.service';

@Injectable()
export class BackupMaintenanceGuard implements CanActivate {
  constructor(private readonly runtimeState: BackupRuntimeStateService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.runtimeState.isMaintenanceEnabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const requestPath = String(request.path || request.url || '');

    if (this.isWhitelistedPath(requestPath)) {
      return true;
    }

    const state = this.runtimeState.getState();
    throw new ServiceUnavailableException({
      message: 'Sistema em modo de manutencao para restore de banco',
      maintenance: {
        jobId: state.jobId || null,
        reason: state.reason || 'restore',
        startedAt: state.startedAt || null,
      },
    });
  }

  private isWhitelistedPath(path: string): boolean {
    return (
      path.startsWith('/api/health') ||
      path.startsWith('/api/backups/jobs/') ||
      path.startsWith('/api/backups/internal/jobs/') ||
      path.startsWith('/api/backups/maintenance') ||
      path.startsWith('/api/backup/restore-logs/') ||
      path.startsWith('/api/update/status') ||
      path.startsWith('/api/update/logs') ||
      path.startsWith('/api/system/update/status') ||
      path.startsWith('/api/system/update/log') ||
      path.startsWith('/api/system/update/rollback') ||
      path.startsWith('/api/system/update/releases') ||
      path.startsWith('/api/system/maintenance/state')
    );
  }
}

