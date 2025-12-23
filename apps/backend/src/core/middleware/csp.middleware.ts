import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CspMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Gerar nonce único para cada requisição
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.nonce = nonce;

    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

    // Políticas CSP Avançadas
    const cspDirectives = {
      // Fontes padrão
      'default-src': ["'self'"],

      // Scripts - permite apenas com nonce ou do próprio servidor
      'script-src': [
        "'self'",
        `'nonce-${nonce}'`,
        // Sentry (se configurado)
        process.env.SENTRY_DSN ? 'https://*.sentry.io' : '',
      ].filter(Boolean),

      // Estilos - permite inline (necessário para frameworks modernos)
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],

      // Imagens - permite data URIs e HTTPS
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:',
        isProduction ? '' : 'http://localhost:4000',
      ].filter(Boolean),

      // Fontes
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],

      // Conexões - API e Sentry
      'connect-src': [
        "'self'",
        frontendUrl,
        process.env.SENTRY_DSN ? 'https://*.sentry.io' : '',
        isProduction ? '' : 'http://localhost:4000',
        isProduction ? '' : 'http://localhost:5000',
      ].filter(Boolean),

      // Frames - bloqueia completamente (anti-clickjacking)
      'frame-src': ["'none'"],
      'frame-ancestors': ["'none'"],

      // Objetos - bloqueia plugins (Flash, etc)
      'object-src': ["'none'"],

      // Media
      'media-src': ["'self'"],

      // Workers
      'worker-src': ["'self'", 'blob:'],

      // Manifests (PWA)
      'manifest-src': ["'self'"],

      // Base URI - previne injeção de base tag
      'base-uri': ["'self'"],

      // Form action - apenas para o próprio servidor
      'form-action': ["'self'"],

      // Upgrade insecure requests (apenas em produção)
      ...(isProduction ? { 'upgrade-insecure-requests': [] } : {}),

      // Report URI - endpoint para receber violações
      'report-uri': ['/api/csp-report'],
    };

    // Construir header CSP
    const cspHeader = Object.entries(cspDirectives)
      .map(([key, values]) => {
        if (Array.isArray(values) && values.length > 0) {
          return `${key} ${values.join(' ')}`;
        } else if (Array.isArray(values) && values.length === 0) {
          return key; // Para upgrade-insecure-requests
        }
        return null;
      })
      .filter(Boolean)
      .join('; ');

    // Aplicar header
    res.setHeader('Content-Security-Policy', cspHeader);

    // CSP Report-Only (para testar sem quebrar)
    // Descomente para modo de teste:
    // res.setHeader('Content-Security-Policy-Report-Only', cspHeader);

    next();
  }
}

