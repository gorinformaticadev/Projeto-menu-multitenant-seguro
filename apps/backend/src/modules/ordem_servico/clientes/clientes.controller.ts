import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest, Response } from 'express';
import * as fs from 'fs';
import { Public } from '@core/common/decorators/public.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { ClientesService } from './clientes.service';
import { RequireClientsPermission } from '../shared/decorators/require-permission.decorator';
import { PermissionGuard } from '../shared/guards/permission.guard';
import {
  assertTenantUploadAccess,
  buildTenantModuleUploadUrl,
  ORDEM_SERVICO_UPLOAD_OPTIONS,
  persistTenantModuleUpload,
  resolveTenantModuleUploadPath,
} from '../shared/utils/upload-security.util';

@Controller('ordem_servico/clientes')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientesController {
  private readonly logger = new Logger(ClientesController.name);

  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @RequireClientsPermission('view')
  async findAll(@Query('search') search: string, @Req() req: ExpressRequest & { user: any }) {
    return this.clientesService.findAll(req.user?.tenantId, search);
  }

  @Get(':id')
  @RequireClientsPermission('view_details')
  async findOne(@Param('id') id: string, @Req() req: ExpressRequest & { user: any }) {
    const client = await this.clientesService.findById(req.user?.tenantId, id);
    if (!client) {
      throw new HttpException('Cliente nao encontrado', HttpStatus.NOT_FOUND);
    }

    return client;
  }

  @Post()
  @RequireClientsPermission('create')
  async create(@Body() data: any, @Req() req: ExpressRequest & { user: any }) {
    try {
      return await this.clientesService.create(req.user?.tenantId, data, req.user?.id);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  @RequireClientsPermission('edit')
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: ExpressRequest & { user: any },
  ) {
    try {
      return await this.clientesService.update(req.user?.tenantId, id, data, req.user?.id);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  @RequireClientsPermission('delete')
  async remove(@Param('id') id: string, @Req() req: ExpressRequest & { user: any }) {
    return this.clientesService.delete(req.user?.tenantId, id, req.user?.id);
  }

  @Post('upload')
  @RequireClientsPermission('upload_images')
  @UseInterceptors(FileInterceptor('file', ORDEM_SERVICO_UPLOAD_OPTIONS))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: ExpressRequest & { user: any }) {
    try {
      if (!file) {
        throw new BadRequestException('Nenhum arquivo enviado');
      }

      const tenantId = String(req.user?.tenantId || '').trim();
      const { fileName } = persistTenantModuleUpload('clientes', tenantId, file);

      return { url: buildTenantModuleUploadUrl('clientes', tenantId, fileName) };
    } catch (error) {
      this.logger.error('Erro no upload de foto do cliente', error as Error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Erro ao processar upload', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('uploads/:tenantId/:filename')
  @RequireClientsPermission('view_details')
  async serveFile(
    @Param('filename') filename: string,
    @Param('tenantId') tenantId: string,
    @Req() req: ExpressRequest & { user: any },
    @Res() res: Response,
  ) {
    try {
      assertTenantUploadAccess(String(req.user?.tenantId || ''), tenantId);
      const filePath = resolveTenantModuleUploadPath('clientes', tenantId, filename);

      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.sendFile(filePath);
        return;
      }

      res.status(404).json({ message: 'Arquivo nao encontrado' });
    } catch (error) {
      this.logger.error('Erro ao servir arquivo', error as Error);
      if (error instanceof HttpException) {
        throw error;
      }
      res.status(500).json({ message: 'Erro interno ao buscar imagem' });
    }
  }

  @Get('cep/:cep')
  @Public()
  async consultarCEP(@Param('cep') cep: string) {
    try {
      const cleanCEP = cep.replace(/\D/g, '');

      if (cleanCEP.length !== 8) {
        throw new HttpException('CEP deve ter 8 digitos', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Consultando CEP: ${cleanCEP}`);
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();

      if (data.erro) {
        throw new HttpException('CEP nao encontrado', HttpStatus.NOT_FOUND);
      }

      return {
        cep: data.cep,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        localidade: data.localidade || '',
        uf: data.uf || '',
        complemento: data.complemento || '',
        success: true,
      };
    } catch (error) {
      this.logger.error('Erro ao consultar CEP', error as Error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException('Erro interno ao consultar CEP', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
