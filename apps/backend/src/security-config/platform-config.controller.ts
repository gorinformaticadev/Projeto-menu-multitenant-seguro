 import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';

import { SkipThrottle } from '@nestjs/throttler';
import { PlatformConfigService } from './platform-config.service';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { IsString, IsOptional } from 'class-validator';

export class UpdatePlatformConfigDto {
  @IsOptional()
  @IsString()
  platformName?: string;

  @IsOptional()
  @IsString()
  platformEmail?: string;

  @IsOptional()
  @IsString()
  platformPhone?: string;
}

@SkipThrottle()
@Controller('platform-config')
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {
      // Empty implementation
    }

  /**
   * GET /platform-config
   * Obter configurações da plataforma
   * Público para todos os usuários autenticados
   */
  @SkipThrottle()
  @Get()
  async getPlatformConfig() {
    return this.platformConfigService.getPlatformConfig();
  }

  /**
   * PUT /platform-config
   * Atualizar configurações da plataforma
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Put()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async updatePlatformConfig(
    @Body() dto: UpdatePlatformConfigDto,
    @Req() req: any,
  ) {
    return this.platformConfigService.updatePlatformConfig(
      dto.platformName,
      dto.platformEmail,
      dto.platformPhone,
      req.user.id
    );
  }

  /**
   * GET /platform-config/name
   * Obter apenas o nome da plataforma
   * Público (sem autenticação) para uso em templates
   */
  @SkipThrottle()
  @Get('name')
  async getPlatformName() {
    return {
      platformName: await this.platformConfigService.getPlatformName()
    };
  }

  /**
   * GET /platform-config/email
   * Obter apenas o email da plataforma
   * Público (sem autenticação) para uso em templates
   */
  @SkipThrottle()
  @Get('email')
  async getPlatformEmail() {
    return {
      platformEmail: await this.platformConfigService.getPlatformEmail()
    };
  }

  /**
   * GET /platform-config/phone
   * Obter apenas o telefone da plataforma
   * Público (sem autenticação) para uso em templates
   */
  @SkipThrottle()
  @Get('phone')
  async getPlatformPhone() {
    return {
      platformPhone: await this.platformConfigService.getPlatformPhone()
    };
  }
}
