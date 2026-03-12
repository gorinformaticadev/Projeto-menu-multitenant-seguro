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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { ExecuteUpdateDto, UpdateConfigDto } from './dto/update.dto';
import { UpdateService } from './update.service';

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
  async getStatus() {
    try {
      return await this.updateService.getUpdateStatus();
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao buscar status de atualizações');
    }
  }

  @Get('config')
  @Roles(Role.SUPER_ADMIN)
  async getConfig() {
    try {
      return await this.updateService.getUpdateConfig();
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao buscar configurações');
    }
  }

  @Get('check')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async checkForUpdates(@Request() _req) {
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
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async executeUpdate(@Body() updateData: ExecuteUpdateDto, @Request() req) {
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
  async updateConfig(@Body() config: UpdateConfigDto, @Request() req) {
    try {
      const userId = req.user.sub;
      return await this.updateService.updateConfig(config, userId);
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao atualizar configurações');
    }
  }

  @Get('logs')
  @Roles(Role.SUPER_ADMIN)
  async getLogs(@Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 50;
      if (limitNum > 200) {
        throw new HttpException('Limite máximo de 200 registros', HttpStatus.BAD_REQUEST);
      }

      const logs = await this.updateService.getUpdateLogs(limitNum);
      return {
        success: true,
        data: logs,
        total: logs.length,
      };
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao buscar logs de atualização');
    }
  }

  @Get('logs/:id')
  @Roles(Role.SUPER_ADMIN)
  async getLogDetails(@Param('id') logId: string) {
    try {
      const log = await this.updateService.getUpdateLogDetails(logId);
      return {
        success: true,
        data: log,
      };
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao buscar detalhes do log');
    }
  }

  @Get('test-connection')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async testConnection() {
    try {
      const result = await this.updateService.checkForUpdates();
      return {
        success: true,
        message: 'Conexão com repositório estabelecida com sucesso',
        connected: true,
        ...result,
      };
    } catch {
      return {
        success: false,
        message: 'Falha na conexão com o repositório',
        connected: false,
      };
    }
  }
}
