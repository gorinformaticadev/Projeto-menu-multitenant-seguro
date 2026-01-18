import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';
import { PrismaService } from './prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { ModuleJsonValidator, ModuleJson } from './validators/module-json.validator';
import { ModuleStructureValidator, ModuleStructureResult } from './validators/module-structure.validator';
import { ModuleDatabaseExecutorService } from './services/module-database-executor.service';

/**
 * Serviço de Instalação de Módulos - DISTRIBUTED
 * Gerencia upload, instalação (frontend/backend distribuídos), ativação e migrations.
 * 
 * ESTRUTURA:
 * - Frontend: apps/frontend/src/app/modules/{slug} (páginas e lógica de UI)
 * - Backend: apps/backend/modules/{slug} (controllers, services, entities)
 */
@Injectable()
export class ModuleInstallerService {
    private readonly logger = new Logger(ModuleInstallerService.name);

    // Caminhos definidos conforme especificação do monorepo
    private readonly backendModulesPath = path.resolve(process.cwd(), 'src', 'modules');
    private readonly frontendBase = path.resolve(process.cwd(), '..', 'frontend', 'src', 'app', 'modules');
    private readonly uploadsPath = path.resolve(process.cwd(), 'uploads', 'modules');

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly dbExecutor: ModuleDatabaseExecutorService
    ) {
        this.ensureDirectories();
    }

    /**
     * Lista todos os módulos com status
     */
    async listModules() {
        const modules = await this.prisma.module.findMany({
            include: {
                _count: {
                    select: {
                        tenantModules: true,
                        migrations: true,
                        menus: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        return modules.map(module => ({
            slug: module.slug,
            name: module.name,
            version: module.version,
            description: module.description,
            status: module.status,
            hasBackend: module.hasBackend,
            hasFrontend: module.hasFrontend,
            installedAt: module.installedAt,
            activatedAt: module.activatedAt,
            stats: {
                tenants: module._count.tenantModules,
                migrations: module._count.migrations,
                menus: module._count.menus
            }
        }));
    }

    /**
     * Instala módulo a partir de arquivo ZIP
     */
    async installModuleFromZip(file: Express.Multer.File) {
        this.logger.log('🚀 Iniciando instalação de módulo distribuída...');

        // Variáveis para rollback
        let moduleNameForRollback: string | null = null;
        let filesDistributed = false;

        try {
            // 1. Preparar Buffer
            const bufferToWrite = this.prepareFileBuffer(file);

            // 2. Analisar
            const structure = ModuleStructureValidator.analyzeZipStructure(bufferToWrite);

            // 3. Validar JSON
            const moduleJsonData = JSON.parse(structure.moduleJsonContent);
            const validatedModule = ModuleJsonValidator.validate(moduleJsonData);

            moduleNameForRollback = validatedModule.name;

            // 4. Validar Nome Seguro
            ModuleJsonValidator.validateSafeName(validatedModule.name);

            // 5. Verificar Existência
            const existingModule = await this.prisma.module.findUnique({
                where: { slug: validatedModule.name }
            });

            if (existingModule) {
                this.logger.log(`⚠️ Módulo ${validatedModule.name} já existe - realizando limpeza total para reinstalação.`);
                await this.uninstallPhysicalFiles(validatedModule.name);
                await this.prisma.module.delete({ where: { slug: validatedModule.name } });
            }

            // 6. Distribuir Arquivos
            this.logger.log('6. Distribuindo arquivos...');
            await this.distributeModuleFiles(bufferToWrite, structure, validatedModule.name);
            filesDistributed = true;

            // 7. Registrar no Banco
            this.logger.log('7. Registrando no banco...');
            const module = await this.registerModuleInDatabase(validatedModule, structure, validatedModule.name);

            // 8. Menus
            if (validatedModule.menus?.length) {
                this.logger.log('8. Registrando menus...');
                await this.registerModuleMenus(module.id, validatedModule.menus);
            }

            // 9. Notificar
            await this.notifyModuleInstalled(validatedModule);
            this.logger.log('✅ Instalação concluída com sucesso.');

            return {
                success: true,
                module: {
                    name: validatedModule.name,
                    displayName: validatedModule.displayName,
                    version: validatedModule.version,
                    status: 'installed'
                },
                message: 'Módulo instalado com sucesso.'
            };

        } catch (error) {
            this.logger.error('❌ Erro ao instalar módulo:', error);

            // AUTO-ROLLBACK
            if (moduleNameForRollback && filesDistributed) {
                this.logger.warn(`🔄 Executando ROLLBACK para módulo ${moduleNameForRollback}...`);
                try {
                    await this.uninstallPhysicalFiles(moduleNameForRollback);
                    // Tenta remover registro se foi criado
                    await this.prisma.module.deleteMany({ where: { slug: moduleNameForRollback } });
                    this.logger.warn('✅ Rollback concluído: Arquivos e registros limpos.');
                } catch (rollbackError) {
                    this.logger.error('❌ Falha crítica no Rollback:', rollbackError);
                }
            }

            throw error;
        }
    }

    private prepareFileBuffer(file: Express.Multer.File): Buffer {
        if (Buffer.isBuffer(file.buffer)) return file.buffer;
        if (file.buffer && typeof file.buffer === 'object') {
            return Buffer.from(Object.values(file.buffer) as number[]);
        }
        throw new BadRequestException('Buffer inválido');
    }

    private async distributeModuleFiles(
        zipBuffer: Buffer,
        structure: ModuleStructureResult,
        moduleSlug: string
    ): Promise<void> {
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();

        const frontendDest = path.join(this.frontendBase, moduleSlug);
        const backendDest = path.join(this.backendModulesPath, moduleSlug);

        if (!fs.existsSync(this.frontendBase)) fs.mkdirSync(this.frontendBase, { recursive: true });
        if (!fs.existsSync(this.backendModulesPath)) fs.mkdirSync(this.backendModulesPath, { recursive: true });

        for (const entry of entries) {
            if (entry.isDirectory) continue;

            let relativePath = entry.entryName;
            if (structure.basePath) {
                const basePathWithSlash = structure.basePath + '/';
                if (relativePath.startsWith(basePathWithSlash)) {
                    relativePath = relativePath.substring(basePathWithSlash.length);
                } else {
                    continue;
                }
            }

            if (!relativePath || relativePath.trim() === '') continue;
            if (relativePath.includes('..')) continue;

            let targetPath = '';
            const _data = entry.getData();

            // Lógica de Distribuição Atualizada - PRESERVANDO ESTRUTURA
            if (relativePath.startsWith('frontend/')) {
                // Remove o prefixo 'frontend/' e mantém a hierarquia completa
                // Ex: frontend/pages/dashboard/page.tsx -> modules/{slug}/pages/dashboard/page.tsx
                const inner = relativePath.substring('frontend/'.length);
                if (inner.trim() !== '') {
                    targetPath = path.join(frontendDest, inner);
                }
            } else if (relativePath.startsWith('backend/')) {
                // Backend
                const inner = relativePath.substring('backend/'.length);
                targetPath = path.join(backendDest, inner);
            } else if (!relativePath.includes('/')) {
                // Raiz (module.json)
                targetPath = path.join(backendDest, relativePath);
            }

            if (targetPath) {
                const tDir = path.dirname(targetPath);
                if (!fs.existsSync(tDir)) fs.mkdirSync(tDir, { recursive: true });
                fs.writeFileSync(targetPath, _data);
            }
        }
    }

    private async uninstallPhysicalFiles(slug: string): Promise<void> {
        const frontendPath = path.join(this.frontendBase, slug);
        const backendPath = path.join(this.backendModulesPath, slug);

        await this.robustRemoveDir(frontendPath);
        await this.robustRemoveDir(backendPath);
    }

    private async robustRemoveDir(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) return;
        return new Promise((resolve) => {
            fs.rm(dirPath, { recursive: true, force: true }, () => resolve());
        });
    }

    private async registerModuleInDatabase(moduleJson: ModuleJson, structure: ModuleStructureResult, slug: string) {
        return await this.prisma.module.create({
            data: {
                slug,
                name: moduleJson.displayName,
                version: moduleJson.version,
                description: moduleJson.description || '',
                status: 'installed',
                hasBackend: structure.hasBackend,
                hasFrontend: structure.hasFrontend,
                installedAt: new Date()
            }
        });
    }

    private async notifyModuleInstalled(moduleJson: ModuleJson) {
        await this.notificationService.create({
            title: 'Módulo Instalado',
            description: `Módulo ${moduleJson.displayName} instalado.`,
            type: 'success',
            metadata: { module: moduleJson.name, action: 'installed' }
        });
    }

    async activateModule(slug: string) {
        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        if (module.status !== 'db_ready' && module.status !== 'disabled') {
            const hasMigrations = fs.existsSync(path.join(this.backendModulesPath, slug, 'migrations'));
            if (hasMigrations && module.status === 'installed') {
                throw new BadRequestException('Execute migrations antes de ativar.');
            }
        }

        await this.prisma.module.update({
            where: { slug },
            data: { status: 'active', activatedAt: new Date() }
        });

        await this.notificationService.create({
            title: 'Módulo Ativado',
            description: `Módulo ${module.name} ativado.`,
            type: 'success',
            metadata: { module: slug, action: 'activated' }
        });

        return { success: true, message: `Módulo ${slug} ativado` };
    }

    async deactivateModule(slug: string) {
        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        await this.prisma.module.update({
            where: { slug },
            data: { status: 'disabled', activatedAt: null }
        });

        return { success: true, message: `Módulo ${slug} desativado` };
    }

    async runModuleMigrations(slug: string) {
        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const _modulePath = path.join(this.backendModulesPath, slug);
        const count = await this.executeMigrations(slug, modulePath, 'migration');

        return { success: true, count, message: 'Migrações executadas com sucesso' };
    }

    async runModuleSeeds(slug: string) {
        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const _modulePath = path.join(this.backendModulesPath, slug);
        const count = await this.executeMigrations(slug, modulePath, 'seed');

        await this.prisma.module.update({
            where: { slug },
            data: { status: 'db_ready' }
        });

        return { success: true, count, message: 'Seeds executados com sucesso' };
    }

    async updateModuleDatabase(slug: string) {
        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const _modulePath = path.join(this.backendModulesPath, slug);
        const migs = await this.executeMigrations(slug, modulePath, 'migration');
        const seeds = await this.executeMigrations(slug, modulePath, 'seed');

        await this.prisma.module.update({
            where: { slug },
            data: { status: 'db_ready' }
        });

        return { success: true, executed: { migrations: migs, seeds }, message: 'Database atualizado' };
    }

    async reloadModuleConfig(slug: string) {
        this.logger.log(`🔄 Recarregando configurações do módulo: ${slug}`);

        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const _modulePath = path.join(this.backendModulesPath, slug);

        // Tentar module.json primeiro, depois module.config.json
        let moduleJsonPath = path.join(modulePath, 'module.json');
        if (!fs.existsSync(moduleJsonPath)) {
            moduleJsonPath = path.join(modulePath, 'module.config.json');
        }

        if (!fs.existsSync(moduleJsonPath)) {
            throw new BadRequestException(`module.json ou module.config.json não encontrado em: ${modulePath}`);
        }

        try {
            const moduleJsonContent = fs.readFileSync(moduleJsonPath, 'utf-8');
            const moduleJsonData = JSON.parse(moduleJsonContent);
            const validatedModule = ModuleJsonValidator.validate(moduleJsonData);

            if (validatedModule.name !== slug) {
                throw new BadRequestException(`Slug do module.json (${validatedModule.name}) difere do módulo instalado (${slug})`);
            }

            await this.prisma.module.update({
                where: { slug },
                data: {
                    name: validatedModule.displayName,
                    version: validatedModule.version,
                    description: validatedModule.description || '',
                    updatedAt: new Date()
                }
            });

            await this.prisma.$transaction(async (tx) => {
                await (tx as any).moduleMenu.deleteMany({
                    where: { moduleId: module.id }
                });

                if (validatedModule.menus && validatedModule.menus.length > 0) {
                    for (const menu of validatedModule.menus) {
                        await (tx as any).moduleMenu.create({
                            data: {
                                moduleId: module.id,
                                label: menu.label,
                                icon: menu.icon,
                                route: menu.route,
                                parentId: menu.parentId,
                                order: menu.order || 0,
                                permission: menu.permission,
                                isUserMenu: menu.isUserMenu !== false
                            }
                        });
                    }
                }
            });

            this.logger.log(`✅ Configurações do módulo ${slug} recarregadas com sucesso`);

            await this.notificationService.create({
                title: 'Módulo Atualizado',
                description: `Configurações do módulo ${validatedModule.displayName} foram recarregadas.`,
                type: 'info',
                metadata: { module: slug, action: 'reloaded' }
            });

            return {
                success: true,
                message: 'Configurações recarregadas com sucesso',
                module: {
                    name: validatedModule.name,
                    version: validatedModule.version,
                    menusCount: validatedModule.menus?.length || 0
                }
            };

        } catch (error) {
            this.logger.error(`❌ Erro ao recarregar módulo ${slug}:`, error);
            throw new BadRequestException(`Erro ao recarregar: ${error.message}`);
        }
    }

    /**
     * Executa novamente as migrations e seeds do módulo
     * Remove registros existentes e executa tudo novamente
     * VERSÃO MELHORADA: Executa uma migration por vez e para no primeiro erro
     */
    async runMigrationsAndSeeds(slug: string) {
        this.logger.log(`🔄 Executando migrations e seeds novamente para o módulo: ${slug}`);

        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const _modulePath = path.join(this.backendModulesPath, slug);
        if (!fs.existsSync(modulePath)) {
            throw new BadRequestException(`Módulo não encontrado no disco: ${modulePath}`);
        }

        try {
            // Remove registros de migrations e seeds existentes
            const deletedCount = await this.prisma.moduleMigration.deleteMany({
                where: { moduleId: module.id }
            });

            this.logger.log(`🗑️ ${deletedCount.count} registros de migrations/seeds removidos para ${slug}`);

            // Executa migrations novamente (uma por vez, parando no primeiro erro)
            const migrationsExecuted = await this.executeMigrationsOneByOne(slug, modulePath, 'migration');
            this.logger.log(`📊 ${migrationsExecuted} migrations executadas para ${slug}`);

            // Executa seeds novamente (uma por vez, parando no primeiro erro)
            const seedsExecuted = await this.executeMigrationsOneByOne(slug, modulePath, 'seed');
            this.logger.log(`🌱 ${seedsExecuted} seeds executados para ${slug}`);

            // Atualiza status do módulo para db_ready se necessário
            if (module.status === 'installed' && (migrationsExecuted > 0 || seedsExecuted > 0)) {
                await this.prisma.module.update({
                    where: { slug },
                    data: { status: 'db_ready' }
                });
                this.logger.log(`✅ Status do módulo ${slug} atualizado para db_ready`);
            }

            // Criar notificação
            await this.notificationService.create({
                title: 'Migrations e Seeds Executados',
                description: `Módulo ${module.name}: ${migrationsExecuted} migrations e ${seedsExecuted} seeds executados novamente.`,
                type: 'success',
                metadata: {
                    module: slug,
                    action: 'migrations-seeds-rerun',
                    migrationsExecuted,
                    seedsExecuted
                }
            });

            return {
                success: true,
                message: 'Migrations e seeds executados com sucesso',
                module: {
                    name: module.name,
                    slug: module.slug,
                    migrationsExecuted,
                    seedsExecuted
                }
            };

        } catch (error) {
            this.logger.error(`❌ Erro ao executar migrations/seeds para ${slug}:`, error);
            throw new BadRequestException(`Erro ao executar migrations/seeds: ${error.message}`);
        }
    }

    /**
     * Executa migrations uma por vez, parando no primeiro erro
     * Versão mais robusta que fornece informações detalhadas sobre falhas
     */
    private async executeMigrationsOneByOne(slug: string, modulePath: string, type: string): Promise<number> {
        const migrationsPath = path.join(modulePath, type === 'migration' ? 'migrations' : 'seeds');
        if (!fs.existsSync(migrationsPath)) {
            this.logger.log(`📁 Pasta ${type} não encontrada: ${migrationsPath}`);
            return 0;
        }

        const files = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql')).sort();
        this.logger.log(`📋 Encontrados ${files.length} arquivos ${type}: ${files.join(', ')}`);

        const moduleId = (await this.prisma.module.findUnique({ where: { slug } }))!.id;
        let executed = 0;

        for (const file of files) {
            this.logger.log(`🔍 Processando ${type}: ${file}`);

            const existing = await this.prisma.moduleMigration.findUnique({
                where: { moduleId_filename_type: { moduleId, filename: file, type: type as any } }
            });

            if (existing) {
                this.logger.log(`⏭️ ${type} ${file} já executada, pulando...`);
                continue;
            }

            try {
                this.logger.log(`🚀 Executando ${type}: ${file}`);
                const _filePath = path.join(migrationsPath, file);
                const sql = fs.readFileSync(filePath, 'utf-8');

                // Log do SQL para debug (apenas primeiras linhas)
                const sqlLines = sql.split('\n').filter(line => line.trim() && !line.trim().startsWith('--'));
                const sqlPreview = sqlLines.slice(0, 3).join('\n');
                this.logger.log(`📝 SQL Preview: ${sqlPreview}...`);

                // Executar SQL em transação
                await this.dbExecutor.executeInTransaction(sql);

                // Registrar execução
                await this.prisma.moduleMigration.create({
                    data: { moduleId, filename: file, type: type as any, executedAt: new Date() }
                });

                executed++;
                this.logger.log(`✅ ${type} ${file} executada com sucesso`);

            } catch (error) {
                this.logger.error(`❌ ERRO CRÍTICO ao executar ${type} ${file}:`, {
                    error: error.message,
                    file: file,
                    type: type,
                    module: slug
                });

                // Parar execução no primeiro erro e fornecer informações detalhadas
                throw new BadRequestException(
                    `Erro ao executar ${type} "${file}": ${error.message}. ` +
                    `Execução interrompida. ${executed} ${type}s foram executadas com sucesso antes do erro.`
                );
            }
        }

        this.logger.log(`📊 Total de ${type} executadas: ${executed}`);
        return executed;
    }

    async getModuleStatus(slug: string) {
        const module = await this.prisma.module.findUnique({
            where: { slug },
            include: {
                migrations: { orderBy: { executedAt: 'desc' } },
                menus: true,
                tenantModules: { include: { tenant: { select: { nomeFantasia: true } } } }
            }
        });
        if (!module) throw new BadRequestException('Módulo não encontrado');
        return { module, migrations: module.migrations, menus: module.menus };
    }

    async uninstallModule(slug: string, options: unknown) {
        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const confirmation = options.confirmationName || options;
        if (confirmation !== slug && options.confirmationName !== slug) {
            throw new BadRequestException('Nome de confirmação inválido');
        }

        await this.prisma.module.delete({ where: { slug } });
        await this.uninstallPhysicalFiles(slug);

        await this.notificationService.create({
            title: 'Módulo Desinstalado',
            description: `Módulo ${module.name} removido completamente.`,
            type: 'warning',
            metadata: { module: slug, action: 'uninstalled' }
        });

        return { success: true, message: 'Módulo desinstalado.' };
    }

    private async registerModuleMenus(moduleId: string, menus: unknown[]) {
        for (const menu of menus) {
            await this.prisma.moduleMenu.create({
                data: {
                    moduleId,
                    label: menu.label,
                    icon: menu.icon,
                    route: menu.route,
                    parentId: menu.parentId,
                    order: menu.order || 0,
                    permission: menu.permission,
                    isUserMenu: menu.isUserMenu !== false
                }
            });
        }
    }

    private async executeMigrations(slug: string, modulePath: string, type: string): Promise<number> {
        const migrationsPath = path.join(modulePath, type === 'migration' ? 'migrations' : 'seeds');
        if (!fs.existsSync(migrationsPath)) {
            this.logger.log(`📁 Pasta ${type} não encontrada: ${migrationsPath}`);
            return 0;
        }

        const files = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql')).sort();
        this.logger.log(`📋 Encontrados ${files.length} arquivos ${type}: ${files.join(', ')}`);

        const moduleId = (await this.prisma.module.findUnique({ where: { slug } }))!.id;
        let executed = 0;

        for (const file of files) {
            this.logger.log(`🔍 Verificando ${type}: ${file}`);

            const existing = await this.prisma.moduleMigration.findUnique({
                where: { moduleId_filename_type: { moduleId, filename: file, type: type as any } }
            });

            if (existing) {
                this.logger.log(`⏭️ ${type} ${file} já executada, pulando...`);
                continue;
            }

            try {
                this.logger.log(`🚀 Executando ${type}: ${file}`);
                const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf-8');

                // Log do SQL para debug (apenas primeiras linhas)
                const sqlPreview = sql.split('\n').slice(0, 5).join('\n');
                this.logger.log(`📝 SQL Preview: ${sqlPreview}...`);

                await this.dbExecutor.executeInTransaction(sql);

                await this.prisma.moduleMigration.create({
                    data: { moduleId, filename: file, type: type as any, executedAt: new Date() }
                });

                executed++;
                this.logger.log(`✅ ${type} ${file} executada com sucesso`);

            } catch (error) {
                this.logger.error(`❌ Erro ao executar ${type} ${file}:`, error);
                throw new BadRequestException(`Erro ao executar ${type} ${file}: ${error.message}`);
            }
        }

        this.logger.log(`📊 Total de ${type} executadas: ${executed}`);
        return executed;
    }

    private ensureDirectories() {
        if (!fs.existsSync(this.backendModulesPath)) fs.mkdirSync(this.backendModulesPath, { recursive: true });
        if (!fs.existsSync(this.uploadsPath)) fs.mkdirSync(this.uploadsPath, { recursive: true });
    }
}
