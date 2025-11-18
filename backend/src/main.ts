import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ============================================
  // 🛡️ SEGURANÇA: Headers de Proteção (Helmet)
  // ============================================
  app.use(
    helmet({
      // Content Security Policy - Previne XSS
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Permite estilos inline (necessário para alguns frameworks)
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http://localhost:4000'], // Permite imagens do próprio servidor
          connectSrc: ["'self'", 'http://localhost:4000', 'http://localhost:5000'], // Permite conexões com backend
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"], // Previne clickjacking
        },
      },
      // HTTP Strict Transport Security - Força HTTPS
      hsts: {
        maxAge: 31536000, // 1 ano
        includeSubDomains: true,
        preload: true,
      },
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

  // Servir arquivos estáticos (logos)
  // Em dev: __dirname = dist/src, então precisa subir 2 níveis
  // Em prod: __dirname = dist, então precisa subir 1 nível
  const uploadsPath = join(__dirname, '..', '..', 'uploads');
  console.log('📁 Servindo arquivos estáticos de:', uploadsPath);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
  });

  // ============================================
  // 🌐 CORS - Configurado para aceitar apenas o frontend
  // ============================================
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:5000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

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
