import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { SentryService } from './common/services/sentry.service';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
          styleSrc: ["'self'", "'unsafe-inline'"], // Permite estilos inline (necessário para alguns frameworks)
          scriptSrc: ["'self'"],
          imgSrc: [
            "'self'",
            'data:',
            'https:',
            'http://localhost:4000',
            'http://localhost:5000',
            'http://localhost:3000',
          ], // Permite imagens do próprio servidor e frontend
          connectSrc: [
            "'self'",
            'http://localhost:4000',
            'http://localhost:5000',
            'http://localhost:3000',
            isProduction ? process.env.FRONTEND_URL || '' : '',
          ].filter(Boolean), // Remove strings vazias
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"], // Previne clickjacking
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
    setHeaders: (res) => {
      // Adicionar headers CORS para arquivos estáticos
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    exposedHeaders: ['Content-Type', 'Content-Length'],
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
