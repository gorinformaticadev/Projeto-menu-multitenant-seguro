import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  InternalServerErrorException,
  Logger,
  Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { mergeMap, Observable } from 'rxjs';
import { VALIDATE_RESPONSE_KEY } from '../decorators/validate-response.decorator';

/**
 * Interceptor para validação automática da resposta contra um DTO.
 * Se a resposta não estiver de acordo com o DTO, lança um InternalServerErrorException.
 * Isso garante que o contrato da API nunca seja violado por mudanças silenciosas no backend.
 * 
 * HARDENING: Se nenhum DTO for definido, lança erro em desenvolvimento e CI para forçar a proteção.
 */
@Injectable()
export class ResponseValidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseValidationInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const controller = context.getClass();
    
    // Detecta se é um endpoint público de health check ou similar que pode ter exceção (raro)
    const isPublic = this.reflector.get<boolean>('isPublic', handler);
    
    const dto = this.reflector.get<Type<any>>(VALIDATE_RESPONSE_KEY, handler) || 
                this.reflector.get<Type<any>>(VALIDATE_RESPONSE_KEY, controller);

    // HARDENING: Bloqueio de endpoints sem contrato em DEV/CI
    if (!dto) {
      // Lista de exceções permitidas (apenas health check básico se necessário)
      const path = context.switchToHttp().getRequest().url;
      const isHealth = path.includes('/health') || path.includes('/metrics');

      if (!isHealth && process.env.NODE_ENV !== 'production') {
        const controllerName = controller.name;
        const handlerName = handler.name;
        this.logger.error(`[HARDENING] Endpoint sem contrato definido: ${controllerName}.${handlerName} (${path})`);
        throw new InternalServerErrorException(`Hardening: O endpoint ${handlerName} não possui @ValidateResponse(DTO).`);
      }
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (data) => {
        if (data === null || data === undefined) {
          return data;
        }

        // 1. Transformação para instância do DTO
        const instance = plainToInstance(dto, data, {
          excludeExtraneousValues: true,
          enableImplicitConversion: true,
          exposeUnsetFields: true,
        });

        // 2. Validação contra o DTO
        const errors = await validate(instance, {
          whitelist: true,
          forbidNonWhitelisted: true,
          stopAtFirstError: false,
        });

        if (errors.length > 0) {
          const errorDetail = JSON.stringify(errors.map(e => ({
            property: e.property,
            constraints: e.constraints,
          })));
          
          this.logger.error(`[CONTRATO VIOLADO] O endpoint retornou dados incompatíveis com ${dto.name}: ${errorDetail}`);
          
          throw new InternalServerErrorException({
            message: 'Resposta do servidor viola o contrato definido.',
            dto: dto.name,
            errors: process.env.NODE_ENV !== 'production' ? errors : undefined,
          });
        }

        // 3. Retorno sanitizado
        return plainToInstance(dto, data, {
          excludeExtraneousValues: true,
          enableImplicitConversion: true,
          exposeUnsetFields: false,
        });
      }),
    );
  }
}
