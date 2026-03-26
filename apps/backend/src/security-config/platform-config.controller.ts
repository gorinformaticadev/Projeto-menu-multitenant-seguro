import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformConfigService } from './platform-config.service';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Public } from '@core/common/decorators/public.decorator';
import { Role } from '@prisma/client';
import { IsString, IsOptional } from 'class-validator';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';
import {
  PlatformConfigResponseDto,
  PlatformNameResponseDto,
  PlatformEmailResponseDto,
  PlatformPhoneResponseDto,
} from './dto/platform-config-response.dto';

type AuthenticatedRequest = { user: { id: string; [key: string]: unknown } };

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

@Controller('platform-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) { }

  /**
   * GET /platform-config
   * Obter configurações da plataforma
   * Público para inicialização do frontend (Login Page etc)
   */
  @Public()
  @Get()
  @ValidateResponse(PlatformConfigResponseDto)
  async getPlatformConfig(): Promise<PlatformConfigResponseDto> {
    return this.platformConfigService.getPlatformConfig() as any;
  }

  /**
   * PUT /platform-config
   * Atualizar configurações da plataforma
   * Apenas SUPER_ADMIN
   */
  @Put()
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ValidateResponse(PlatformConfigResponseDto)
  async updatePlatformConfig(
    @Body() dto: UpdatePlatformConfigDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PlatformConfigResponseDto> {
    return this.platformConfigService.updatePlatformConfig(
      dto.platformName,
      dto.platformEmail,
      dto.platformPhone,
      req.user.id
    ) as any;
  }

  /**
   * GET /platform-config/name
   * Obter apenas o nome da plataforma
   * Público (sem autenticação) para uso em templates
   */
  @Public()
  @Get('name')
  @ValidateResponse(PlatformNameResponseDto)
  async getPlatformName(): Promise<PlatformNameResponseDto> {
    return {
      platformName: await this.platformConfigService.getPlatformName()
    };
  }

  /**
   * GET /platform-config/email
   * Obter apenas o email da plataforma
   * Público (sem autenticação) para uso em templates
   */
  @Public()
  @Get('email')
  @ValidateResponse(PlatformEmailResponseDto)
  async getPlatformEmail(): Promise<PlatformEmailResponseDto> {
    return {
      platformEmail: await this.platformConfigService.getPlatformEmail()
    };
  }

  /**
   * GET /platform-config/phone
   * Obter apenas o telefone da plataforma
   * Público (sem autenticação) para uso em templates
   */
  @Public()
  @Get('phone')
  @ValidateResponse(PlatformPhoneResponseDto)
  async getPlatformPhone(): Promise<PlatformPhoneResponseDto> {
    return {
      platformPhone: await this.platformConfigService.getPlatformPhone()
    };
  }
}
