import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AutoLoaderService } from './auto-loader.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ModulesService {
  constructor(
    private prisma: PrismaService,
    private autoLoaderService: AutoLoaderService,
    private notificationsService: NotificationsService
  ) {}

  // Listar todos os mÃ³dulos disponÃ­veis no sistema
  async findAll() {
    // Carregar mÃ³dulos do diretÃ³rio automaticamente
    await this.autoLoaderService.loadModulesFromDirectory();
    
    const modules = await this.prisma.module.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });

    return modules.map(module => module.name);
  }

  // Obter configuraÃ§Ã£o de um mÃ³dulo especÃ­fico
  async findOne(name: string) {
    const module = await this.prisma.module.findUnique({
      where: { name },
    });

    if (!module) {
      throw new NotFoundException(`MÃ³dulo '${name}' nÃ£o encontrado`);
    }

    return {
      displayName: module.displayName,
      description: module.description,
      version: module.version,
      config: module.config ? JSON.parse(module.config) : null,
    };
  }

  // Criar um novo mÃ³dulo (apenas SUPER_ADMIN)
  async create(data: {
    name: string;
    displayName: string;
    description?: string;
    version?: string;
    config?: any;
  }) {
    const existingModule = await this.prisma.module.findUnique({
      where: { name: data.name },
    });

    if (existingModule) {
      throw new BadRequestException(`MÃ³dulo '${data.name}' jÃ¡ existe`);
    }

    return this.prisma.module.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        version: data.version || '1.0.0',
        config: data.config ? JSON.stringify(data.config) : null,
      },
    });
  }

  // Atualizar um mÃ³dulo (apenas SUPER_ADMIN)
  async update(name: string, data: {
    displayName?: string;
    description?: string;
    version?: string;
    config?: any;
    isActive?: boolean;
  }) {
    const module = await this.prisma.module.findUnique({
      where: { name },
    });

    if (!module) {
      throw new NotFoundException(`MÃ³dulo '${name}' nÃ£o encontrado`);
    }

    return this.prisma.module.update({
      where: { name },
      data: {
        displayName: data.displayName,
        description: data.description,
        version: data.version,
        config: data.config ? JSON.stringify(data.config) : undefined,
        isActive: data.isActive,
      },
    });
  }

  // Deletar um mÃ³dulo (apenas SUPER_ADMIN)
  async remove(name: string) {
    const module = await this.prisma.module.findUnique({
      where: { name },
    });

    if (!module) {
      throw new NotFoundException(`MÃ³dulo '${name}' nÃ£o encontrado`);
    }

    // Verificar se hÃ¡ tenants usando este mÃ³dulo
    const tenantModules = await this.prisma.tenantModule.count({
      where: { moduleName: name },
    });

    if (tenantModules > 0) {
      throw new BadRequestException(
        `NÃ£o Ã© possÃ­vel deletar o mÃ³dulo '${name}' pois estÃ¡ sendo usado por ${tenantModules} tenant(s)`
      );
    }

    return this.prisma.module.delete({
      where: { name },
    });
  }

  // Obter mÃ³dulos ativos de um tenant
  async getTenantActiveModules(tenantId: string) {
    const tenantModules = await this.prisma.tenantModule.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        module: true,
      },
    });

    return {
      activeModules: tenantModules.map(tm => tm.moduleName),
      modules: tenantModules.map(tm => ({
        name: tm.module.name,
        displayName: tm.module.displayName,
        description: tm.module.description,
        version: tm.module.version,
        config: tm.config ? JSON.parse(tm.config) : null,
        activatedAt: tm.activatedAt,
      })),
    };
  }

  // Ativar um mÃ³dulo para um tenant
  async activateModuleForTenant(tenantId: string, moduleName: string) {
    // Verificar se o tenant existe
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant nÃ£o encontrado`);
    }

    // Verificar se o mÃ³dulo existe
    const module = await this.prisma.module.findUnique({
      where: { name: moduleName },
    });

    if (!module) {
      throw new NotFoundException(`MÃ³dulo '${moduleName}' nÃ£o encontrado`);
    }

    if (!module.isActive) {
      throw new BadRequestException(`MÃ³dulo '${moduleName}' estÃ¡ desativado no sistema`);
    }

    // Verificar se jÃ¡ existe uma relaÃ§Ã£o
    const existingTenantModule = await this.prisma.tenantModule.findUnique({
      where: {
        tenantId_moduleName: {
          tenantId,
          moduleName,
        },
      },
    });

    if (existingTenantModule) {
      if (existingTenantModule.isActive) {
        throw new BadRequestException(`MÃ³dulo '${moduleName}' jÃ¡ estÃ¡ ativo para este tenant`);
      }

      // Reativar mÃ³dulo
      const result = await this.prisma.tenantModule.update({
        where: { id: existingTenantModule.id },
        data: {
          isActive: true,
          activatedAt: new Date(),
          deactivatedAt: null,
        },
      });

      // Emitir notificaÃ§Ã£o de reativaÃ§Ã£o do mÃ³dulo
      await this.notificationsService.emitEvent({
        type: 'module_reactivated',
        source: 'core',
        severity: 'info',
        tenantId,
        payload: {
          title: 'MÃ³dulo Reativado',
          message: `O mÃ³dulo "${module.displayName}" foi reativado para sua empresa.`,
          context: `/module-${moduleName}`,
          data: {
            moduleName,
            moduleDisplayName: module.displayName,
            reactivatedAt: new Date().toISOString(),
          },
        },
      });

      return result;
    }

    // Criar nova relaÃ§Ã£o
    const result = await this.prisma.tenantModule.create({
      data: {
        tenantId,
        moduleName,
        isActive: true,
      },
    });

    // Emitir notificaÃ§Ã£o de ativaÃ§Ã£o do mÃ³dulo
    await this.notificationsService.emitEvent({
      type: 'module_activated',
      source: 'core',
      severity: 'info',
      tenantId,
      payload: {
        title: 'MÃ³dulo Ativado',
        message: `O mÃ³dulo "${module.displayName}" foi ativado para sua empresa.`,
        context: `/module-${moduleName}`,
        data: {
          moduleName,
          moduleDisplayName: module.displayName,
          activatedAt: new Date().toISOString(),
        },
      },
    });

    return result;
  }

  // Desativar um mÃ³dulo para um tenant
  async deactivateModuleForTenant(tenantId: string, moduleName: string) {
    const tenantModule = await this.prisma.tenantModule.findUnique({
      where: {
        tenantId_moduleName: {
          tenantId,
          moduleName,
        },
      },
    });

    if (!tenantModule) {
      throw new NotFoundException(`MÃ³dulo '${moduleName}' nÃ£o estÃ¡ associado a este tenant`);
    }

    if (!tenantModule.isActive) {
      throw new BadRequestException(`MÃ³dulo '${moduleName}' jÃ¡ estÃ¡ desativado para este tenant`);
    }

    const result = await this.prisma.tenantModule.update({
      where: { id: tenantModule.id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    // Buscar informaÃ§Ãµes do mÃ³dulo para a notificaÃ§Ã£o
    const module = await this.prisma.module.findUnique({
      where: { name: moduleName },
    });

    // Emitir notificaÃ§Ã£o de desativaÃ§Ã£o do mÃ³dulo
    await this.notificationsService.emitEvent({
      type: 'module_deactivated',
      source: 'core',
      severity: 'warning',
      tenantId,
      payload: {
        title: 'MÃ³dulo Desativado',
        message: `O mÃ³dulo "${module?.displayName || moduleName}" foi desativado para sua empresa.`,
        context: `/empresas`,
        data: {
          moduleName,
          moduleDisplayName: module?.displayName,
          deactivatedAt: new Date().toISOString(),
        },
      },
    });

    return result;
  }

  // Configurar um mÃ³dulo para um tenant
  async configureTenantModule(tenantId: string, moduleName: string, config: any) {
    const tenantModule = await this.prisma.tenantModule.findUnique({
      where: {
        tenantId_moduleName: {
          tenantId,
          moduleName,
        },
      },
    });

    if (!tenantModule) {
      throw new NotFoundException(`MÃ³dulo '${moduleName}' nÃ£o estÃ¡ associado a este tenant`);
    }

    return this.prisma.tenantModule.update({
      where: { id: tenantModule.id },
      data: {
        config: JSON.stringify(config),
      },
    });
  }
}
