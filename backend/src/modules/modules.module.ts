import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { ModuleInstallerService } from './module-installer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModulesController],
  providers: [ModulesService, ModuleInstallerService],
  exports: [ModulesService, ModuleInstallerService],
})
export class ModulesModule {}