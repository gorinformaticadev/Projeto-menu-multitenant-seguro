import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { PermissionService } from '../services/permission.service';

type PermissionRequestUser = {
  id: string;
  role: Role;
  tenantId?: string | null;
};

@Controller('ordem_servico/permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionController {
  private readonly logger = new Logger(PermissionController.name);

  constructor(private readonly permissionService: PermissionService) {}

  @Get('available')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getAvailablePermissions() {
    try {
      this.logger.log('Buscando permissoes disponiveis');
      return this.permissionService.getAvailablePermissions();
    } catch (error) {
      this.logger.error('Erro ao buscar permissoes disponiveis', error as Error);
      throw error;
    }
  }

  @Get('users')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getUsersWithPermissions(@Req() req: ExpressRequest & { user: PermissionRequestUser }) {
    try {
      this.logger.log(`Buscando usuarios com permissoes. Tenant: ${req.user?.tenantId}`);
      return await this.permissionService.getUsersWithPermissions(req.user.tenantId || '');
    } catch (error) {
      this.logger.error('Erro ao buscar usuarios com permissoes', error as Error);
      throw error;
    }
  }

  @Get('users/:userId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
  async getUserPermissions(
    @Req() req: ExpressRequest & { user: PermissionRequestUser },
    @Param('userId') userId: string,
  ) {
    try {
      if (
        req.user?.role !== Role.ADMIN &&
        req.user?.role !== Role.SUPER_ADMIN &&
        req.user?.id !== userId
      ) {
        throw new ForbiddenException('Voce so pode consultar as proprias permissoes');
      }

      this.logger.log(`Buscando permissoes do usuario ${userId}. Tenant: ${req.user?.tenantId}`);
      return await this.permissionService.getUserPermissions(req.user.tenantId || '', userId);
    } catch (error) {
      this.logger.error(`Erro ao buscar permissoes do usuario ${userId}`, error as Error);
      throw error;
    }
  }

  @Put('users/:userId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async updateUserPermissions(
    @Req() req: ExpressRequest & { user: PermissionRequestUser },
    @Param('userId') userId: string,
    @Body() body: { permissions: any[] },
  ) {
    try {
      this.logger.log(`Atualizando permissoes do usuario ${userId}. Tenant: ${req.user?.tenantId}`);
      await this.permissionService.updateUserPermissions(
        req.user.tenantId || '',
        userId,
        body.permissions || [],
        req.user.id,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(`Erro ao atualizar permissoes do usuario ${userId}`, error as Error);
      throw error;
    }
  }

  @Get('audit')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getPermissionAudit(
    @Req() req: ExpressRequest & { user: PermissionRequestUser },
    @Param('userId') userId?: string,
  ) {
    try {
      this.logger.log(`Buscando auditoria de permissoes. Tenant: ${req.user?.tenantId}`);
      return await this.permissionService.getPermissionAudit(req.user.tenantId || '', userId);
    } catch (error) {
      this.logger.error('Erro ao buscar auditoria de permissoes', error as Error);
      throw error;
    }
  }
}
