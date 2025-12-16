import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Empresa nÃ£o encontrada');
    }

    return tenant;
  }

  async create(createTenantDto: CreateTenantDto) {
    const { email, cnpjCpf, nomeFantasia, nomeResponsavel, telefone, adminEmail, adminPassword, adminName } = createTenantDto;

    // Verifica se jÃ¡ existe tenant com o mesmo email ou CNPJ/CPF
    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ email }, { cnpjCpf }],
      },
    });

    if (existingTenant) {
      throw new ConflictException('JÃ¡ existe uma empresa com este email ou CNPJ/CPF');
    }

    // Verifica se jÃ¡ existe usuÃ¡rio com o email do admin
    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      throw new ConflictException('JÃ¡ existe um usuÃ¡rio com este email');
    }

    // Hash da senha do admin
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Cria o tenant e o usuÃ¡rio admin em uma transaÃ§Ã£o
    return this.prisma.$transaction(async (prisma) => {
      // Cria o tenant
      const tenant = await prisma.tenant.create({
        data: {
          email,
          cnpjCpf,
          nomeFantasia,
          nomeResponsavel,
          telefone,
        },
      });

      // Cria o usuÃ¡rio admin do tenant
      await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName,
          role: Role.ADMIN,
          tenantId: tenant.id,
        },
      });

      // Buscar todos os mÃ³dulos ativos do sistema
      const activeModules = await prisma.module.findMany({
        where: { isActive: true },
      });

      // Vincular mÃ³dulos ao novo tenant (DESABILITADOS por padrÃ£o)
      // Cada tenant deve ativar os mÃ³dulos que deseja usar
      if (activeModules.length > 0) {
        await prisma.tenantModule.createMany({
          data: activeModules.map((module) => ({
            tenantId: tenant.id,
            moduleName: module.name,
            isActive: false, // âœ… MÃ³dulos desabilitados por padrÃ£o
            // Config Ã© null - cada tenant configura individualmente
          })),
        });
      }

      return tenant;
    });
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    // Verifica se o tenant existe
    await this.findOne(id);

    // Se estÃ¡ atualizando email ou CNPJ, verifica duplicaÃ§Ã£o
    if (updateTenantDto.email || updateTenantDto.cnpjCpf) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateTenantDto.email ? { email: updateTenantDto.email } : {},
                updateTenantDto.cnpjCpf ? { cnpjCpf: updateTenantDto.cnpjCpf } : {},
              ],
            },
          ],
        },
      });

      if (existingTenant) {
        throw new ConflictException('JÃ¡ existe uma empresa com este email ou CNPJ/CPF');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });
  }

  async toggleStatus(id: string) {
    const tenant = await this.findOne(id);

    // Bloqueia a desativaÃ§Ã£o da empresa padrÃ£o (Empresa Exemplo LTDA)
    if (tenant.email === 'empresa1@example.com' && tenant.ativo) {
      throw new BadRequestException('A empresa padrÃ£o do sistema nÃ£o pode ser desativada');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ativo: !tenant.ativo,
      },
    });
  }

  async changeAdminPassword(id: string, changePasswordDto: { newPassword: string }) {
    // Verifica se o tenant existe
    await this.findOne(id);

    // Busca o usuÃ¡rio admin do tenant
    const admin = await this.prisma.user.findFirst({
      where: {
        tenantId: id,
        role: Role.ADMIN,
      },
    });

    if (!admin) {
      throw new NotFoundException('Administrador do tenant nÃ£o encontrado');
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Atualiza a senha
    await this.prisma.user.update({
      where: { id: admin.id },
      data: { password: hashedPassword },
    });

    return { message: 'Senha alterada com sucesso' };
  }

  async updateLogo(id: string, filename: string) {
    const tenant = await this.findOne(id);

    // Remove o logo antigo se existir
    if (tenant.logoUrl) {
      try {
        const oldLogoPath = join(process.cwd(), 'uploads', 'logos', tenant.logoUrl);
        await unlink(oldLogoPath);
      } catch (error) {
        // Ignora erro se o arquivo nÃ£o existir
      }
    }

    // Atualiza com o novo logo
    return this.prisma.tenant.update({
      where: { id },
      data: { logoUrl: filename },
    });
  }

  async removeLogo(id: string) {
    const tenant = await this.findOne(id);

    if (!tenant.logoUrl) {
      throw new BadRequestException('Esta empresa nÃ£o possui logo');
    }

    // Remove o arquivo fÃ­sico
    try {
      const logoPath = join(process.cwd(), 'uploads', 'logos', tenant.logoUrl);
      await unlink(logoPath);
    } catch (error) {
      // Ignora erro se o arquivo nÃ£o existir
    }

    // Remove a referÃªncia do banco
    return this.prisma.tenant.update({
      where: { id },
      data: { logoUrl: null },
    });
  }

  async remove(id: string) {
    const tenant = await this.findOne(id);

    // NÃ£o permite deletar a empresa padrÃ£o
    if (tenant.email === 'empresa1@example.com') {
      throw new BadRequestException('A empresa padrÃ£o do sistema nÃ£o pode ser deletada');
    }

    // Verifica se hÃ¡ usuÃ¡rios vinculados
    const usersCount = await this.prisma.user.count({
      where: { tenantId: id },
    });

    if (usersCount > 0) {
      throw new BadRequestException(
        `NÃ£o Ã© possÃ­vel deletar esta empresa pois existem ${usersCount} usuÃ¡rio(s) vinculado(s). Delete os usuÃ¡rios primeiro.`,
      );
    }

    // Remove o logo se existir
    if (tenant.logoUrl) {
      try {
        const logoPath = join(process.cwd(), 'uploads', 'logos', tenant.logoUrl);
        await unlink(logoPath);
      } catch (error) {
        // Ignora erro se o arquivo nÃ£o existir
      }
    }

    // Deleta a empresa
    await this.prisma.tenant.delete({
      where: { id },
    });

    return { message: 'Empresa deletada com sucesso' };
  }

  async getMasterLogo() {
    // Busca a empresa padrÃ£o ou a primeira empresa
    const masterTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { email: 'empresa1@example.com' },
          { ativo: true },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        logoUrl: true,
        nomeFantasia: true,
      },
    });

    return {
      logoUrl: masterTenant?.logoUrl || null,
      nomeFantasia: masterTenant?.nomeFantasia || 'Sistema',
    };
  }

  async getTenantLogo(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        logoUrl: true,
        nomeFantasia: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Empresa nÃ£o encontrada');
    }

    return {
      logoUrl: tenant.logoUrl || null,
      nomeFantasia: tenant.nomeFantasia,
    };
  }

  // MÃ©todos para gerenciamento de mÃ³dulos dos tenants

  async getTenantActiveModules(tenantId: string) {
    // Verifica se o tenant existe
    await this.findOne(tenantId);

    // Buscar todos os mÃ³dulos disponÃ­veis no sistema
    const allModules = await this.prisma.module.findMany({
      where: { isActive: true },
    });

    // Buscar relaÃ§Ãµes do tenant com os mÃ³dulos (ativas e inativas)
    const tenantModules = await this.prisma.tenantModule.findMany({
      where: { tenantId },
      include: { module: true },
    });

    // Criar mapa de status dos mÃ³dulos do tenant
    const tenantModuleStatus = new Map();
    tenantModules.forEach(tm => {
      tenantModuleStatus.set(tm.moduleName, {
        isActive: tm.isActive,
        config: tm.config,
        activatedAt: tm.activatedAt,
        deactivatedAt: tm.deactivatedAt,
      });
    });

    // Montar lista completa de mÃ³dulos com status
    const modules = allModules.map(module => {
      const tenantStatus = tenantModuleStatus.get(module.name);
      const isActive = tenantStatus ? tenantStatus.isActive : false;
      
      return {
        name: module.name,
        displayName: module.displayName,
        description: module.description,
        version: module.version,
        isActive: isActive,
        config: tenantStatus?.config ? JSON.parse(tenantStatus.config) : (module.config ? JSON.parse(module.config) : null),
        activatedAt: tenantStatus?.activatedAt || null,
        deactivatedAt: tenantStatus?.deactivatedAt || null,
      };
    });

    // Lista apenas dos mÃ³dulos ativos (para compatibilidade)
    const activeModules = modules.filter(m => m.isActive).map(m => m.name);

    return {
      activeModules,
      modules,
    };
  }

  async activateModuleForTenant(tenantId: string, moduleName: string) {
    // Verifica se o tenant existe
    await this.findOne(tenantId);

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
      // Se jÃ¡ estÃ¡ ativo, retorna o registro atual sem erro
      if (existingTenantModule.isActive) {
        return existingTenantModule;
      }

      // Reativar mÃ³dulo
      return this.prisma.tenantModule.update({
        where: { id: existingTenantModule.id },
        data: {
          isActive: true,
          activatedAt: new Date(),
          deactivatedAt: null,
        },
      });
    }

    // Criar nova relaÃ§Ã£o
    return this.prisma.tenantModule.create({
      data: {
        tenantId,
        moduleName,
        isActive: true,
      },
    });
  }

  async deactivateModuleForTenant(tenantId: string, moduleName: string) {
    // Verifica se o tenant existe
    await this.findOne(tenantId);

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

    // Se jÃ¡ estÃ¡ desativado, retorna o registro atual sem erro
    if (!tenantModule.isActive) {
      return tenantModule;
    }

    return this.prisma.tenantModule.update({
      where: { id: tenantModule.id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });
  }

  async toggleModuleForTenant(tenantId: string, moduleName: string) {
    // Verifica se o tenant existe
    await this.findOne(tenantId);

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
      // Toggle: se estÃ¡ ativo, desativa; se estÃ¡ inativo, ativa
      const newStatus = !existingTenantModule.isActive;
      
      return this.prisma.tenantModule.update({
        where: { id: existingTenantModule.id },
        data: {
          isActive: newStatus,
          activatedAt: newStatus ? new Date() : existingTenantModule.activatedAt,
          deactivatedAt: newStatus ? null : new Date(),
        },
      });
    }

    // Se nÃ£o existe relaÃ§Ã£o, cria uma nova ativa
    return this.prisma.tenantModule.create({
      data: {
        tenantId,
        moduleName,
        isActive: true,
      },
    });
  }

  async configureTenantModule(tenantId: string, moduleName: string, config: any) {
    // Verifica se o tenant existe
    await this.findOne(tenantId);

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

