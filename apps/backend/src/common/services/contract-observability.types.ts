export type ContractEventOrigin = 'http' | 'ws' | 'system';

export type ContractOperationType =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'emit'
  | 'command'
  | 'unknown';

export type ContractMetricSeverity = 'normal' | 'warning' | 'critical';

export interface ContractEventContext {
  route: string | null;
  method: string | null;
  module: string | null;
  origin: ContractEventOrigin;
  tenantHash: string | null;
  operationType: ContractOperationType;
}

export interface ContractValidationFailedEvent extends ContractEventContext {
  dto: string;
  errorCount: number;
  timestamp: Date;
}

export interface ContractPayloadStrippedEvent extends ContractEventContext {
  dto: string;
  strippedFields: string[];
  strippedFieldCount: number;
  timestamp: Date;
}

export interface ContractThresholdBand {
  warning: number;
  critical: number;
}

export interface ContractTrendThresholds {
  warningPercent: number;
  criticalPercent: number;
  bucketMinutes: number;
  warningGrowthMinutes: number;
  criticalGrowthMinutes: number;
  minEventCount: number;
}

export interface ContractObservabilityThresholds {
  validationFailed: {
    volume: ContractThresholdBand;
    ratePerThousandRequests: ContractThresholdBand;
  };
  payloadStripped: {
    volume: ContractThresholdBand;
    ratePerThousandRequests: ContractThresholdBand;
  };
  trend: ContractTrendThresholds;
}
