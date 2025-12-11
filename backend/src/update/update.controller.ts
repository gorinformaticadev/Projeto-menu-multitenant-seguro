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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateService } from './update.service';
import { ExecuteUpdateDto, UpdateConfigDto } from './dto/update.dto';
import { Throttle } from '@nestjs/throttler';

/**
 * Controller do Sistema de Atualizações
 * 
 * Endpoints protegidos para gerenciar atualizações do sistema:
 * - Verificação de status e versões disponíveis
 * - Execução de atualizações (apenas SUPER_ADMIN)
 * - Configuração do sistema de updates
 * - Consulta de logs e auditoria
 */
@Controller('api/update')
@UseGuards(JwtAuthGuard)
export class UpdateController {
  constructor(private updateService: UpdateService) {}

  /**
   * GET /api/update/status
   * Retorna status atual do sistema de atualizações
   * Acessível para usuários autenticados
   */
  @Get('status')
  async getStatus() {
    try {
      return await this.updateService.getUpdateStatus();
    } catch (error) {
      throw new HttpException(
        'Erro ao buscar status de atualizações',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/update/check
   * Força verificação de novas versões no repositório
   * Apenas SUPER_ADMIN pode executar
   */
  @Get('check')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Máximo 10 verificações por minuto
  async checkForUpdates(@Request() req) {
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
      throw new HttpException(
        'Erro ao verificar atualizações',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/update/execute
   * Executa atualização para versão especificada
   * Apenas SUPER_ADMIN pode executar
   */
  @Post('execute')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // Máximo 3 atualizações por hora
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
        error.message || 'Erro ao executar atualização',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/update/config
   * Atualiza configurações do sistema de updates
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
        'Erro ao atualizar configurações',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/update/logs
   * Retorna histórico de atualizações
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
          'Limite máximo de 200 registros',
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
        'Erro ao buscar logs de atualização',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/update/logs/:id
   * Retorna detalhes de uma atualização específica
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
   * Testa conectividade com o repositório Git
   * Apenas SUPER_ADMIN pode executar
   */
  @Get('test-connection')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Máximo 5 testes por minuto
  async testConnection() {
    try {
      // Tenta verificar atualizações para testar conectividade
      const result = await this.updateService.checkForUpdates();
      
      return {
        success: true,
        message: 'Conexão com repositório estabelecida com sucesso',
        connected: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Falha na conexão com o repositório',
        connected: false,
        error: error.message,
      };
    }
  }
}