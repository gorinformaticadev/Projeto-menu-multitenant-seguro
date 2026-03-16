import { defaultUsersSeed } from './modules/default-users.seed';
import { initialTenantsSeed } from './modules/initial-tenants.seed';
import { systemConfigSeed } from './modules/system-config.seed';
import { SeedModuleDefinition } from './types';

export const seedRegistry: SeedModuleDefinition[] = [
  initialTenantsSeed,
  systemConfigSeed,
  defaultUsersSeed,
];
