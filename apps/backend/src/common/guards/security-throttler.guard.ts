import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerStorage, ThrottlerModuleOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { SecurityConfigService } from '../../security-config/security-config.service';

@Injectable()
export class SecurityThrottlerGuard extends ThrottlerGuard {
    constructor(
        @Inject('THROTTLER_MODULE_OPTIONS') options: ThrottlerModuleOptions,
        storageService: ThrottlerStorage,
        reflector: Reflector,
        @Inject(SecurityConfigService) private readonly securityConfigService: SecurityConfigService,
    ) {
        super(options, storageService, reflector);
    }

    protected async handleRequest(
        context: ExecutionContext,
        limit: number,
        ttl: number,
        throttler: any,
    ): Promise<boolean> {
        const isProduction = process.env.NODE_ENV === 'production';

        // Obter configuração do banco de dados
        const config = await this.securityConfigService.getConfig();

        // Se o throttler for 'login', respeita o limite configurado (mais rígido)
        if (throttler.name === 'login') {
            return super.handleRequest(context, limit, ttl, throttler);
        }

        // Verifica se o rate limiting está globalmente desabilitado para o ambiente atual
        const isEnabled = isProduction ? config.rateLimitProdEnabled : config.rateLimitDevEnabled;
        if (!isEnabled) {
            return true;
        }

        const req = context.switchToHttp().getRequest();

        // Verifica se há token de autenticação no header (indica que é o sistema interno)
        // Se houver, aplica um limite muito generoso
        const hasAuth = req.headers.authorization || req.user;

        if (hasAuth) {
            // 10000 requisições por minuto para usuários autenticados (quase ilimitado)
            const authenticatedLimit = 10000;
            return super.handleRequest(context, authenticatedLimit, ttl, throttler);
        }

        // Para usuários não autenticados, usa os limites do banco de dados
        const dbLimit = isProduction ? config.rateLimitProdRequests : config.rateLimitDevRequests;
        const dbWindow = isProduction ? config.rateLimitProdWindow : config.rateLimitDevWindow;

        const finalLimit = dbLimit || config.globalMaxRequests || limit;
        const finalWindow = (dbWindow || config.globalWindowMinutes || (ttl / 60000)) * 60000;

        return super.handleRequest(
            context,
            finalLimit,
            finalWindow,
            throttler
        );
    }

    protected throwThrottlerException(context: ExecutionContext): void {
        throw new ThrottlerException(
            'Limite de requisições atingido. Para evitar sobrecarga, o sistema bloqueou novas tentativas. Tente novamente em instantes.'
        );
    }
}
