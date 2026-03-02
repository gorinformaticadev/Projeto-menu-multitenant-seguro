import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

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
            // Usar 'slug' pois é o campo único no modelo
            const module = await this.prisma.module.findUnique({
                where: { slug },
                include: {
                    tenantModules: tenantId ? {
                        where: { tenantId }
                    } : false
                }
            });

            if (!module) {
                this.logger.warn(`Módulo não encontrado: ${slug}`);
                return false;
            }

            // Verificar status do módulo usando string direta pois o enum não está disponível
            if (module.status !== 'active') {
                this.logger.warn(`Módulo ${slug} não está ativo (status: ${module.status})`);
                return false;
            }

            // Se tenantId fornecido, verificar se está habilitado para o tenant
            if (tenantId && (!module.tenantModules || module.tenantModules.length === 0 || !module.tenantModules[0]?.enabled)) {
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
            const _modulePath = `modules/${slug}`;

            const moduleJsonPath = path.join(process.cwd(), _modulePath, 'module.json');
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
            const hasBackend = fs.existsSync(path.join(process.cwd(), _modulePath, 'backend'));
            const hasFrontend = fs.existsSync(path.join(process.cwd(), _modulePath, 'frontend'));

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
     * Lista módulos disponíveis para um tenant, filtrados por permissão de usuário
     */
    async getAvailableModules(tenantId: string, userRole?: string): Promise<any[]> {
        try {
            const modules = await this.prisma.module.findMany({
                where: {
                    status: {
                        in: ['active', 'installed', 'db_ready']
                    }
                },
                include: {
                    tenantModules: {
                        where: { tenantId }
                    },
                    menus: {
                        orderBy: { order: 'asc' }
                    }
                }
            });

            // Mapear e filtrar módulos
            return modules.reduce((acc, module) => {
                const enabled = module.tenantModules.length > 0 ? module.tenantModules[0]?.enabled : false;

                // 1. Filtro básico: habilitado para o tenant?
                if (!enabled) return acc;

                // 2. Filtro de Segurança por Role (Hard Security)
                // Se algum menu do módulo exige 'admin' e o usuário não é, remove o módulo inteiro ou apenas os menus restritos?
                // Decisão: Filtrar os MENUS. Se sobrar 0 menus e o módulo for "visual", remove o módulo.

                const menuTree = this.buildMenuTree(module.menus);

                // HOTFIX DE SEGURANÇA:
                // Forçar a permissão 'admin' para o módulo de integrações em tempo de execução
                if (module.slug === 'integracoes') {
                    // Aplica recursivamente a permissão de admin
                    const applyAdminPermission = (items: any[]) => {
                        items.forEach(item => {
                            // Se não tiver permissão definida, ou se não for admin, IMPÔR admin
                            if (!item.permission || !item.permission.includes('admin')) {
                                item.permission = 'integracoes.admin';
                            }
                            if (item.children) applyAdminPermission(item.children);
                        });
                    };
                    applyAdminPermission(menuTree);
                }

                // Filtra menus recursivamente baseado na role
                // console.warn(`🔒 [ModuleSecurity] Filtrando módulo ${module.slug} para role: ${userRole}`);
                const filteredMenus = this.filterMenusByRole(menuTree, userRole);
                // console.warn(`🔒 [ModuleSecurity] Menus filtrados: ${filteredMenus.length} (Original: ${menuTree.length})`);

                // Se o módulo tem menus, mas todos foram proibidos, não retornamos o módulo para o frontend
                if (module.menus.length > 0 && filteredMenus.length === 0) {
                    console.warn(`⛔ [ModuleSecurity] Módulo ${module.slug} totalmente ocultado por permissão.`);
                    return acc;
                }

                acc.push({
                    slug: module.slug,
                    name: module.name,
                    description: module.description,
                    version: module.version,
                    enabled: enabled,
                    menus: filteredMenus,
                    // Meta informações
                    hasBackend: module.hasBackend,
                    hasFrontend: module.hasFrontend
                });

                return acc;
            }, []);

        } catch (error) {
            // Tratamento robusto de erros de schema
            if (error instanceof Error) {
                // ... (logs de erro mantidos iguais) ...
                this.logger.error(`Error listing modules: ${error.message}`);
            }
            return [];
        }
    }

    private filterMenusByRole(menus: any[], role?: string): any[] {
        return menus.filter(menu => {
            // Regra: Se permissão contiver 'admin', e usuário não for ADMIN/SUPER_ADMIN, tchau.
            if (menu.permission && menu.permission.includes('admin') && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
                return false;
            }

            // Filtrar filhos recursivamente
            if (menu.children && menu.children.length > 0) {
                menu.children = this.filterMenusByRole(menu.children, role);
                // Se matou todos os filhos e o pai não tem rota própria, talvez matar o pai? 
                // Por enquanto mantemos o pai se ele passar na regra dele.
            }

            return true;
        });
    }

    /**
     * Constrói árvore hierárquica de menus
     */
    private buildMenuTree(menus: any[]): any[] {
        // Separar menus pai (sem parentId) e filhos
        const parentMenus = menus.filter(m => !m.parentId);
        const childMenus = menus.filter(m => m.parentId);

        // Mapear menus pai e adicionar filhos
        return parentMenus.map(parent => ({
            id: parent.id,
            label: parent.label,
            icon: parent.icon,
            route: parent.route,
            order: parent.order,
            permission: parent.permission,
            children: childMenus
                .filter(child => child.parentId === parent.id)
                .map(child => ({
                    id: child.id,
                    label: child.label,
                    icon: child.icon,
                    route: child.route,
                    order: child.order,
                    permission: child.permission
                }))
        }));
    }
}
