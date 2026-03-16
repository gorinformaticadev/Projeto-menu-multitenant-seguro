import { SetMetadata } from '@nestjs/common';

export const CRITICAL_RATE_LIMIT_KEY = 'critical-rate-limit';

export type CriticalRateLimitAction = 'backup' | 'restore' | 'update';

export const CriticalRateLimit = (action: CriticalRateLimitAction) =>
  SetMetadata(CRITICAL_RATE_LIMIT_KEY, action);
