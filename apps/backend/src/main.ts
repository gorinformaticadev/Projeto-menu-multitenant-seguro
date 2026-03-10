// Forced reload to check module loading debug logs v3
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { SentryService } from './common/services/sentry.service';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { validateSecurityConfig } from './common/utils/security.utils';
import { SecretManagerService } from './common/services/secret-manager.nest.service';
import { PathsService } from './core/common/paths/paths.service';
import { SanitizationPipe } from './common/pipes/sanitization.pipe';

async function bootstrap() {
  const requireSecretManager = process.env.REQUIRE_SECRET_MANAGER === 'true';

  // ============================================
  // 🔒 VALIDAÇÃO DE SEGURANÇA NA INICIALIZAÇÃO
  // ============================================
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

  // ============================================
  // 🔐 SECRET MANAGEMENT - Carregar secrets antes da inicialização
  // ============================================
  try {
    const secretManager = new SecretManagerService();
    await secretManager.initialize();

    // Validar secrets críticos
    if (!secretManager.validateCriticalSecrets()) {
      console.error('❌ Secrets críticos ausentes!');
      if (requireSecretManager) {
        process.exit(1);
      }
      console.warn('⚠️ REQUIRE_SECRET_MANAGER=false: continuando sem validação estrita de secrets.');
    }

  } catch (error) {
    console.error('❌ Falha ao inicializar Secret Manager:', error.message);
    if (process.env.NODE_ENV === 'production' && requireSecretManager) {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuando em modo desenvolvimento sem Secret Manager');
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ REQUIRE_SECRET_MANAGER=false: continuando em produção sem Secret Manager.');
      }
    }
  }

  // Carregamento dinâmico de módulos via register()
  const dynamicModule = await AppModule.register();
  const app = await NestFactory.create<NestExpressApplication>(dynamicModule);
  app.setGlobalPrefix('api');
  const isProduction = process.env.NODE_ENV === 'production';

  // Quando atrás de Nginx/Proxy reverso, usa o primeiro hop confiável para req.ip.
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  // ============================================
  // 🔧 REDIS ADAPTER PARA ESCALABILIDADE HORIZONTAL
  // ============================================
  // Removido: O NotificationGateway agora gerencia o Socket.IO server
  // O adaptador Redis será configurado diretamente no gateway se necessário

  // ============================================
  // 🔒 COOKIE PARSER - Necessário para CSRF protection
  // ============================================
  app.use(cookieParser());

  // ============================================
  // 📊 MONITORAMENTO - Sentry
  // ============================================
  app.get(SentryService);
  app.useGlobalFilters(new SentryExceptionFilter());

  // ============================================
  // 🛡️ SEGURANÇA: Headers de Proteção (Helmet)
  // ============================================
  app.use(
    helmet({
      // Content Security Policy - Previne XSS
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Em produção, considere usar hashes ou nonces para remover unsafe-inline
          scriptSrc: ["'self'"], // Removido unsafe-eval
          imgSrc: [
            "'self'",
            'data:',
            'https:',
            'blob:',
            'http://localhost:4000',
            'https://localhost:4000',
            'http://localhost:5000',
            'https://localhost:5000',
            'http://localhost:3000',
            'https://localhost:3000',
          ], // Permite imagens do próprio servidor e frontend
          connectSrc: [
            "'self'",
            'http://localhost:4000',
            'https://localhost:4000',
            'http://localhost:5000',
            'https://localhost:5000',
            'http://localhost:3000',
            'https://localhost:3000',
            'ws://localhost:4000',
            'wss://localhost:4000',
            'ws://localhost:5000',
            'wss://localhost:5000',
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
    // Cross-Origin Embedder Policy - Ajustado para permitir imagens
    // unsafe-none permite carregar recursos cross-origin sem CORP
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

    // Cross-Origin Opener Policy - Ajustado para permitir imagens
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');

    // Cross-Origin Resource Policy - Permite cross-origin
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
    // Empty implementation
  }

  // Serve only public logos. Sensitive and temp directories are never exposed as static assets.
  const pathsService = app.get(PathsService);
  const logosPath = pathsService.getLogosDir();
  const setLogosHeaders = (res: any) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  };

  app.useStaticAssets(logosPath, {
    prefix: '/logos',
    setHeaders: setLogosHeaders,
  });
  app.useStaticAssets(logosPath, {
    prefix: '/api/logos',
    setHeaders: setLogosHeaders,
  });
  app.useStaticAssets(logosPath, {
    prefix: '/uploads/logos',
    setHeaders: setLogosHeaders,
  });
  app.useStaticAssets(logosPath, {
    prefix: '/api/uploads/logos',
    setHeaders: setLogosHeaders,
  });

  // ============================================
  // 🌐 CORS - Configurado para aceitar apenas o frontend
  // ============================================
  const allowedOrigins = isProduction
    ? [process.env.FRONTEND_URL].filter(Boolean)
    : [
      process.env.FRONTEND_URL,
      'http://127.0.0.1:5000',
      'http://localhost:5000',
      'http://localhost:3000',
    ].filter(Boolean);

  if (isProduction && allowedOrigins.length === 0) {
    console.warn('⚠️  AVISO: FRONTEND_URL não definida em produção. CORS pode bloquear requisições legítimas.');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    exposedHeaders: [
      'Content-Type',
      'Content-Length',
      'X-Total-Count',
      'X-API-Deprecated',
      'Deprecation',
      'Link',
      'Warning',
    ],
    maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400, // Cache preflight por 24h
  });

  // ============================================
  // 🧹 SANITIZAÇÃO - Remove espaços e caracteres perigosos
  // ============================================
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
  await app.listen(port, '0.0.0.0');
  console.warn(`🛡️  Headers de segurança ativados (Helmet)`);
}
bootstrap();
