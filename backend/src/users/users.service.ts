import { Injectable, ConflictException, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password, name, role, tenantId } = createUserDto;

    // Verifica se já existe usuário com o mesmo email
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Já existe um usuário com este email');
    }

    // Valida tenantId se não for SUPER_ADMIN
    if (role !== Role.SUPER_ADMIN && !tenantId) {
      throw new BadRequestException('TenantId é obrigatório para usuários que não são SUPER_ADMIN');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria o usuário
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        tenantId: role === Role.SUPER_ADMIN ? null : tenantId,
      },
      include: {
        tenant: true,
      },
    });

    // Remove a senha do retorno
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findAll(tenantId?: string) {
    const where = tenantId ? { tenantId } : {};

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
      },
    });

    // Remove password do retorno
    return users.map(({ password, ...user }) => user);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // Verifica se o usuário existe
    await this.findOne(id);

    // Se está atualizando email, verifica duplicação
    if (updateUserDto.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { email: updateUserDto.email },
          ],
        },
      });

      if (existingUser) {
        throw new ConflictException('Já existe um usuário com este email');
      }
    }

    // Se está atualizando senha, faz o hash
    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
      },
    });

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async remove(id: string) {
    // Verifica se o usuário existe
    const user = await this.findOne(id);

    // Não permite deletar o SUPER_ADMIN padrão
    if (user.email === 'admin@system.com') {
      throw new BadRequestException('O SUPER_ADMIN padrão não pode ser deletado');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'Usuário deletado com sucesso' };
  }

  async findByTenant(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(({ password, ...user }) => user);
  }

  /**
   * Alterar senha do usuário
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Buscar usuário com senha
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    // Verificar se a nova senha é diferente da atual
    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual');
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Senha alterada com sucesso' };
  }
}
