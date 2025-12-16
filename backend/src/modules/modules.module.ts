import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { ModuleInstallerService } from './module-installer.service';
import { ModuleMigrationService } from './module-migration.service';
import { AutoLoaderService } from './auto-loader.service';
import { PrismaModule } from '@core/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
// Novos services do sistema de upload
import { SafeConfigParser } from './security/safe-config-parser.service';
import { ModuleValidator } from './validation/module-validator.service';
import { ModuleUploadService } from './upload/module-upload.service';
import { ModuleManagementController } from './upload/module-management.controller';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  ],
  controllers: [
    ModulesController,
    ModuleManagementController, // Novo controller
  ],
  providers: [
    ModulesService,
    ModuleInstallerService,
    ModuleMigrationService,
    AutoLoaderService,
    // Novos services
    SafeConfigParser,
    ModuleValidator,
    ModuleUploadService,
  ],
  exports: [
    ModulesService,
    ModuleInstallerService,
    ModuleMigrationService,
    AutoLoaderService,
    // Exportar novos services
    SafeConfigParser,
    ModuleValidator,
    ModuleUploadService,
  ],
})
export class ModulesModule { }
