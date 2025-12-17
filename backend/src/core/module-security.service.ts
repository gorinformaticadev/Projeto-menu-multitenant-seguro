import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ModuleStatus } from '@prisma/client';

/**
 * Serviço de Segurança para Módulos
 * Garante que apenas módulos autorizados executem código
 */
@Injectable()
export class ModuleSecurityService {
    private readonly logger = new Logger(ModuleSecurityService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Valida se um módulo pode ser executado
     */
    async canExecuteModule(slug: string, tenantId?: string): Promise<boolean> {
        try {
            const module = await this.prisma.module.findUnique({
                where: { slug },
                include: {
                    tenantModules: tenantId ? {
                        where: { tenantId, enabled: true }
                    } : false
                }
            });

            if (!module) {
                this.logger.warn(`Módulo não encontrado: ${slug}`);
                return false;
            }

            // Verificar status do módulo
            if (module.status !== ModuleStatus.active) {
                this.logger.warn(`Módulo ${slug} não está ativo (status: ${module.status})`);
                return false;
            }

            // Se tenantId fornecido, verificar se está habilitado para o tenant
            if (tenantId && (!module.tenantModules || module.tenantModules.length === 0)) {
                this.logger.warn(`Módulo ${slug} não habilitado para tenant ${tenantId}`);
                return false;
            }

            return true;

        } catch (error) {
            this.logger.error(`Erro ao validar módulo ${slug}:`, error);
            return false;
        }
    }

    /**
     * Valida estrutura de um módulo antes da instalação
     */
    async validateModuleStructure(slug: string): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];

        try {
            const modulePath = `modules/${slug}`;

            // Verificar se existe module.json
            const fs = require('fs');
            const path = require('path');

            const moduleJsonPath = path.join(process.cwd(), modulePath, 'module.json');
            if (!fs.existsSync(moduleJsonPath)) {
                errors.push('module.json não encontrado');
                return { valid: false, errors };
            }

            // Validar conteúdo do module.json
            const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf-8'));

            if (!moduleJson.name || typeof moduleJson.name !== 'string') {
                errors.push('Campo "name" obrigatório no module.json');
            }

            if (!moduleJson.version || typeof moduleJson.version !== 'string') {
                errors.push('Campo "version" obrigatório no module.json');
            }

            // Verificar estrutura de pastas
            const hasBackend = fs.existsSync(path.join(process.cwd(), modulePath, 'backend'));
            const hasFrontend = fs.existsSync(path.join(process.cwd(), modulePath, 'frontend'));

            if (!hasBackend && !hasFrontend) {
                errors.push('Módulo deve ter pelo menos backend ou frontend');
            }

            return { valid: errors.length === 0, errors };

        } catch (error) {
            errors.push(`Erro ao validar estrutura: ${error.message}`);
            return { valid: false, errors };
        }
    }

    /**
     * Registra execução de módulo para auditoria
     */
    async logModuleExecution(slug: string, action: string, userId?: string, tenantId?: string) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    action: `MODULE_${action.toUpperCase()}`,
                    userId,
                    tenantId,
                    details: JSON.stringify({ module: slug }),
                    ipAddress: 'system', // TODO: capturar IP real quando disponível
                    userAgent: 'ModuleLoader'
                }
            });
        } catch (error) {
            this.logger.error(`Erro ao logar execução do módulo ${slug}:`, error);
        }
    }

    /**
     * Verifica se usuário tem permissão para gerenciar módulos
     */
    async canManageModules(userId: string): Promise<boolean> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true }
            });

            return user?.role === 'SUPER_ADMIN';

        } catch (error) {
            this.logger.error(`Erro ao verificar permissões do usuário ${userId}:`, error);
            return false;
        }
    }

    /**
     * Lista módulos disponíveis para um tenant
     */
    async getAvailableModules(tenantId: string): Promise<any[]> {
        try {
            const modules = await this.prisma.module.findMany({
                where: { status: ModuleStatus.active },
                include: {
                    tenantModules: {
                        where: { tenantId }
                    },
                    menus: {
                        where: { isUserMenu: true },
                        orderBy: { order: 'asc' }
                    }
                }
            });

            return modules.map(module => ({
                slug: module.slug,
                name: module.name,
                description: module.description,
                enabled: module.tenantModules.length > 0 && module.tenantModules[0].enabled,
                menus: module.menus.map(menu => ({
                    label: menu.label,
                    icon: menu.icon,
                    route: menu.route,
                    children: [] // TODO: implementar hierarquia
                }))
            }));

        } catch (error) {
            this.logger.error(`Erro ao listar módulos para tenant ${tenantId}:`, error);
            return [];
        }
    }
}