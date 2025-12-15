import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModulesService } from './modules.service';
import { ModuleInstallerService } from './module-installer.service';
import { ModuleMigrationService } from './module-migration.service';
import { AutoLoaderService } from './auto-loader.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModulesController {
  constructor(
    private readonly modulesService: ModulesService,
    private readonly moduleInstallerService: ModuleInstallerService,
    private readonly moduleMigrationService: ModuleMigrationService,
    private readonly autoLoaderService: AutoLoaderService
  ) { }

  // GET /modules - Listar todos os módulos disponíveis
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findAll() {
    return this.modulesService.findAll();
  }

  // GET /modules/:name/config - Obter configuração de um módulo
  @Get(':name/config')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findOne(@Param('name') name: string) {
    return this.modulesService.findOne(name);
  }

  // POST /modules - Criar um novo módulo (apenas SUPER_ADMIN)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async create(@Body() createModuleDto: {
    name: string;
    displayName: string;
    description?: string;
    version?: string;
    config?: any;
  }) {
    return this.modulesService.create(createModuleDto);
  }

  // PUT /modules/:name - Atualizar um módulo (apenas SUPER_ADMIN)
  @Put(':name')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('name') name: string,
    @Body() updateModuleDto: {
      displayName?: string;
      description?: string;
      version?: string;
      config?: any;
      isActive?: boolean;
    }
  ) {
    return this.modulesService.update(name, updateModuleDto);
  }

  // DELETE /modules/:name - Deletar um módulo (apenas SUPER_ADMIN)
  @Delete(':name')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('name') name: string) {
    await this.modulesService.remove(name);
  }

  // POST /modules/upload - Upload de módulo via ZIP (apenas SUPER_ADMIN)
  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('module', {
    storage: require('multer').memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
    fileFilter: (req, file, callback) => {
      if (!file.originalname.match(/\.(zip)$/)) {
        return callback(new BadRequestException('Apenas arquivos ZIP são permitidos'), false);
      }
      callback(null, true);
    },
  }))
  async uploadModule(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }
    return this.moduleInstallerService.uploadModule(file);
  }

  // DELETE /modules/:name/uninstall - Remover módulo instalado (apenas SUPER_ADMIN)
  @Delete(':name/uninstall')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async uninstallModule(@Param('name') name: string) {
    return this.moduleInstallerService.removeModule(name);
  }

  // GET /modules/installed - Listar módulos instalados (apenas SUPER_ADMIN)
  @Get('installed')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getInstalledModules() {
    return this.moduleInstallerService.listInstalledModules();
  }

  // GET /modules/:name/info - Informações detalhadas do módulo (apenas SUPER_ADMIN)
  @Get(':name/info')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getModuleInfo(@Param('name') name: string) {
    return this.moduleInstallerService.getModuleInfo(name);
  }

  // GET /modules/:name/tenants - Listar tenants que usam o módulo (apenas SUPER_ADMIN)
  @Get(':name/tenants')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getModuleTenants(@Param('name') name: string) {
    return this.moduleInstallerService.getModuleTenants(name);
  }

  // GET /modules/auto-load - Forçar carregamento automático de módulos (apenas SUPER_ADMIN)
  @Get('auto-load')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async autoLoadModules() {
    await this.autoLoaderService.loadModulesFromDirectory();
    return { message: 'Módulos carregados automaticamente com sucesso' };
  }

  // POST /modules/:name/update-database - Executar migrações e seed do módulo (apenas SUPER_ADMIN)
  @Post(':name/update-database')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async updateModuleDatabase(
    @Param('name') name: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.moduleInstallerService.updateModuleDatabase(name, userId);
  }

  // GET /modules/:name/check-updates - Verificar se o módulo tem atualizações pendentes (apenas SUPER_ADMIN)
  @Get(':name/check-updates')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async checkModuleUpdates(@Param('name') name: string) {
    return this.moduleInstallerService.checkModuleUpdates(name);
  }

  // ========================================
  // Novos Endpoints de Controle de Migrations
  // ========================================

  // GET /modules/:name/migrations/status - Obter status detalhado de migrations/seeds
  @Get(':name/migrations/status')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getMigrationStatus(@Param('name') name: string) {
    return this.moduleMigrationService.getMigrationStatus(name);
  }

  // GET /modules/:name/migrations/pending - Listar apenas migrations/seeds pendentes
  @Get(':name/migrations/pending')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getPendingMigrations(@Param('name') name: string) {
    const [migrations, seeds] = await Promise.all([
      this.moduleMigrationService.getPendingMigrations(name),
      this.moduleMigrationService.getPendingSeeds(name)
    ]);
    
    return {
      moduleName: name,
      pendingMigrations: migrations,
      pendingSeeds: seeds,
      hasPending: migrations.length > 0 || seeds.length > 0
    };
  }

  // POST /modules/:name/migrations/sync - Forçar sincronização (descoberta)
  @Post(':name/migrations/sync')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async syncModuleMigrations(@Param('name') name: string) {
    await this.moduleMigrationService.discoverModuleMigrations(name);
    const status = await this.moduleMigrationService.getMigrationStatus(name);
    
    return {
      message: `Sincronização concluída para o módulo '${name}'`,
      status
    };
  }

  // POST /modules/:name/migrations/retry/:id - Reexecutar migration que falhou
  @Post(':name/migrations/retry/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async retryFailedMigration(
    @Param('name') moduleName: string,
    @Param('id') migrationId: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    const result = await this.moduleMigrationService.retryFailedMigration(
      migrationId,
      userId
    );
    
    return {
      message: `Migration reexecutada com sucesso`,
      moduleName,
      ...result
    };
  }
}