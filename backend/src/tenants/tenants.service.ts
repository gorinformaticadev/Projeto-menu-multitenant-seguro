import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

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
      throw new NotFoundException('Empresa não encontrada');
    }

    return tenant;
  }

  async create(createTenantDto: CreateTenantDto) {
    const { email, cnpjCpf, nomeFantasia, nomeResponsavel, telefone, adminEmail, adminPassword, adminName } = createTenantDto;

    // Verifica se já existe tenant com o mesmo email ou CNPJ/CPF
    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ email }, { cnpjCpf }],
      },
    });

    if (existingTenant) {
      throw new ConflictException('Já existe uma empresa com este email ou CNPJ/CPF');
    }

    // Verifica se já existe usuário com o email do admin
    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      throw new ConflictException('Já existe um usuário com este email');
    }

    // Hash da senha do admin
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Cria o tenant e o usuário admin em uma transação
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

      // Cria o usuário admin do tenant
      await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName,
          role: Role.ADMIN,
          tenantId: tenant.id,
        },
      });

      return tenant;
    });
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    // Verifica se o tenant existe
    await this.findOne(id);

    // Se está atualizando email ou CNPJ, verifica duplicação
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
        throw new ConflictException('Já existe uma empresa com este email ou CNPJ/CPF');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });
  }

  async toggleStatus(id: string) {
    const tenant = await this.findOne(id);

    // Bloqueia a desativação da empresa padrão (Empresa Exemplo LTDA)
    if (tenant.email === 'empresa1@example.com' && tenant.ativo) {
      throw new BadRequestException('A empresa padrão do sistema não pode ser desativada');
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

    // Busca o usuário admin do tenant
    const admin = await this.prisma.user.findFirst({
      where: {
        tenantId: id,
        role: Role.ADMIN,
      },
    });

    if (!admin) {
      throw new NotFoundException('Administrador do tenant não encontrado');
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
        // Ignora erro se o arquivo não existir
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
      throw new BadRequestException('Esta empresa não possui logo');
    }

    // Remove o arquivo físico
    try {
      const logoPath = join(process.cwd(), 'uploads', 'logos', tenant.logoUrl);
      await unlink(logoPath);
    } catch (error) {
      // Ignora erro se o arquivo não existir
    }

    // Remove a referência do banco
    return this.prisma.tenant.update({
      where: { id },
      data: { logoUrl: null },
    });
  }
}
