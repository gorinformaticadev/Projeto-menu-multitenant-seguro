import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';

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
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('Token CSRF ausente');
    }

    if (cookieToken !== headerToken) {
      throw new ForbiddenException('Token CSRF inválido');
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
    // sameSite: 'strict' - proteção adicional contra CSRF
    response.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Precisa ser acessível pelo JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    });
  }
}
