import { Injectable, Logger, Type } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

@Injectable()
export class DtoMapperService {
  private readonly logger = new Logger(DtoMapperService.name);

  constructor(private readonly eventEmitter?: EventEmitter2) {}

  /**
   * Serializa um objeto cru para uma instÃ¢ncia de DTO.
   * Usado principalmente para trafego nÃ£o-HTTP (WebSockets, RabbitMQ, etc) onde
   * a revalidaÃ§Ã£o de decorator falhas pode ser suprida ou tratada diffentemente.
   *
   * Garante:
   * - EliminaÃ§Ã£o de campos extrÃ­nsecos
   * - OmissÃ£o de campos unset
   * - ConversÃ£o implicita para os tipos corretos
   */
  serialize<T, V extends Record<string, any>>(cls: Type<T>, plain: V): T {
    const instance = plainToInstance(cls, plain, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
      exposeUnsetFields: false,
    });

    this.detectAndLogStrippedFields(cls.name, plain, instance);

    return instance;
  }

  /**
   * Serializa e valida o contrato (usado pelo interceptor global de HTTP).
   * Retorna os erros de validaÃ§Ã£o caso o dado devolvido seja incompatÃ­vel com o DTO.
   */
  async validateAndSerialize<T, V>(
    cls: Type<T>,
    plain: V,
  ): Promise<{ data: T | null; errors: ValidationError[] }> {
    if (plain === null || plain === undefined) {
      return { data: plain as any, errors: [] };
    }

    // Pass 1: Instanciar com ExposeUnsetFields = true para permitir checagem rigorosa de @IsOptional e exclusÃ£o
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
        timestamp: new Date().toISOString(),
      });
      
      this.eventEmitter?.emit('contract.validation.failed', {
         dto: cls.name,
         errorCount: errors.length,
         timestamp: new Date(),
      });

      return { data: null, errors };
    }

    // Pass 2: Sanitizar output final sem encher de chaves undefined
    const data = this.serialize(cls, plain);
    
    return { data, errors: [] };
  }

  /**
   * Identifica campos devolvidos pelo banco/servico que não estão no DTO.
   * Não afeta a resposta final, mas gera observabilidade crítica sobre o 'Drift'.
   */
  private detectAndLogStrippedFields(dtoName: string, original: any, serialized: any): void {
    if (!original || typeof original !== 'object' || !serialized || typeof serialized !== 'object') {
      return;
    }

    let origObj = original;
    let serObj = serialized;

    if (Array.isArray(original) && Array.isArray(serialized)) {
      if (original.length === 0) return;
      origObj = original[0];
      serObj = serialized[0];
    }

    if (!origObj || typeof origObj !== 'object' || !serObj || typeof serObj !== 'object') {
      return;
    }

    const originalKeys = Object.keys(origObj);
    const serializedKeys = Object.keys(serObj);
    const stripped = originalKeys.filter(k => !serializedKeys.includes(k));

    if (stripped.length > 0) {
      this.logger.warn(`[METRIC] Contract_Payload_Stripped: ${dtoName}`, {
        dto: dtoName,
        strippedFields: stripped,
        timestamp: new Date().toISOString(),
      });

      this.eventEmitter?.emit('contract.payload.stripped', {
        dto: dtoName,
        strippedFields: stripped,
        timestamp: new Date(),
      });
    }
  }
}
