import { Injectable, ExecutionContext } from '@nestjs/common';
import {
    ThrottlerGuard,
    ThrottlerException,
    ThrottlerStorage,
    ThrottlerModuleOptions,
    InjectThrottlerOptions,
    InjectThrottlerStorage,
    ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

@Injectable()
export class SecurityThrottlerGuard extends ThrottlerGuard {
    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storageService: ThrottlerStorage,
        reflector: Reflector,
    ) {
        super(options, storageService, reflector);
    }

    protected async handleRequest(
        requestProps: any // Em v6 é ThrottlerRequest
    ): Promise<boolean> {
        const { context, limit, ttl, throttler } = requestProps;
        const isProduction = process.env.NODE_ENV === 'production';

        // Logica simplificada sem DB por enquanto para testar se volta o serviço
        if (throttler?.name === 'login') {
            return super.handleRequest(requestProps);
        }

        const req = context.switchToHttp().getRequest();
        const hasAuth = req.headers?.authorization || req.user;

        if (hasAuth) {
            // 10000 requisições por minuto para usuários autenticados
            return super.handleRequest({
                ...requestProps,
                limit: 10000,
                ttl: 60000
            });
        }

        // Limites padrão seguros
        const finalLimit = isProduction ? 100 : 10000;
        const finalWindow = 60000;

        return super.handleRequest({
            ...requestProps,
            limit: finalLimit,
            ttl: finalWindow
        });
    }

    protected async throwThrottlingException(
        _context: ExecutionContext,
        _throttlerLimitDetail: ThrottlerLimitDetail,
    ): Promise<void> {
        throw new ThrottlerException(
            'Limite de requisições atingido. Para evitar sobrecarga, o sistema bloqueou novas tentativas. Tente novamente em instantes.'
        );
    }
}
