import { SetMetadata } from '@nestjs/common';
import { SKIP_TENANT_ISOLATION } from '@core/interceptors/tenant.interceptor';

export const SkipTenantIsolation = () => SetMetadata(SKIP_TENANT_ISOLATION, true);

