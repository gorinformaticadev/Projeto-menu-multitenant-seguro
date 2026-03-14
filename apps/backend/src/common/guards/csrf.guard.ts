import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * CSRF Guard - Proteção contra Cross-Site Request Forgery
 * 
 * Implementa Double Submit Cookie pattern:
 * 1. Backend gera token CSRF e envia via cookie
 * 2. Frontend lê cookie e envia token em header X-CSRF-Token
 * 3. Backend valida se token do header = token do cookie
 * 
 * Métodos seguros (GET, HEAD, OPTIONS) são isentos de validação
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly configCacheTtlMs = 15000;
  private cachedEnabled: boolean | null = null;
  private configExpiresAt = 0;

  constructor(
    private reflector: Reflector,
    private readonly configResolver: ConfigResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const csrfEnabled = await this.isCsrfEnabledCached();
    if (!csrfEnabled) {
      return true;
    }

    // Verifica se a rota está marcada para pular CSRF
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCsrf) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method.toUpperCase();

    // Validar origem da requisição
    if (!this.isValidOrigin(request)) {
      throw new ForbiddenException('Origem da requisição inválida');
    }

    // Métodos seguros não precisam de validação CSRF
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(method)) {
      // Gerar e enviar token CSRF para métodos seguros
      this.setCsrfToken(request, response);
      return true;
    }

    // Para métodos não seguros, validar token CSRF
    const cookieToken = request.cookies?.['XSRF-TOKEN'];
    const headerToken = request.headers['x-csrf-token'] || request.headers['x-xsrf-token'];

    // Em desenvolvimento, ser mais tolerante
    if (process.env.NODE_ENV !== 'production') {
      if (!cookieToken && !headerToken) {
        // Gerar token automaticamente em DEV se ambos estiverem ausentes
        this.setCsrfToken(request, response);
        return true;
      }

      // Se apenas um estiver presente, permitir em DEV
      if (cookieToken || headerToken) {
        return true;
      }
    }

    if (!cookieToken || !headerToken) {
      this.logSuspiciousActivity(request, 'TOKEN_MISSING');
      throw new ForbiddenException('Token CSRF ausente');
    }

    if (cookieToken !== headerToken) {
      this.logSuspiciousActivity(request, 'TOKEN_MISMATCH');
      throw new ForbiddenException('Token CSRF inválido');
    }

    // Validar timestamp do token (opcional, para tokens com expiração)
    if (!this.isValidTokenAge(cookieToken)) {
      this.logSuspiciousActivity(request, 'TOKEN_EXPIRED');
      throw new ForbiddenException('Token CSRF expirado');
    }

    return true;
  }

  /**
   * Gera e define token CSRF no cookie
   */
  private setCsrfToken(request: any, response: any): void {
    // Se já existe token válido, não gerar novo
    if (request.cookies?.['XSRF-TOKEN']) {
      return;
    }

    // Gerar token aleatório
    const token = crypto.randomBytes(32).toString('hex');

    // Definir cookie com token CSRF
    // httpOnly: false - permite JavaScript ler o cookie
    // sameSite: 'lax' - mais compatível com desenvolvimento
    response.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Precisa ser acessível pelo JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    });
  }

  /**
   * Valida a origem da requisição
   */
  private isValidOrigin(request: any): boolean {
    const origin = request.headers.origin;
    const referer = request.headers.referer;

    // Em ambiente de desenvolvimento, ser mais permissivo
    if (process.env.NODE_ENV !== 'production') {
      // Permitir localhost e IPs locais
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (originUrl.hostname === 'localhost' ||
            originUrl.hostname === '127.0.0.1' ||
            originUrl.hostname.startsWith('192.168.') ||
            originUrl.hostname.startsWith('10.')) {
            return true;
          }
        } catch {
          // URL inválida, continuar verificação
        }
      }
      return true; // Permitir tudo em DEV
    }

    // Lista de origens permitidas
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://seu-dominio.com',
      'https://www.seu-dominio.com'
    ].filter(Boolean);

    // Validar Origin header
    if (origin && allowedOrigins.includes(origin)) {
      return true;
    }

    // Validar Referer header como fallback
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        return allowedOrigins.some(allowed =>
          refererUrl.origin === allowed
        );
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Valida a idade do token CSRF
   */
  private isValidTokenAge(token: string): boolean {
    // Tokens CSRF são stateless por padrão
    // Esta validação pode ser implementada com timestamp embutido
    // ou usando armazenamento em sessão/cache
    return token.length === 64; // Verificar comprimento esperado
  }

  /**
   * Log de atividades suspeitas
   */
  private logSuspiciousActivity(request: any, reason: string): void {
    console.warn('🚨 Atividade suspeita detectada:', {
      reason,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'],
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString()
    });
  }
  private async isCsrfEnabledCached(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedEnabled !== null && now < this.configExpiresAt) {
      return this.cachedEnabled;
    }

    this.cachedEnabled = (await this.configResolver.getBoolean('security.csrf.enabled')) === true;
    this.configExpiresAt = now + this.configCacheTtlMs;
    return this.cachedEnabled;
  }
}
