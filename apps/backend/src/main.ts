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
import { SecretManagerService } from './common/services/secret-manager.nest.service';
import { createAdapter } from '@socket.io/redis-adapter';
import { Cluster } from 'ioredis';

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

  // ============================================
  // 🔐 SECRET MANAGEMENT - Carregar secrets antes da inicialização
  // ============================================
  console.log('🔐 Inicializando Secret Manager...');
  
  try {
    const secretManager = new SecretManagerService();
    await secretManager.initialize();
    
    // Validar secrets críticos
    if (!secretManager.validateCriticalSecrets()) {
      console.error('❌ Secrets críticos ausentes!');
      process.exit(1);
    }
    
    console.log('✅ Secret Manager inicializado com sucesso');
  } catch (error) {
    console.error('❌ Falha ao inicializar Secret Manager:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuando em modo desenvolvimento sem Secret Manager');
    }
  }

  // Carregamento dinâmico de módulos via register()
  const dynamicModule = await AppModule.register();
  const app = await NestFactory.create<NestExpressApplication>(dynamicModule);

  // ============================================
  // 🔧 REDIS ADAPTER PARA ESCALABILIDADE HORIZONTAL
  // ============================================
  if (process.env.REDIS_HOST) {
    console.log('🔧 Configurando Redis adapter para Socket.IO...');
    
    try {
      // Configuração do cluster Redis
      const redisOptions = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
      };

      // Criar clientes Redis para pub/sub
      const pubClient = new Cluster([
        { host: redisOptions.host, port: redisOptions.port }
      ], {
        redisOptions: { password: redisOptions.password }
      });

      const subClient = pubClient.duplicate();

      // Aguardar conexão Redis
      await Promise.all([
        pubClient.ping(),
        subClient.ping()
      ]);

      // Obter instância do servidor HTTP
      const server = app.getHttpServer();
      
      // Configurar Socket.IO com adaptador Redis
      const io = require('socket.io')(server, {
        cors: {
          origin: [
            process.env.FRONTEND_URL || 'http://localhost:5000',
            'http://localhost:5000',
            'http://localhost:3000'
          ],
          credentials: true,
          methods: ['GET', 'POST'],
          allowedHeaders: ['Authorization', 'Content-Type'],
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
      });

      // Aplicar adaptador Redis
      io.adapter(createAdapter(pubClient, subClient));

      // Tornar instância io disponível na aplicação
      app.set('io', io);
      
      console.log('✅ Redis adapter configurado com sucesso');
      
    } catch (error) {
      console.error('❌ Falha ao configurar Redis adapter:', error.message);
      console.warn('⚠️  Continuando sem Redis adapter (modo standalone)');
    }
  } else {
    console.log('ℹ️  Redis não configurado - usando modo standalone');
  }

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
    console.log('🔒 HTTPS Enforcement ativado');
  }

  // Servir arquivos estáticos (logos)
  // Usa process.cwd() que sempre aponta para a raiz do projeto
  const uploadsPath = join(process.cwd(), 'uploads');
  console.log('📁 Servindo arquivos estáticos de:', uploadsPath);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
    setHeaders: (res, path, stat) => {
      // Headers de segurança para arquivos estáticos
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Detecta se é um arquivo de logo
      const isLogoFile = path.includes('logos/');

      if (isLogoFile) {
        // CORS permissivo para logos (recursos públicos visuais)
        // Logos não contêm informações sensíveis e precisam ser acessíveis
        // Tags <img> frequentemente não enviam header 'origin'
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Cache mais longo para logos (mudam raramente)
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas

        if (!isProduction) {
          console.log('🖼️  Servindo logo:', path);
        }
      } else {
        // CORS restritivo para outros arquivos estáticos
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

        // Cache padrão para outros arquivos
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
      }

      // Headers de segurança comuns a todos os arquivos
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
  // const { SanitizationPipe } = await import('./common/pipes/sanitization.pipe');
  // app.useGlobalPipes(new SanitizationPipe()); // TEMPORARIAMENTE DESABILITADO NOVAMENTE

  // ============================================
  // ✅ VALIDAÇÃO - Rigorosa em todos os endpoints
  // ============================================
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //     transform: true,
  //   }),
  // ); // TEMPORARIAMENTE DESABILITADO

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Backend rodando em http://localhost:${port}`);
  console.log(`🛡️  Headers de segurança ativados (Helmet)`);
}
bootstrap();
