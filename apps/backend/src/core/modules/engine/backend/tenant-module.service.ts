import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { ModuleStatus } from '@prisma/client';
import { CronService } from '@core/cron/cron.service';

@Injectable()
export class TenantModuleService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cronService: CronService
    ) { }

    private async countActiveTenantsForModule(moduleId: string): Promise<number> {
        return this.prisma.moduleTenant.count({
            where: {
                moduleId,
                enabled: true
            }
        });
    }

    /**
     * Verifica se um módulo está ativo para um tenant específico
     */
    async isModuleActiveForTenant(moduleName: string, tenantId: string): Promise<boolean> {
        const module = await this.prisma.module.findUnique({
            where: { slug: moduleName },
            include: {
                tenantModules: {
                    where: { tenantId }
                }
            }
        });

        if (!module) {
            return false;
        }

        const tenantModule = module.tenantModules[0];
        return tenantModule?.enabled || false;
    }

    /**
     * Ativa um módulo para um tenant específico
     * REGRA: Só permite ativar se o módulo estiver com status 'active' no sistema
     */
    async activateModuleForTenant(moduleName: string, tenantId: string): Promise<void> {
        // 1. Verificar se o módulo existe e está ativo no sistema
        const module = await this.prisma.module.findUnique({
            where: { slug: moduleName }
        });

        if (!module) {
            throw new NotFoundException(`Módulo ${moduleName} não encontrado`);
        }

        if (module.status !== ModuleStatus.active) {
            throw new BadRequestException(
                `Módulo ${moduleName} não está ativo no sistema. ` +
                `Status atual: ${module.status}. ` +
                `Ative o módulo em /configuracoes/sistema/modulos primeiro.`
            );
        }

        // 2. Verificar se o tenant existe
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) {
            throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
        }

        // 3. Criar ou atualizar registro na tabela ModuleTenant
        await this.prisma.moduleTenant.upsert({
            where: {
                moduleId_tenantId: {
                    moduleId: module.id,
                    tenantId: tenantId
                }
            },
            create: {
                moduleId: module.id,
                tenantId: tenantId,
                enabled: true
            },
            update: {
                enabled: true
            }
        });
    }

    /**
     * Desativa um módulo para um tenant específico
     */
    async deactivateModuleForTenant(moduleName: string, tenantId: string): Promise<void> {
        // 1. Verificar se o módulo existe
        const module = await this.prisma.module.findUnique({
            where: { slug: moduleName }
        });

        if (!module) {
            throw new NotFoundException(`Módulo ${moduleName} não encontrado`);
        }

        // 2. Atualizar registro na tabela ModuleTenant
        const tenantModule = await this.prisma.moduleTenant.findUnique({
            where: {
                moduleId_tenantId: {
                    moduleId: module.id,
                    tenantId: tenantId
                }
            }
        });

        if (!tenantModule) {
            // Se não existe registro, não há nada para desativar
            return;
        }

        // Atualizar para disabled
        await this.prisma.moduleTenant.update({
            where: {
                moduleId_tenantId: {
                    moduleId: module.id,
                    tenantId: tenantId
                }
            },
            data: {
                enabled: false
            }
        });

        // Parar crons relacionados ao módulo e tenant
        // Parar crons relacionados ao módulo e tenant
        // 1. Tenta parar crons ESPECÍFICOS deste tenant
        await this.cronService.stopJobsForModule(moduleName, tenantId);

        // 2. Verifica se este era o ÚLTIMO tenant ativo para este módulo
        const activeCount = await this.countActiveTenantsForModule(module.id);

        if (activeCount === 0) {
            // Se ninguém mais usa, podemos parar os crons GLOBAIS do módulo
            await this.cronService.stopJobsForModule(moduleName);
        }
    }

    /**
     * Lista módulos ativos para um tenant
     */
    async getActiveModulesForTenant(tenantId: string): Promise<string[]> {
        const tenantModules = await this.prisma.moduleTenant.findMany({
            where: {
                tenantId,
                enabled: true
            },
            include: {
                module: true
            }
        });

        return tenantModules.map(tm => tm.module.slug);
    }

    /**
     * Lista todos os módulos disponíveis para um tenant
     * (inclui status de ativação)
     */
    async getModulesForTenant(tenantId: string) {
        // Buscar todos os módulos com status 'active' no sistema
        const modules = await this.prisma.module.findMany({
            where: {
                status: ModuleStatus.active
            },
            include: {
                tenantModules: {
                    where: { tenantId }
                }
            }
        });

        return modules.map(module => ({
            slug: module.slug,
            name: module.name,
            description: module.description,
            version: module.version,
            enabled: module.tenantModules[0]?.enabled || false
        }));
    }

    /**
     * Ativa módulo (alias para activateModuleForTenant)
     */
    async enableModule(tenantId: string, moduleSlug: string): Promise<boolean> {
        await this.activateModuleForTenant(moduleSlug, tenantId);
        return true;
    }

    /**
     * Desativa módulo (alias para deactivateModuleForTenant)
     */
    async disableModule(tenantId: string, moduleSlug: string): Promise<boolean> {
        await this.deactivateModuleForTenant(moduleSlug, tenantId);
        return true;
    }
}
