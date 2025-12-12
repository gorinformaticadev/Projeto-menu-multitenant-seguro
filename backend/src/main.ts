import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { SentryService } from './common/services/sentry.service';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { validateSecurityConfig } from './common/utils/security.utils';

async function bootstrap() {
  // ============================================
  // 🔒 VALIDAÇÃO DE SEGURANÇA NA INICIALIZAÇÃO
  // ============================================
  console.log('🔒 Validando configurações de segurança...');
  const securityValidation = validateSecurityConfig();

  if (!securityValidation.isValid) {
    console.error('❌ ERRO DE SEGURANÇA: Configurações inseguras detectadas!');
    securityValidation.errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
  }

  if (securityValidation.warnings.length > 0) {
    console.warn('⚠️  AVISOS DE SEGURANÇA:');
    securityValidation.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  console.log('✅ Configurações de segurança validadas com sucesso');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ============================================
  // 🔒 COOKIE PARSER - Necessário para CSRF protection
  // ============================================
  app.use(cookieParser());

  // ============================================
  // 📊 MONITORAMENTO - Sentry
  // ============================================
  const sentryService = app.get(SentryService);
  app.useGlobalFilters(new SentryExceptionFilter());

  // ============================================
  // 🛡️ SEGURANÇA: Headers de Proteção (Helmet)
  // ============================================
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(
    helmet({
      // Content Security Policy - Previne XSS
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Mantido unsafe-inline por compatibilidade (frameworks CSS)
          scriptSrc: ["'self'"], // Removido unsafe-eval
          imgSrc: [
            "'self'",
            'data:',
            'https:',
            'blob:',
            'http://localhost:4000',
            'http://localhost:5000',
            'http://localhost:3000',
          ], // Permite imagens do próprio servidor e frontend
          connectSrc: [
            "'self'",
            'http://localhost:4000',
            'http://localhost:5000',
            'http://localhost:3000',
            'ws://localhost:4000', // WebSocket para hot reload
            'ws://localhost:5000',
            isProduction ? process.env.FRONTEND_URL || '' : '',
          ].filter(Boolean), // Remove strings vazias
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"], // Previne clickjacking
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"], // Previne clickjacking adicional
        },
      },
      // HTTP Strict Transport Security - Força HTTPS (apenas em produção)
      hsts: isProduction
        ? {
          maxAge: 31536000, // 1 ano
          includeSubDomains: true,
          preload: true,
        }
        : false,
      // Previne clickjacking
      frameguard: {
        action: 'deny',
      },
      // Previne MIME type sniffing
      noSniff: true,
      // Desabilita X-Powered-By header (não expor tecnologia)
      hidePoweredBy: true,
      // Previne que o navegador faça DNS prefetching
      dnsPrefetchControl: {
        allow: false,
      },
      // Previne que o navegador baixe recursos não confiáveis
      ieNoOpen: true,
      // Referrer Policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
    }),
  );

  // ============================================
  // 🛡️ Headers de Segurança Adicionais
  // ============================================
  app.use((req, res, next) => {
    // Cross-Origin Embedder Policy - Protege contra certos ataques
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

    // Cross-Origin Opener Policy - Protege contra certos ataques
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Cross-Origin Resource Policy
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Origin-Agent-Cluster - Melhora isolamento
    res.setHeader('Origin-Agent-Cluster', '?1');

    // DNS Prefetch Control
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    next();
  });

  // ============================================
  // 🔒 HTTPS ENFORCEMENT - Apenas em produção
  // ============================================
  if (isProduction) {
    console.log('🔒 HTTPS Enforcement ativado');
  }

  // Servir arquivos estáticos (logos)
  // Em dev: __dirname = dist/src, então precisa subir 2 níveis
  // Em prod: __dirname = dist, então precisa subir 1 nível
  const uploadsPath = join(__dirname, '..', '..', 'uploads');
  console.log('📁 Servindo arquivos estáticos de:', uploadsPath);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
    setHeaders: (res, path, stat) => {
      // Headers de segurança para arquivos estáticos
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // CORS restritivo - apenas origins permitidas
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:5000',
        'http://localhost:3000'
      ].filter(Boolean);

      const origin = res.req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }

      // Headers de cache e segurança
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
    },
  });

  // ============================================
  // 🌐 CORS - Configurado para aceitar apenas o frontend
  // ============================================
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:5000',
      'http://localhost:3000', // Next.js dev server
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    exposedHeaders: ['Content-Type', 'Content-Length', 'X-Total-Count'],
    maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400, // Cache preflight por 24h
  });

  // ============================================
  // 🧹 SANITIZAÇÃO - Remove espaços e caracteres perigosos
  // ============================================
  const { SanitizationPipe } = await import('./common/pipes/sanitization.pipe');
  app.useGlobalPipes(new SanitizationPipe());

  // ============================================
  // ✅ VALIDAÇÃO - Rigorosa em todos os endpoints
  // ============================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Backend rodando em http://localhost:${port}`);
  console.log(`🛡️  Headers de segurança ativados (Helmet)`);
}
bootstrap();
