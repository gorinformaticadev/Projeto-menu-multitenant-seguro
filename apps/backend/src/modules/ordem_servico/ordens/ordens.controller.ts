import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, Logger, BadRequestException, NotFoundException, ForbiddenException, UseInterceptors, UploadedFile, Res, HttpException, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { OrdensService } from './ordens.service';
import { PermissionGuard } from '../shared/guards/permission.guard';
import { RequireOrdersPermission } from '../shared/decorators/require-permission.decorator';
import {
    assertTenantUploadAccess,
    ORDEM_SERVICO_UPLOAD_OPTIONS,
    persistTenantUpload,
    resolveTenantUploadPath,
} from '../shared/utils/upload-security.util';
import {
    CreateOrdemServicoDTO,
    UpdateOrdemServicoDTO,
    OrdemServicoFilters,
    UpdateStatusDTO,
    OrdemServicoListResponseDTO,
    OrdemServicoResponseDTO,
    DashboardDataResponseDTO,
    TipoServicoResponseDTO,
    TipoEquipamentoResponseDTO,
    TechnicianResponseDTO,
    HistoricoResponseDTO,
    UploadResponseDTO,
    DeleteResponseDTO,
    // Novos DTOs para retirada e abandono
    RetiradaDTO,
    PagamentoResponseDTO,
    AlertaAbandonoDTO,
    AnexoAbandonoDTO,
    AlertaAbandonoResponseDTO,
    MarcarAbandonadoDTO,
    ConservacaoCalculoResponseDTO,
    AtualizarConservacaoDTO,
    StatusHistoricoResponseDTO,
    AlertaRetiradaResponseDTO
} from '../shared/dto/ordem-servico.dto';

@Controller('ordem_servico/ordens')
@UseGuards(JwtAuthGuard)
export class OrdensController {
    private readonly logger = new Logger(OrdensController.name);

    constructor(private readonly ordensService: OrdensService) {
        console.log('✅✅✅ ORDENS CONTROLLER INSTANCIADO (STANDALONE)!!! ✅✅✅');
    }

    @Get()
    async findAll(
        @Req() req: ExpressRequest & { user: any },
        @Query() filters: OrdemServicoFilters
    ): Promise<OrdemServicoListResponseDTO> {
        try {
            this.logger.log(`🎯 [Controller] INÍCIO - Buscando ordens. Tenant: ${req.user?.tenantId}`);

            const result = await this.ordensService.findAll(req.user.tenantId, filters);

            this.logger.log(`🎯 [Controller] Service retornou ${result.data.length} ordens`);
            this.logger.log(`🎯 [Controller] ANTES DE RETORNAR - Resultado OK`);

            return result;
        } catch (error) {
            this.logger.error(`❌ [Controller] ERRO CAPTURADO:`, error);
            this.logger.error(`❌ [Controller] Stack:`, error.stack);
            throw error;
        } finally {
            this.logger.log(`🎯 [Controller] FINALLY - Finalizando método`);
        }
    }

