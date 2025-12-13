import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { ModuleInstallerService } from './module-installer.service';
import { AutoLoaderService } from './auto-loader.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModulesController],
  providers: [ModulesService, ModuleInstallerService, AutoLoaderService],
  exports: [ModulesService, ModuleInstallerService, AutoLoaderService],
})
export class ModulesModule {}