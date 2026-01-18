import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import * as bcrypt from 'bcrypt';
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
    return (this.prisma as any).$transaction(async (prisma: any) => {
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
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      });

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
        role: 'ADMIN',
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

  async updateLogo(id: string, filename: string, userId?: string) {
    const tenant = await this.findOne(id);
    const oldLogoUrl = tenant.logoUrl;

    // Remove o logo antigo se existir
    if (tenant.logoUrl) {
      try {
        const oldLogoPath = join(process.cwd(), 'uploads', 'logos', tenant.logoUrl);
        await unlink(oldLogoPath);
      } catch (error) {
        // Ignora erro se o arquivo não existir
      }
    }

    // Atualiza com o novo logo
    const updatedTenant = await this.prisma.tenant.update({
      where: { id },
      data: { logoUrl: filename },
    });

    // Registra auditoria
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'TENANT_LOGO_UPLOADED',
          userId,
          tenantId: id,
          details: JSON.stringify({
            tenantName: tenant.nomeFantasia,
            oldLogo: oldLogoUrl,
            newLogo: filename,
          }),
        },
      });
    }

    return updatedTenant;
  }

  async removeLogo(id: string, userId?: string) {
    const tenant = await this.findOne(id);

    if (!tenant.logoUrl) {
      throw new BadRequestException('Esta empresa não possui logo');
    }

    const oldLogoUrl = tenant.logoUrl;

    // Remove o arquivo físico
    try {
      const logoPath = join(process.cwd(), 'uploads', 'logos', tenant.logoUrl);
      await unlink(logoPath);
    } catch (error) {
      // Ignora erro se o arquivo não existir
    }

    // Remove a referência do banco
    const updatedTenant = await this.prisma.tenant.update({
      where: { id },
      data: { logoUrl: null },
    });

    // Registra auditoria
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'TENANT_LOGO_REMOVED',
          userId,
          tenantId: id,
          details: JSON.stringify({
            tenantName: tenant.nomeFantasia,
            removedLogo: oldLogoUrl,
          }),
        },
      });
    }

    return updatedTenant;
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
    // Busca a empresa marcada como master (tenant principal da plataforma)
    const masterTenant = await this.prisma.tenant.findFirst({
      where: {
        isMasterTenant: true,
        ativo: true,
      },
      select: {
        logoUrl: true,
        nomeFantasia: true,
      },
    });

    // Fallback: se não houver master definido, usa a primeira ativa
    if (!masterTenant) {
      const fallbackTenant = await this.prisma.tenant.findFirst({
        where: { ativo: true },
        orderBy: { createdAt: 'asc' },
        select: {
          logoUrl: true,
          nomeFantasia: true,
        },
      });

      return {
        logoUrl: fallbackTenant?.logoUrl || null,
        nomeFantasia: fallbackTenant?.nomeFantasia || 'Sistema',
      };
    }

    return {
      logoUrl: masterTenant.logoUrl || null,
      nomeFantasia: masterTenant.nomeFantasia,
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
}

