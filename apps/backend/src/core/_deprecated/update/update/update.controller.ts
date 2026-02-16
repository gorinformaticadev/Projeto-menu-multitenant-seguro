// DEPRECATED: nao utilizado pelo AppModule.
// Controller ativo de updates: apps/backend/src/update/update.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateService } from './update.service';
import { ExecuteUpdateDto, UpdateConfigDto } from './dto/update.dto';
import { Throttle } from '@nestjs/throttler';

/**
 * Controller do Sistema de AtualizaÃ§Ãµes
 * 
 * Endpoints protegidos para gerenciar atualizaÃ§Ãµes do sistema:
 * - VerificaÃ§Ã£o de status e versÃµes disponÃ­veis
 * - ExecuÃ§Ã£o de atualizaÃ§Ãµes (apenas SUPER_ADMIN)
 * - ConfiguraÃ§Ã£o do sistema de updates
 * - Consulta de logs e auditoria
 */
@Controller('api/update')
@UseGuards(JwtAuthGuard)
export class UpdateController {
  constructor(private updateService: UpdateService) {
      // Empty implementation
    }

  /**
   * GET /api/update/status
   * Retorna status atual do sistema de atualizaÃ§Ãµes
   * AcessÃ­vel para usuÃ¡rios autenticados
   */
  @Get('status')
  async getStatus() {
    try {
      return await this.updateService.getUpdateStatus();
    } catch (error) {
      throw new HttpException(
        'Erro ao buscar status de atualizaÃ§Ãµes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/update/check
   * ForÃ§a verificaÃ§Ã£o de novas versÃµes no repositÃ³rio
   * Apenas SUPER_ADMIN pode executar
   */
  @Get('check')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // MÃ¡ximo 10 verificaÃ§Ãµes por minuto
  async checkForUpdates(@Request() req) {
    try {
      const result = await this.updateService.checkForUpdates();
      
      return {
        success: true,
        message: result.updateAvailable 
          ? `Nova versÃ£o disponÃ­vel: ${result.availableVersion}`
          : 'Sistema estÃ¡ atualizado',
        ...result,
      };
    } catch (error) {
      throw new HttpException(
        'Erro ao verificar atualizaÃ§Ãµes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/update/execute
   * Executa atualizaÃ§Ã£o para versÃ£o especificada
   * Apenas SUPER_ADMIN pode executar
   */
  @Post('execute')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // MÃ¡ximo 3 atualizaÃ§Ãµes por hora
  async executeUpdate(
    @Body() updateData: ExecuteUpdateDto,
    @Request() req,
  ) {
    try {
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await this.updateService.executeUpdate(
        updateData,
        userId,
        ipAddress,
        userAgent,
      );

      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao executar atualizaÃ§Ã£o',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/update/config
   * Atualiza configuraÃ§Ãµes do sistema de updates
   * Apenas SUPER_ADMIN pode executar
   */
  @Put('config')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async updateConfig(
    @Body() config: UpdateConfigDto,
    @Request() req,
  ) {
    try {
      const userId = req.user.sub;
      
      const result = await this.updateService.updateConfig(config, userId);
      
      return result;
    } catch (error) {
      throw new HttpException(
        'Erro ao atualizar configuraÃ§Ãµes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/update/logs
   * Retorna histÃ³rico de atualizaÃ§Ãµes
   * Apenas SUPER_ADMIN pode acessar
   */
  @Get('logs')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getLogs(@Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 50;
      
      if (limitNum > 200) {
        throw new HttpException(
          'Limite mÃ¡ximo de 200 registros',
          HttpStatus.BAD_REQUEST,
        );
      }

      const logs = await this.updateService.getUpdateLogs(limitNum);
      
      return {
        success: true,
        data: logs,
        total: logs.length,
      };
    } catch (error) {
      throw new HttpException(
        'Erro ao buscar logs de atualizaÃ§Ã£o',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/update/logs/:id
   * Retorna detalhes de uma atualizaÃ§Ã£o especÃ­fica
   * Apenas SUPER_ADMIN pode acessar
   */
  @Get('logs/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getLogDetails(@Param('id') logId: string) {
    try {
      const log = await this.updateService.getUpdateLogDetails(logId);
      
      return {
        success: true,
        data: log,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao buscar detalhes do log',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/update/test-connection
   * Testa conectividade com o repositÃ³rio Git
   * Apenas SUPER_ADMIN pode executar
   */
  @Get('test-connection')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // MÃ¡ximo 5 testes por minuto
  async testConnection() {
    try {
      // Tenta verificar atualizaÃ§Ãµes para testar conectividade
      const result = await this.updateService.checkForUpdates();
      
      return {
        success: true,
        message: 'ConexÃ£o com repositÃ³rio estabelecida com sucesso',
        connected: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Falha na conexÃ£o com o repositÃ³rio',
        connected: false,
        error: error.message,
      };
    }
  }
}
