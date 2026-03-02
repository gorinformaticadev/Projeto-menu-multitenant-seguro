import { Prisma } from '@prisma/client';

export type SeedModuleKey = 'system-config' | 'default-users' | 'initial-tenants';

export type SeedExecutionMode = 'deploy' | 'manual';

export type SeedSummary = {
  created: number;
  updated: number;
  skipped: number;
  notes?: string[];
};

export type SeedContext = {
  tx: Prisma.TransactionClient;
  now: Date;
  force: boolean;
  mode: SeedExecutionMode;
};

export type SeedModuleDefinition = {
  key: SeedModuleKey;
  version: number;
  description: string;
  run: (context: SeedContext) => Promise<SeedSummary>;
};

export type SeedRunnerOptions = {
  force?: boolean;
  modules?: SeedModuleKey[];
  mode?: SeedExecutionMode;
};

export type SeedModuleResult = {
  key: SeedModuleKey;
  version: number;
  status: 'SUCCESS' | 'FORCED' | 'SKIPPED' | 'FAILED';
  historyId?: string;
  summary?: SeedSummary;
  error?: string;
};

export type SeedRunResult = {
  executionId: string;
  lockAcquired: boolean;
  skippedBecauseLocked: boolean;
  results: SeedModuleResult[];
};
