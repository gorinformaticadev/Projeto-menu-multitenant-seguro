import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutoLoaderService } from './auto-loader.service';

@Injectable()
export class ModulesService {
  constructor(
    private prisma: PrismaService,
    private autoLoaderService: AutoLoaderService
  ) {}

  // Listar todos os módulos disponíveis no sistema
  async findAll() {
    // Carregar módulos do diretório automaticamente
    await this.autoLoaderService.loadModulesFromDirectory();
    
    const modules = await this.prisma.module.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });

    return modules.map(module => module.name);
  }

  // Obter configuração de um módulo específico
  async findOne(name: string) {
    const module = await this.prisma.module.findUnique({
      where: { name },
    });

    if (!module) {
      throw new NotFoundException(`Módulo '${name}' não encontrado`);
    }

    return {
      displayName: module.displayName,
      description: module.description,
      version: module.version,
      config: module.config ? JSON.parse(module.config) : null,
    };
  }

  // Criar um novo módulo (apenas SUPER_ADMIN)
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
      throw new BadRequestException(`Módulo '${data.name}' já existe`);
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

  // Atualizar um módulo (apenas SUPER_ADMIN)
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
      throw new NotFoundException(`Módulo '${name}' não encontrado`);
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

  // Deletar um módulo (apenas SUPER_ADMIN)
  async remove(name: string) {
    const module = await this.prisma.module.findUnique({
      where: { name },
    });

    if (!module) {
      throw new NotFoundException(`Módulo '${name}' não encontrado`);
    }

    // Verificar se há tenants usando este módulo
    const tenantModules = await this.prisma.tenantModule.count({
      where: { moduleName: name },
    });

    if (tenantModules > 0) {
      throw new BadRequestException(
        `Não é possível deletar o módulo '${name}' pois está sendo usado por ${tenantModules} tenant(s)`
      );
    }

    return this.prisma.module.delete({
      where: { name },
    });
  }

  // Obter módulos ativos de um tenant
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

  // Ativar um módulo para um tenant
  async activateModuleForTenant(tenantId: string, moduleName: string) {
    // Verificar se o tenant existe
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant não encontrado`);
    }

    // Verificar se o módulo existe
    const module = await this.prisma.module.findUnique({
      where: { name: moduleName },
    });

    if (!module) {
      throw new NotFoundException(`Módulo '${moduleName}' não encontrado`);
    }

    if (!module.isActive) {
      throw new BadRequestException(`Módulo '${moduleName}' está desativado no sistema`);
    }

    // Verificar se já existe uma relação
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
        throw new BadRequestException(`Módulo '${moduleName}' já está ativo para este tenant`);
      }

      // Reativar módulo
      return this.prisma.tenantModule.update({
        where: { id: existingTenantModule.id },
        data: {
          isActive: true,
          activatedAt: new Date(),
          deactivatedAt: null,
        },
      });
    }

    // Criar nova relação
    return this.prisma.tenantModule.create({
      data: {
        tenantId,
        moduleName,
        isActive: true,
      },
    });
  }

  // Desativar um módulo para um tenant
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
      throw new NotFoundException(`Módulo '${moduleName}' não está associado a este tenant`);
    }

    if (!tenantModule.isActive) {
      throw new BadRequestException(`Módulo '${moduleName}' já está desativado para este tenant`);
    }

    return this.prisma.tenantModule.update({
      where: { id: tenantModule.id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });
  }

  // Configurar um módulo para um tenant
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
      throw new NotFoundException(`Módulo '${moduleName}' não está associado a este tenant`);
    }

    return this.prisma.tenantModule.update({
      where: { id: tenantModule.id },
      data: {
        config: JSON.stringify(config),
      },
    });
  }
}