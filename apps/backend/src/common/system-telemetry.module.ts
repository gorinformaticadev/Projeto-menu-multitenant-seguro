import { Global, Module } from '@nestjs/common';
import { OperationalCircuitBreakerService } from './services/operational-circuit-breaker.service';
import { OperationalObservabilityService } from './services/operational-observability.service';
import { OperationalRequestQueueService } from './services/operational-request-queue.service';
import { RuntimePressureService } from './services/runtime-pressure.service';
import { SystemTelemetryService } from './services/system-telemetry.service';

@Global()
@Module({
  providers: [
    SystemTelemetryService,
    OperationalObservabilityService,
    OperationalCircuitBreakerService,
    OperationalRequestQueueService,
    RuntimePressureService,
  ],
  exports: [
    SystemTelemetryService,
    OperationalObservabilityService,
    OperationalCircuitBreakerService,
    OperationalRequestQueueService,
    RuntimePressureService,
  ],
})
export class SystemTelemetryModule {}
