import { Global, Module } from '@nestjs/common';
import { DistributedOperationalStateService } from './services/distributed-operational-state.service';
import { OperationalCircuitBreakerService } from './services/operational-circuit-breaker.service';
import { OperationalLoadSheddingService } from './services/operational-load-shedding.service';
import { OperationalObservabilityService } from './services/operational-observability.service';
import { OperationalRequestQueueService } from './services/operational-request-queue.service';
import { RuntimePressureService } from './services/runtime-pressure.service';
import { SystemTelemetryService } from './services/system-telemetry.service';

@Global()
@Module({
  providers: [
    SystemTelemetryService,
    OperationalObservabilityService,
    DistributedOperationalStateService,
    OperationalCircuitBreakerService,
    OperationalRequestQueueService,
    RuntimePressureService,
    OperationalLoadSheddingService,
  ],
  exports: [
    SystemTelemetryService,
    OperationalObservabilityService,
    DistributedOperationalStateService,
    OperationalCircuitBreakerService,
    OperationalRequestQueueService,
    RuntimePressureService,
    OperationalLoadSheddingService,
  ],
})
export class SystemTelemetryModule {}
