import { Injectable, Logger, Optional, Type } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import type {
  ContractEventContext,
  ContractEventOrigin,
  ContractOperationType,
} from './contract-observability.types';
import { RequestSecurityContextService } from './request-security-context.service';
import {
  hashTelemetryTenant,
  normalizeTelemetryMethod,
  resolveContractOperationType,
  resolveTelemetryModule,
  resolveTelemetryRoute,
} from './system-telemetry.util';

type ContractSerializationMetadata = Partial<ContractEventContext>;

@Injectable()
export class DtoMapperService {
  private readonly logger = new Logger(DtoMapperService.name);

  constructor(
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly requestSecurityContext?: RequestSecurityContextService,
  ) {}

  /**
   * Serializa um objeto cru para uma instância de DTO.
   * Usado principalmente para tráfego não HTTP (WebSockets, RabbitMQ, etc.),
   * onde a limpeza do payload ainda precisa preservar observabilidade.
   */
  serialize<T, V extends Record<string, any>>(
    cls: Type<T>,
    plain: V,
    metadata: ContractSerializationMetadata = {},
  ): T {
    const context = this.resolveContractEventContext(metadata);
    const instance = plainToInstance(cls, plain, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
      exposeUnsetFields: false,
    });

    this.detectAndLogStrippedFields(cls.name, plain, instance, context);

    return instance;
  }

  /**
   * Serializa e valida o contrato usado pelo interceptor global de HTTP.
   * Retorna os erros de validação quando o payload de saída viola o DTO.
   */
  async validateAndSerialize<T, V>(
    cls: Type<T>,
    plain: V,
    metadata: ContractSerializationMetadata = {},
  ): Promise<{ data: T | null; errors: ValidationError[] }> {
    if (plain === null || plain === undefined) {
      return { data: plain as any, errors: [] };
    }

    const context = this.resolveContractEventContext(metadata);
    const validationInstance = plainToInstance(cls, plain, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
      exposeUnsetFields: true,
    });

    const errors = await validate(validationInstance as any, {
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
    });

    if (errors.length > 0) {
      this.logger.error(`[METRIC] Contract_Validation_Failed: ${cls.name}`, {
        dto: cls.name,
        errorCount: errors.length,
        route: context.route,
        method: context.method,
        module: context.module,
        origin: context.origin,
        tenantHash: context.tenantHash,
        operationType: context.operationType,
        timestamp: new Date().toISOString(),
      });

      this.eventEmitter?.emit('contract.validation.failed', {
        dto: cls.name,
        errorCount: errors.length,
        timestamp: new Date(),
        ...context,
      });

      return { data: null, errors };
    }

    const data = this.serialize(cls, plain, context);
    return { data, errors: [] };
  }

  /**
   * Identifica campos devolvidos pelo banco ou serviço que não estão no DTO.
   * Isso não altera a resposta final, mas produz observabilidade sobre drift.
   */
  private detectAndLogStrippedFields(
    dtoName: string,
    original: any,
    serialized: any,
    context: ContractEventContext,
  ): void {
    if (!original || typeof original !== 'object' || !serialized || typeof serialized !== 'object') {
      return;
    }

    let originalObject = original;
    let serializedObject = serialized;

    if (Array.isArray(original) && Array.isArray(serialized)) {
      if (original.length === 0) {
        return;
      }

      originalObject = original[0];
      serializedObject = serialized[0];
    }

    if (
      !originalObject ||
      typeof originalObject !== 'object' ||
      !serializedObject ||
      typeof serializedObject !== 'object'
    ) {
      return;
    }

    const originalKeys = Object.keys(originalObject);
    const serializedKeys = Object.keys(serializedObject);
    const strippedFields = originalKeys.filter((key) => !serializedKeys.includes(key));

    if (strippedFields.length <= 0) {
      return;
    }

    this.logger.warn(`[METRIC] Contract_Payload_Stripped: ${dtoName}`, {
      dto: dtoName,
      strippedFields,
      strippedFieldCount: strippedFields.length,
      route: context.route,
      method: context.method,
      module: context.module,
      origin: context.origin,
      tenantHash: context.tenantHash,
      operationType: context.operationType,
      timestamp: new Date().toISOString(),
    });

    this.eventEmitter?.emit('contract.payload.stripped', {
      dto: dtoName,
      strippedFields,
      strippedFieldCount: strippedFields.length,
      timestamp: new Date(),
      ...context,
    });
  }

  private resolveContractEventContext(
    metadata: ContractSerializationMetadata = {},
  ): ContractEventContext {
    const request = this.requestSecurityContext?.getRequest();
    const actor = this.requestSecurityContext?.getActor();
    const detectedOrigin = this.requestSecurityContext?.getSource() || (request ? 'http' : 'system');
    const origin = this.normalizeOrigin(metadata.origin, detectedOrigin);
    const route =
      typeof metadata.route === 'string' && metadata.route.trim().length > 0
        ? resolveTelemetryRoute({ originalUrl: metadata.route })
        : request
          ? resolveTelemetryRoute(request)
          : origin === 'ws'
            ? '/ws/unknown'
            : null;
    const method =
      typeof metadata.method === 'string' && metadata.method.trim().length > 0
        ? normalizeTelemetryMethod(metadata.method)
        : origin === 'ws'
          ? 'WS'
          : request?.method
            ? normalizeTelemetryMethod(request.method)
            : null;
    const moduleName =
      typeof metadata.module === 'string' && metadata.module.trim().length > 0
        ? metadata.module.trim().toLowerCase()
        : resolveTelemetryModule(route);
    const tenantHash =
      typeof metadata.tenantHash === 'string' && metadata.tenantHash.trim().length > 0
        ? metadata.tenantHash.trim()
        : hashTelemetryTenant(actor?.tenantId || request?.tenantId || request?.user?.tenantId);
    const operationType = metadata.operationType || this.resolveOperationType(method, origin);

    return {
      route,
      method,
      module: moduleName,
      origin,
      tenantHash,
      operationType,
    };
  }

  private normalizeOrigin(
    candidate: ContractEventOrigin | undefined,
    fallback: 'http' | 'ws' | 'system',
  ): ContractEventOrigin {
    return candidate === 'http' || candidate === 'ws' || candidate === 'system'
      ? candidate
      : fallback;
  }

  private resolveOperationType(
    method: string | null,
    origin: ContractEventOrigin,
  ): ContractOperationType {
    if (!method && origin === 'system') {
      return 'command';
    }

    return resolveContractOperationType(method, origin);
  }
}
