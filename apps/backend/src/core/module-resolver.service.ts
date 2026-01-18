import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Module Resolver Service
 * 
 * Responsável por resolver módulos dinamicamente baseado APENAS no banco de dados.
 * NUNCA usa listas fixas ou imports estáticos.
 * 
 * Princípio: O BANCO É A ÚNICA FONTE DE VERDADE
 */
@Injectable()
export class ModuleResolverService {
    private readonly logger = new Logger(ModuleResolverService.name);
    // Caminho dos módulos de backend: apps/backend/modules
    private readonly modulesBasePath = path.resolve(process.cwd(), 'modules');
    // Caminho dos módulos de frontend: apps/frontend/src/app/modules
    private readonly frontendModulesPath = path.resolve(process.cwd(), '..', 'frontend', 'src', 'app', 'modules');

    constructor(private readonly prisma: PrismaService) {
        this.logger.log(`📂 Módulos base path (Backend): ${this.modulesBasePath}`);
    }

    /**
     * Resolve o caminho físico de um módulo baseado no slug
     * @param moduleSlug - Slug do módulo (ex: 'sistema', 'financeiro')
     * @returns Caminho absoluto do módulo ou null se não existir
     */
    resolveModulePath(moduleSlug: string): string | null {
        const _modulePath = path.join(this.modulesBasePath, moduleSlug);

        if (!fs.existsSync(modulePath)) {
            // this.logger.warn(`⚠️ Diretório do módulo não encontrado: ${modulePath}`);
            return null;
        }

        return modulePath;
    }

    /**
     * Verifica se um módulo está instalado e ativo para um tenant
     * @param moduleSlug - Slug do módulo
     * @param tenantId - ID do tenant
     * @returns true se o módulo está disponível para o tenant
     */
    async isModuleAvailableForTenant(moduleSlug: string, tenantId: string): Promise<boolean> {
        try {
            const module = await this.prisma.module.findUnique({
                where: { slug: moduleSlug },
                include: {
                    tenantModules: {
                        where: { tenantId }
                    }
                }
            });

            if (!module) {
                return false;
            }

            // Módulo deve estar ativo no sistema
            if (module.status !== 'active') {
                return false;
            }

            // Módulo deve estar habilitado para o tenant
            const tenantModule = module.tenantModules[0];
            if (!tenantModule || !tenantModule.enabled) {
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error(`Erro ao verificar disponibilidade do módulo ${moduleSlug}:`, error);
            return false;
        }
    }

    /**
     * Resolve o caminho de um componente frontend de um módulo
     * @param moduleSlug - Slug do módulo
     * @param componentPath - Caminho relativo do componente (ex: 'pages/ajustes')
     * @returns Caminho absoluto do componente ou null
     */
    resolveFrontendComponent(moduleSlug: string, componentPath: string): string | null {
        const moduleFrontendPath = path.join(this.frontendModulesPath, moduleSlug);

        if (!fs.existsSync(moduleFrontendPath)) {
            return null;
        }

        const fullPath = path.join(moduleFrontendPath, componentPath);

        const extensions = ['', '.tsx', '.ts', '.jsx', '.js'];
        for (const ext of extensions) {
            const tryPath = fullPath + ext;
            if (fs.existsSync(tryPath)) {
                return tryPath;
            }
        }

        for (const ext of extensions) {
            if (ext === '') continue;
            const indexPath = path.join(fullPath, 'index' + ext);
            if (fs.existsSync(indexPath)) {
                return indexPath;
            }
        }

        return null;
    }

    /**
     * Valida e desativa módulos cujo código-fonte não existe mais
     * @param moduleSlug - Slug do módulo
     */
    async validateAndDisableIfMissing(moduleSlug: string): Promise<void> {
        const _modulePath = this.resolveModulePath(moduleSlug);

        if (!modulePath) {
            this.logger.warn(`⚠️ Código-fonte do módulo ${moduleSlug} não encontrado. Desativando...`);

            try {
                await this.prisma.module.update({
                    where: { slug: moduleSlug },
                    data: { status: 'disabled' }
                });

                this.logger.log(`✅ Módulo ${moduleSlug} desativado automaticamente`);
            } catch (error) {
                this.logger.error(`Erro ao desativar módulo ${moduleSlug}:`, error);
            }
        }
    }

    /**
     * Lista todos os módulos instalados no sistema com seus caminhos
     * @returns Array de módulos com metadados de caminho
     */
    async listInstalledModulesWithPaths(): Promise<Array<{
        slug: string;
        name: string;
        status: string;
        path: string | null;
        exists: boolean;
    }>> {
        const modules = await this.prisma.module.findMany({
            where: {
                status: {
                    in: ['installed', 'db_ready', 'active']
                }
            }
        });

        return modules.map(module => {
            const _modulePath = this.resolveModulePath(module.slug);
            return {
                slug: module.slug,
                name: module.name,
                status: module.status,
                path: modulePath,
                exists: modulePath !== null
            };
        });
    }
}
