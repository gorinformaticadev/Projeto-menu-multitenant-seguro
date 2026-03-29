import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { UpdateAgentModule } from './update/engine/update-agent.module';

async function bootstrap() {
  const logger = new Logger('UpdateAgentBootstrap');
  const app = await NestFactory.createApplicationContext(UpdateAgentModule, {
    logger: ['log', 'warn', 'error'],
  });

  const shutdown = async (signal: string) => {
    logger.log(`Encerrando update-agent por sinal ${signal}`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  logger.log('Update-agent inicializado.');
}

void bootstrap();
