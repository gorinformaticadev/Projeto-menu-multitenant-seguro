import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerStorage, ThrottlerModuleOptions, InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerLimitDetail } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { SecurityConfigService } from '../../security-config/security-config.service';

@Injectable()
export class SecurityThrottlerGuard extends ThrottlerGuard {
    private readonly logger = new Logger(SecurityThrottlerGuard.name);
    private readonly configCacheTtlMs = 15000;
    private cachedRateLimitConfig: {
        enabled: boolean;
        requests: number;
        window: number;
        isProduction: boolean;
    } | null = null;
    private rateLimitConfigExpiresAt = 0;

    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storageService: ThrottlerStorage,
        reflector: Reflector,
        private securityConfigService: SecurityConfigService,
    ) {
        super(options, storageService, reflector);
    }

    protected async handleRequest(
        requestProps: any
    ): Promise<boolean> {
        const { throttler } = requestProps;

        const rateLimitConfig = await this.getRateLimitConfigCached();

        // Mantém limites declarados em @Throttle para não quebrar regras por endpoint.
        const moduleLimit = this.toPositiveNumber(throttler?.limit, requestProps.limit);
        const moduleTtl = this.toPositiveNumber(throttler?.ttl, requestProps.ttl);
        const resolvedLimit = this.toPositiveNumber(requestProps.limit, moduleLimit);
        const resolvedTtl = this.toPositiveNumber(requestProps.ttl, moduleTtl);

        let limit = resolvedLimit;
        let ttl = resolvedTtl;

        const hasExplicitRouteConfig = resolvedLimit !== moduleLimit || resolvedTtl !== moduleTtl;

        // Se desativado no painel, mantém apenas limites explícitos de endpoints críticos.
        if (rateLimitConfig?.enabled === false && !hasExplicitRouteConfig) {
            return true;
        }

        // Só aplica configuração adaptativa do painel quando a rota não define @Throttle próprio.
        if (!hasExplicitRouteConfig && throttler?.name === 'default' && rateLimitConfig?.enabled === true) {
            limit = this.toPositiveNumber(rateLimitConfig.requests, limit);
            ttl = this.toPositiveNumber(rateLimitConfig.window, 1) * 60000;
        }

        return super.handleRequest({
            ...requestProps,
            limit,
            ttl
        });
    }

    /**
     * Gera uma chave única por IP ou por Tenant:User para isolamento multitenant real
     */
    protected async getTracker(req: Record<string, any>): Promise<string> {
        // Se já existe contexto autenticado, usa tenant/user como chave.
        if (req.user) {
            const userId = req.user.id || req.user.sub;
            if (userId) {
                const tenantId = req.user.tenantId || 'global';
                return `tenant:${tenantId}:user:${userId}`;
            }
        }

        // Com trust proxy habilitado, req.ip já usa o IP real de forma segura.
        if (typeof req.ip === 'string' && req.ip.trim().length > 0) {
            return req.ip.trim();
        }

        // Fallback defensivo.
        const forwardedForHeader = req?.headers?.['x-forwarded-for'];
        const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
        if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
            return forwardedFor.split(',')[0].trim();
        }

        const realIpHeader = req?.headers?.['x-real-ip'];
        const realIp = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;
        if (typeof realIp === 'string' && realIp.trim().length > 0) {
            return realIp.trim();
        }

        return 'unknown';
    }

    protected async throwThrottlingException(
        _context: ExecutionContext,
        _throttlerLimitDetail: ThrottlerLimitDetail,
    ): Promise<void> {
        throw new ThrottlerException(
            'Muitas requisições. Por segurança e estabilidade, o sistema limitou temporariamente suas ações. Tente novamente em instantes.'
        );
    }

    private toPositiveNumber(value: unknown, fallback: number): number {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            return value;
        }
        return fallback;
    }

    private async getRateLimitConfigCached(): Promise<{
        enabled: boolean;
        requests: number;
        window: number;
        isProduction: boolean;
    } | null> {
        const now = Date.now();

        if (this.cachedRateLimitConfig && now < this.rateLimitConfigExpiresAt) {
            return this.cachedRateLimitConfig;
        }

        try {
            const config = await this.securityConfigService.getRateLimitConfig();
            this.cachedRateLimitConfig = config;
            this.rateLimitConfigExpiresAt = now + this.configCacheTtlMs;
            return config;
        } catch (error) {
            this.cachedRateLimitConfig = null;
            this.rateLimitConfigExpiresAt = now + this.configCacheTtlMs;
            this.logger.warn(
                `Falha ao carregar config de rate limit do banco; usando limites do módulo. detalhe=${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        }
    }
}
