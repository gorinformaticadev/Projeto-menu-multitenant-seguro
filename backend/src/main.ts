import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Servir arquivos estáticos (logos)
  // Em dev: __dirname = dist/src, então precisa subir 2 níveis
  // Em prod: __dirname = dist, então precisa subir 1 nível
  const uploadsPath = join(__dirname, '..', '..', 'uploads');
  console.log('📁 Servindo arquivos estáticos de:', uploadsPath);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
  });

  // CORS configurado para aceitar apenas o frontend
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:5000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  // Validação rigorosa em todos os endpoints
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
}
bootstrap();
