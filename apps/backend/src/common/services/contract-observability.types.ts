export type ContractEventOrigin = 'http' | 'ws' | 'system';

export type ContractOperationType =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'emit'
  | 'command'
  | 'unknown'
  | 'other';

export type ContractMetricSeverity = 'normal' | 'warning' | 'critical';

export type ContractAnomalyType = 'payload_stripped' | 'validation_failed';

export type ContractDimensionClassification = 'mandatory' | 'optional' | 'dangerous' | 'bucketed';

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

export interface ContractEvaluatedEvent extends ContractEventContext {
  dto: string;
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
  ws: {
    validationFailed: {
      ratePerThousandEvents: ContractThresholdBand;
    };
    payloadStripped: {
      ratePerThousandEvents: ContractThresholdBand;
    };
  };
  trend: ContractTrendThresholds;
}

export interface ContractAnomalyRecord {
  at: number;
  type: ContractAnomalyType;
  dto: string;
  route: string | null;
  method: string | null;
  module: string | null;
  origin: ContractEventOrigin;
  tenantHash: string | null;
  operationType: ContractOperationType;
  detailCount: number;
}

export interface ContractAnomalySummary {
  dto: string;
  type: ContractAnomalyType;
  count: number;
  detailCount: number;
  lastOccurrenceMs: number;
}

export interface ContractAnomalyDtoSummary {
  dto: string;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  lastOccurrenceAt: string;
  topRoute: string | null;
}

export interface ContractAnomalyMinuteSummary {
  minuteStart: string;
  total: number;
  validationFailed: number;
  payloadStripped: number;
  httpRequests: number;
  wsEvaluations: number;
}

export interface ContractAnomalyRouteSummary {
  route: string;
  method: string | null;
  module: string | null;
  origin: ContractEventOrigin;
  operationType: ContractOperationType | null;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  requests: number;
  evaluations: number;
  denominatorKind: 'requests' | 'events';
  denominatorCount: number;
  failureRatePerThousandRequests: number | null;
  strippingRatePerThousandRequests: number | null;
  totalRatePerThousandRequests: number | null;
  failureRatePerThousandEvents: number | null;
  strippingRatePerThousandEvents: number | null;
  totalRatePerThousandEvents: number | null;
  lastOccurrenceAt: string;
}

export interface ContractAnomalyTenantSummary {
  tenantHash: string;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  lastOccurrenceAt: string;
}

export interface ContractAnomalyOriginSummary {
  origin: ContractEventOrigin;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  denominatorKind: 'requests' | 'events';
  denominatorCount: number;
  failureRatePerThousand: number | null;
  strippingRatePerThousand: number | null;
  severity: ContractMetricSeverity;
}

export interface ContractTrendSnapshot {
  previousWindowStart: string;
  previousWindowSeconds: number;
  previousTotalEvents: number;
  previousValidationErrors: number;
  previousPayloadStrips: number;
  totalIncreasePercent: number | null;
  validationIncreasePercent: number | null;
  payloadIncreasePercent: number | null;
  lastBucketIncreasePercent: number | null;
  continuousGrowthMinutes: number;
  continuousGrowthBuckets: number;
  increasingForLastHour: boolean;
}

export interface ContractSeveritySnapshot {
  validationFailed: ContractMetricSeverity;
  payloadStripped: ContractMetricSeverity;
  trend: ContractMetricSeverity;
  overall: ContractMetricSeverity;
}

export interface ContractCardinalityDimensionSnapshot {
  classification: ContractDimensionClassification;
  limit: number | null;
  tracked: number;
  overflowedEvents: number;
}

export interface ContractCardinalitySnapshot {
  dimensions: {
    dto: ContractCardinalityDimensionSnapshot;
    route: ContractCardinalityDimensionSnapshot;
    tenantHash: ContractCardinalityDimensionSnapshot;
    method: ContractCardinalityDimensionSnapshot;
    module: ContractCardinalityDimensionSnapshot;
    origin: ContractCardinalityDimensionSnapshot;
    operationType: ContractCardinalityDimensionSnapshot;
  };
  totalOverflowedEvents: number;
}

export interface ContractPersistenceSnapshot {
  mode: 'memory' | 'redis';
  redisEnabled: boolean;
  redisHealthy: boolean;
  persistedWindowAvailable: boolean;
  retentionMinutes: number;
  degraded: boolean;
  pendingSyncBuckets: number;
  lastError: string | null;
}

export interface ContractCalibrationMetricSuggestion {
  observedP95: number;
  observedPeak: number;
  suggestedWarning: number;
  suggestedCritical: number;
}

export interface ContractCalibrationSnapshot {
  status: 'collecting' | 'ready';
  observationWindowMinutes: number;
  evaluationWindowMinutes: number;
  sampleWindows: number;
  currentThresholds: ContractObservabilityThresholds;
  suggestions: {
    validationFailed: {
      volume: ContractCalibrationMetricSuggestion;
      httpRatePerThousandRequests: ContractCalibrationMetricSuggestion;
      wsRatePerThousandEvents: ContractCalibrationMetricSuggestion;
    };
    payloadStripped: {
      volume: ContractCalibrationMetricSuggestion;
      httpRatePerThousandRequests: ContractCalibrationMetricSuggestion;
      wsRatePerThousandEvents: ContractCalibrationMetricSuggestion;
    };
    trend: {
      observedP95IncreasePercent: number;
      observedPeakIncreasePercent: number;
      suggestedWarningPercent: number;
      suggestedCriticalPercent: number;
    };
  };
}

export interface ContractAnomalySnapshot {
  status: 'ok';
  windowStart: string;
  windowSeconds: number;
  requestsInWindow: number;
  totalEvaluationsInWindow: number;
  wsEvaluationsInWindow: number;
  totalEvents: number;
  totalValidationErrors: number;
  totalPayloadStrips: number;
  totalDetails: number;
  eventsPerMinuteAvg: number;
  failureRatePerThousandRequests: number | null;
  strippingRatePerThousandRequests: number | null;
  wsFailureRatePerThousandEvents: number | null;
  wsStrippingRatePerThousandEvents: number | null;
  distribution: ContractAnomalySummary[];
  byDto: ContractAnomalyDtoSummary[];
  byRoute: ContractAnomalyRouteSummary[];
  byTenant: ContractAnomalyTenantSummary[];
  byOrigin: ContractAnomalyOriginSummary[];
  eventsPerMinute: ContractAnomalyMinuteSummary[];
  thresholds: ContractObservabilityThresholds;
  trends: ContractTrendSnapshot;
  severity: ContractSeveritySnapshot;
  persistence: ContractPersistenceSnapshot;
  cardinality: ContractCardinalitySnapshot;
  calibration: ContractCalibrationSnapshot | null;
}

export interface ContractSnapshotOptions {
  topLimit?: number;
  thresholds?: ContractObservabilityThresholds;
  includeCalibration?: boolean;
}
