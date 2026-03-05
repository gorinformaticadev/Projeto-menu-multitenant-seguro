import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecureFilesController } from './secure-files.controller';
import { SecureFilesService } from './secure-files.service';
import { SecureFileAccessGuard } from './guards/secure-file-access.guard';
import { PrismaModule } from '@core/prisma/prisma.module';
import { PathsModule } from '@core/common/paths/paths.module';

/**
 * Módulo de uploads sensíveis com isolamento multi-tenant
 */
@Module({
  imports: [PrismaModule, ConfigModule, PathsModule],
  controllers: [SecureFilesController],
  providers: [SecureFilesService, SecureFileAccessGuard],
  exports: [SecureFilesService], // Exportar para uso por outros módulos
})
export class SecureFilesModule {
      // Empty implementation
    }
