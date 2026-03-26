import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import {
  UpdateStatusDto,
  ExecuteUpdateDto,
  UpdateConfigDto,
  CheckUpdateResponseDto,
  UpdateLogDto,
  UpdateLogDetailsResponseDto,
  ConnectionTestResponseDto,
  ExecuteUpdateResponseDto,
} from './dto/update.dto';
import { UpdateService } from './update.service';
import { CriticalRateLimit } from '@common/decorators/critical-rate-limit.decorator';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';

@Controller('update')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class UpdateController {
  constructor(private updateService: UpdateService) {
    // Empty implementation
  }

  private rethrowPreservingHttp(error: unknown, fallbackMessage: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(fallbackMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Get('status')
  @ValidateResponse(UpdateStatusDto)
  async getStatus(): Promise<UpdateStatusDto> {
    try {
      return await this.updateService.getUpdateStatus();
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao buscar status de atualizações');
    }
  }

  @Get('config')
  @Roles(Role.SUPER_ADMIN)
  @ValidateResponse(UpdateConfigDto)
  async getConfig(): Promise<UpdateConfigDto> {
    try {
      return await this.updateService.getUpdateConfig();
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao buscar configurações');
    }
  }

  @Get('check')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ValidateResponse(CheckUpdateResponseDto)
  async checkForUpdates(@Request() _req): Promise<CheckUpdateResponseDto> {
    try {
      const result = await this.updateService.checkForUpdates();
      return {
        success: true,
        message: result.updateAvailable
          ? `Nova versão disponível: ${result.availableVersion}`
          : 'Sistema está atualizado',
        ...result,
      };
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao verificar atualizações');
    }
  }

  @Post('execute')
  @Roles(Role.SUPER_ADMIN)
  @CriticalRateLimit('update')
  @HttpCode(HttpStatus.ACCEPTED)
  @ValidateResponse(ExecuteUpdateResponseDto)
  async executeUpdate(@Body() updateData: ExecuteUpdateDto, @Request() req): Promise<ExecuteUpdateResponseDto> {
    try {
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      return await this.updateService.executeUpdate(updateData, userId, ipAddress, userAgent);
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao executar atualização');
    }
  }

  @Put('config')
  @Roles(Role.SUPER_ADMIN)
  @ValidateResponse(UpdateConfigDto)
  async updateConfig(@Body() config: UpdateConfigDto, @Request() req): Promise<UpdateConfigDto> {
    try {
      const userId = req.user.sub;
      return await this.updateService.updateConfig(config, userId);
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao atualizar configurações');
    }
  }

  @Get('logs')
  @Roles(Role.SUPER_ADMIN)
  @ValidateResponse(UpdateLogDto)
  async getLogs(): Promise<UpdateLogDto[]> {
    try {
      return await this.updateService.getUpdateLogs();
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao buscar logs');
    }
  }

  @Get('logs/:id')
  @Roles(Role.SUPER_ADMIN)
  @ValidateResponse(UpdateLogDetailsResponseDto)
  async getLogDetails(@Param('id') id: string): Promise<UpdateLogDetailsResponseDto> {
    try {
      const lines = await this.updateService.getLogDetails(id);
      return {
        lines,
        total: lines.length,
      };
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao buscar detalhes do log');
    }
  }

  @Post('test-connection')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ValidateResponse(ConnectionTestResponseDto)
  async testConnection(): Promise<ConnectionTestResponseDto> {
    try {
      const result = await this.updateService.testConnection();
      return {
        success: true,
        message: 'Conexão com repositório estabelecida com sucesso',
        ...result,
      };
    } catch {
      return {
        success: false,
        message: 'Falha na conexão com o repositório',
      };
    }
  }

  @Post('test-connection-payload')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ValidateResponse(ConnectionTestResponseDto)
  async testConnectionWithPayload(@Body() config: UpdateConfigDto): Promise<ConnectionTestResponseDto> {
    const result = await this.updateService.testConnection(config);
    return {
      success: result.connected,
      message: result.connected
        ? 'Conexão com repositório estabelecida com sucesso'
        : 'Falha na conexão com o repositório',
      details: result,
    };
  }
}