    @Get('dashboard')
    async getDashboardData(@Req() req: ExpressRequest & { user: any }): Promise<DashboardDataResponseDTO[]> {
        try {
            this.logger.log(`Buscando dados do dashboard. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getDashboardData(req.user.tenantId);
        } catch (error) {
            this.logger.error(`Erro ao buscar dados do dashboard:`, error);
            throw error;
        }
    }

    @Get('tipos-servico')
    async getTiposServico(@Req() req: ExpressRequest & { user: any }): Promise<TipoServicoResponseDTO[]> {
        try {
            this.logger.log(`Buscando tipos de serviço. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getTiposServico(req.user.tenantId);
        } catch (error) {
            this.logger.error(`Erro ao buscar tipos de serviço:`, error);
            throw error;
        }
    }

    @Get('tipos-equipamento')
    async getTiposEquipamento(@Req() req: ExpressRequest & { user: any }): Promise<TipoEquipamentoResponseDTO[]> {
        try {
            this.logger.log(`Buscando tipos de equipamento. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getTiposEquipamento(req.user.tenantId);
        } catch (error) {
            this.logger.error(`Erro ao buscar tipos de equipamento:`, error);
            throw error;
        }
    }

    @Get('technicians')
    async getTechnicians(@Req() req: ExpressRequest & { user: any }): Promise<TechnicianResponseDTO[]> {
        try {
            this.logger.log(`Buscando técnicos. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getTechnicians(req.user.tenantId);
        } catch (error) {
            this.logger.error(`Erro ao buscar técnicos:`, error);
            throw error;
        }
    }

    // IMPORTANTE: Rota estática DEVE vir antes de rotas com parâmetros (:id)
    @Get('alertas-retirada')
    async getAlertasRetirada(
        @Req() req: ExpressRequest & { user: any }
    ): Promise<AlertaRetiradaResponseDTO> {
        try {
            this.logger.log(`Buscando alertas de retirada. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getAlertasRetirada(req.user.tenantId);
        } catch (error) {
            this.logger.error(`Erro ao buscar alertas de retirada:`, error);
            throw error;
        }
    }

    @Get(':id')
    async findOne(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string
    ): Promise<OrdemServicoResponseDTO> {
        try {
            this.logger.log(`Buscando ordem de serviço ${id}. Tenant: ${req.user?.tenantId}`);
            const ordem = await this.ordensService.findOne(req.user.tenantId, id);

            if (!ordem) {
                throw new NotFoundException('Ordem de serviço não encontrada');
            }

            return ordem;
        } catch (error) {
            this.logger.error(`Erro ao buscar ordem de serviço ${id}:`, error);
            throw error;
        }
    }

    @Get(':id/historico')
    async getHistorico(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string
    ): Promise<HistoricoResponseDTO[]> {
        try {
            this.logger.log(`Buscando histórico da ordem ${id}. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getHistorico(req.user.tenantId, id);
        } catch (error) {
            this.logger.error(`Erro ao buscar histórico da ordem ${id}:`, error);
            throw error;
        }
    }

    @Get(':id/pdf')
    async downloadPdf(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string,
        @Res() res: Response
    ) {
        try {
            this.logger.log(`Solicitação de PDF para ordem ${id}. Tenant: ${req.user?.tenantId}`);

            const pdfBuffer = await this.ordensService.generatePdf(req.user.tenantId, id);

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="OS_${id}.pdf"`,
                'Content-Length': pdfBuffer.length,
            });

            res.send(pdfBuffer);
        } catch (error) {
            this.logger.error(`Erro ao gerar PDF da ordem ${id}:`, error);
            res.status(500).json({ message: 'Erro ao gerar PDF' });
        }
    }

    @Post()
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async create(
        @Req() req: ExpressRequest & { user: any },
        @Body() createDto: CreateOrdemServicoDTO
    ): Promise<OrdemServicoResponseDTO> {
        try {
            this.logger.log(`Criando nova ordem de serviço. Tenant: ${req.user?.tenantId}`);

            // Validar se o cliente está ativo
            const clienteAtivo = await this.ordensService.isClienteAtivo(req.user.tenantId, createDto.cliente_id);
            if (!clienteAtivo) {
                throw new BadRequestException('Cliente inativo não pode abrir ordem de serviço');
            }

            return await this.ordensService.create(req.user.tenantId, req.user.id, createDto);
        } catch (error) {
            this.logger.error(`Erro ao criar ordem de serviço:`, error);
            throw error;
        }
    }

    @Put(':id')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async update(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string,
        @Body() updateDto: UpdateOrdemServicoDTO
    ): Promise<OrdemServicoResponseDTO> {
        try {
            this.logger.log(`Atualizando ordem de serviço ${id}. Tenant: ${req.user?.tenantId}`);

            // Verificar se a ordem existe e pertence ao tenant
            const ordem = await this.ordensService.findOne(req.user.tenantId, id);
            if (!ordem) {
                throw new NotFoundException('Ordem de serviço não encontrada');
            }

            // Verificar se a ordem pode ser editada
            if (ordem.status === 6 || ordem.status === 7 || ordem.status === 8 || ordem.status === 9) { // FINALIZADA, CANCELADA, RETIRADO ou ABANDONADO
                throw new ForbiddenException('Ordem de serviço finalizada, cancelada, retirada ou abandonada não pode ser editada');
            }

            return await this.ordensService.update(req.user.tenantId, req.user.id, id, updateDto);
        } catch (error) {
            this.logger.error(`Erro ao atualizar ordem de serviço ${id}:`, error);
            throw error;
        }
    }

    @Put(':id/status')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async updateStatus(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string,
        @Body() body: UpdateStatusDTO
    ): Promise<OrdemServicoResponseDTO> {
        try {
            this.logger.log(`Atualizando status da ordem ${id} para ${body.status}. Tenant: ${req.user?.tenantId}`);

            // Verificar se a ordem existe
            const ordem = await this.ordensService.findOne(req.user.tenantId, id);
            if (!ordem) {
                throw new NotFoundException('Ordem de serviço não encontrada');
            }

            // Validar transição de status
            const transicaoValida = await this.ordensService.validarTransicaoStatus(ordem.status, body.status);
            if (!transicaoValida) {
                throw new BadRequestException(`Transição de status inválida: ${ordem.status} → ${body.status}`);
            }

            // Se for cancelamento, motivo é obrigatório
            if (body.status === 7 && !body.motivo_cancelamento) {
                throw new BadRequestException('Motivo do cancelamento é obrigatório');
            }

            // Se for finalização, validar se pode finalizar
            if (body.status === 6) {
                if (ordem.status !== 5) { // EM_EXECUCAO
                    throw new BadRequestException('Só é possível finalizar ordens em execução');
                }
                if (!ordem.valor_servico || ordem.valor_servico <= 0) {
                    throw new BadRequestException('Valor do serviço deve estar definido para finalizar');
                }
            }

            return await this.ordensService.updateStatus(
                req.user.tenantId,
                req.user.id,
                id,
                body.status,
                body.motivo_cancelamento,
                body.observacoes
            );
        } catch (error) {
            this.logger.error(`Erro ao atualizar status da ordem ${id}:`, error);
            throw error;
        }
    }

    @Delete(':id')
    async remove(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string
    ): Promise<DeleteResponseDTO> {
        try {
            this.logger.log(`Excluindo ordem de serviço ${id}. Tenant: ${req.user?.tenantId}`);

            // Verificar se a ordem existe
            const ordem = await this.ordensService.findOne(req.user.tenantId, id);
            if (!ordem) {
                throw new NotFoundException('Ordem de serviço não encontrada');
            }

            // Só permite excluir se for orçamento ou se for admin
            if (ordem.status !== 0 && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
                throw new ForbiddenException('Apenas orçamentos podem ser excluídos por usuários não-admin');
            }

            return await this.ordensService.remove(req.user.tenantId, req.user.id, id);
        } catch (error) {
            this.logger.error(`Erro ao excluir ordem de serviço ${id}:`, error);
            throw error;
        }
    }

    @Post(':id/aprovar-orcamento')
    async aprovarOrcamento(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string
    ): Promise<OrdemServicoResponseDTO> {
        try {
            this.logger.log(`Aprovando orçamento ${id}. Tenant: ${req.user?.tenantId}`);

            const ordem = await this.ordensService.findOne(req.user.tenantId, id);
            if (!ordem) {
                throw new NotFoundException('Ordem de serviço não encontrada');
            }

            if (ordem.status !== 0) { // ORCAMENTO
                throw new BadRequestException('Apenas orçamentos podem ser aprovados');
            }

            return await this.ordensService.aprovarOrcamento(req.user.tenantId, req.user.id, id);
        } catch (error) {
            this.logger.error(`Erro ao aprovar orçamento ${id}:`, error);
            throw error;
        }
    }

    @Post('upload')
    @UseGuards(PermissionGuard)
    @RequireOrdersPermission('edit')
    @UseInterceptors(FileInterceptor('file', ORDEM_SERVICO_UPLOAD_OPTIONS))
    async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: ExpressRequest & { user: any }): Promise<UploadResponseDTO> {
        try {
            if (!file) {
                throw new BadRequestException('Nenhum arquivo enviado');
            }

            // 1. Recuperação e Validação do Buffer
            const safeTenantId = String(req.user?.tenantId || '').trim();
            if (!safeTenantId) {
                throw new BadRequestException('Tenant invalido para upload');
            }

            const uploadRoot = path.resolve(process.cwd(), 'uploads', 'modules', 'ordem_servico', 'ordens');
            const persistedUpload = persistTenantUpload(uploadRoot, safeTenantId, file);
            return { url: `/api/ordem_servico/ordens/uploads/${safeTenantId}/${persistedUpload.fileName}` };

            let bufferData = file.buffer as any;

            if (bufferData && typeof bufferData === 'object' && !Buffer.isBuffer(bufferData)) {
                if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
                    bufferData = Buffer.from(bufferData.data);
                } else {
                    const values = Object.values(bufferData) as number[];
                    bufferData = Buffer.from(values);
                }
            }

            if ((!bufferData || !Buffer.isBuffer(bufferData)) && file.path) {
                bufferData = fs.readFileSync(file.path);
            }

            if (!Buffer.isBuffer(bufferData)) {
                throw new Error('Falha crítica: Buffer inválido.');
            }

            // 2. Caminho Seguro e Isolado por Tenant
            const tenantId = String(req.user?.tenantId || '').trim();
            if (!tenantId) {
                throw new BadRequestException('Tenant invalido para upload');
            }
            const uploadDir = path.resolve(process.cwd(), 'uploads', 'modules', 'ordem_servico', 'ordens', tenantId);

            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            // 3. Salvar Arquivo
            const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
            const filePath = path.join(uploadDir, uniqueName);
            fs.writeFileSync(filePath, bufferData);

            // 4. Retornar URL Pública
            return { url: `/api/ordem_servico/ordens/uploads/${tenantId}/${uniqueName}` };
        } catch (error: any) {
            this.logger.error('Erro no upload de foto do equipamento:', error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException('Erro ao processar upload: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('uploads/:tenantId/:filename')
    @UseGuards(PermissionGuard)
    @RequireOrdersPermission('view')
    async serveFile(
        @Param('filename') filename: string,
        @Param('tenantId') tenantId: string,
        @Req() req: ExpressRequest & { user: any },
        @Res() res: Response,
    ) {
        try {
            assertTenantUploadAccess(String(req.user?.tenantId || ''), tenantId);
            const uploadRoot = path.resolve(process.cwd(), 'uploads', 'modules', 'ordem_servico', 'ordens');
            const safeFilePath = resolveTenantUploadPath(uploadRoot, tenantId, filename);

            if (fs.existsSync(safeFilePath)) {
                res.setHeader('Cache-Control', 'private, max-age=300');
                res.sendFile(safeFilePath);
                return;
            }

            res.status(404).json({ message: 'Arquivo nÃ£o encontrado' });
            return;

            const filePath = path.resolve(process.cwd(), 'uploads', 'modules', 'ordem_servico', 'ordens', tenantId, filename);

            if (!filePath.startsWith(path.resolve(process.cwd(), 'uploads', 'modules', 'ordem_servico', 'ordens'))) {
                return res.status(403).json({ message: 'Acesso negado' });
            }

            if (fs.existsSync(filePath)) {
                res.setHeader('Cache-Control', 'private, max-age=300');
                res.sendFile(filePath);
            } else {
                res.status(404).json({ message: 'Arquivo não encontrado' });
            }
        } catch (error) {
            this.logger.error('Erro ao servir arquivo:', error);
            if (error instanceof HttpException) {
                throw error;
            }
            res.status(500).json({ message: 'Erro interno ao buscar imagem' });
        }
    }

    // ============================================
    // ENDPOINTS DE HISTÓRICO DE STATUS
    // ============================================

    @Get(':id/status-historico')
    async getStatusHistorico(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string
    ): Promise<StatusHistoricoResponseDTO[]> {
        try {
            this.logger.log(`Buscando histórico de status da ordem ${id}. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getStatusHistorico(req.user.tenantId, id);
        } catch (error) {
            this.logger.error(`Erro ao buscar histórico de status da ordem ${id}:`, error);
            throw error;
        }
    }

    // ============================================
    // ENDPOINTS DE CONSERVAÇÃO
    // ============================================

    @Get(':id/conservacao')
    async getConservacao(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string
    ): Promise<ConservacaoCalculoResponseDTO> {
        try {
            this.logger.log(`Calculando conservação da ordem ${id}. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.calcularConservacao(req.user.tenantId, id);
        } catch (error) {
            this.logger.error(`Erro ao calcular conservação da ordem ${id}:`, error);
            throw error;
        }
    }

    @Put(':id/conservacao')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async atualizarConservacao(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string,
        @Body() body: AtualizarConservacaoDTO
    ) {
        try {
            this.logger.log(`Atualizando conservação da ordem ${id}. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.atualizarConservacao(
                req.user.tenantId,
                req.user.id,
                id,
                body.valor_conservacao || 0,
                body.justificativa_conservacao
            );
        } catch (error) {
            this.logger.error(`Erro ao atualizar conservação da ordem ${id}:`, error);
            throw error;
        }
    }

    // ============================================
    // ENDPOINTS DE RETIRADA E PAGAMENTOS
    // ============================================

    @Get(':id/pagamentos')
    async getPagamentos(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string
    ): Promise<PagamentoResponseDTO[]> {
        try {
            this.logger.log(`Buscando pagamentos da ordem ${id}. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getPagamentos(req.user.tenantId, id);
        } catch (error) {
            this.logger.error(`Erro ao buscar pagamentos da ordem ${id}:`, error);
            throw error;
        }
    }

    @Post(':id/retirada')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async registrarRetirada(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string,
        @Body() body: RetiradaDTO
    ): Promise<OrdemServicoResponseDTO> {
        try {
            this.logger.log(`Registrando retirada da ordem ${id}. Tenant: ${req.user?.tenantId}`);

            // Verificar se a ordem existe
            const ordem = await this.ordensService.findOne(req.user.tenantId, id);
            if (!ordem) {
                throw new NotFoundException('Ordem de serviço não encontrada');
            }

            // Verificar se a ordem está finalizada
            if (ordem.status !== 6) {
                throw new BadRequestException('Só é possível registrar retirada de ordens finalizadas');
            }

            return await this.ordensService.registrarRetirada(req.user.tenantId, req.user.id, id, body);
        } catch (error) {
            this.logger.error(`Erro ao registrar retirada da ordem ${id}:`, error);
            throw error;
        }
    }

    // ============================================
    // ENDPOINTS DE ALERTAS DE ABANDONO
    // ============================================

    @Get(':id/alertas-abandono')
    async getAlertasAbandono(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string
    ): Promise<AlertaAbandonoResponseDTO[]> {
        try {
            this.logger.log(`Buscando alertas de abandono da ordem ${id}. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.getAlertasAbandono(req.user.tenantId, id);
        } catch (error) {
            this.logger.error(`Erro ao buscar alertas de abandono da ordem ${id}:`, error);
            throw error;
        }
    }

    @Post(':id/alertas-abandono')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async registrarAlertaAbandono(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string,
        @Body() body: AlertaAbandonoDTO
    ): Promise<AlertaAbandonoResponseDTO> {
        try {
            this.logger.log(`Registrando alerta de abandono para ordem ${id}. Tenant: ${req.user?.tenantId}`);

            // Verificar se a ordem existe
            const ordem = await this.ordensService.findOne(req.user.tenantId, id);
            if (!ordem) {
                throw new NotFoundException('Ordem de serviço não encontrada');
            }

            // Verificar se a ordem está finalizada
            if (ordem.status !== 6) {
                throw new BadRequestException('Só é possível registrar alertas para ordens finalizadas');
            }

            return await this.ordensService.registrarAlertaAbandono(req.user.tenantId, req.user.id, id, body);
        } catch (error) {
            this.logger.error(`Erro ao registrar alerta de abandono da ordem ${id}:`, error);
            throw error;
        }
    }

    @Post(':id/alertas-abandono/:alertaId/anexos')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async registrarAnexoAlerta(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string,
        @Param('alertaId') alertaId: string,
        @Body() body: AnexoAbandonoDTO
    ) {
        try {
            this.logger.log(`Registrando anexo para alerta ${alertaId}. Tenant: ${req.user?.tenantId}`);
            return await this.ordensService.registrarAnexoAlerta(req.user.tenantId, req.user.id, alertaId, body);
        } catch (error) {
            this.logger.error(`Erro ao registrar anexo do alerta ${alertaId}:`, error);
            throw error;
        }
    }

    @Post(':id/marcar-abandonado')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async marcarComoAbandonado(
        @Req() req: ExpressRequest & { user: any },
        @Param('id') id: string,
        @Body() body: MarcarAbandonadoDTO
    ): Promise<OrdemServicoResponseDTO> {
        try {
            this.logger.log(`Marcando ordem ${id} como abandonada. Tenant: ${req.user?.tenantId}`);

            // Verificar se a ordem existe
            const ordem = await this.ordensService.findOne(req.user.tenantId, id);
            if (!ordem) {
                throw new NotFoundException('Ordem de serviço não encontrada');
            }

            // Verificar se a ordem está finalizada
            if (ordem.status !== 6) {
                throw new BadRequestException('Só é possível marcar como abandonado ordens finalizadas');
            }

            return await this.ordensService.marcarComoAbandonado(req.user.tenantId, req.user.id, id, body.observacoes);
        } catch (error) {
            this.logger.error(`Erro ao marcar ordem ${id} como abandonada:`, error);
            throw error;
        }
    }
}
