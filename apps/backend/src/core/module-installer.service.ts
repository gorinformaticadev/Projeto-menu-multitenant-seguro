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
     * Fonte da verdade: Banco de Dados
     * Verifica integridade física (pastas)
     */
    async listModules() {
        // 1. Buscar do Banco (Fonte da Verdade)
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

        // 2. Mapear e Verificar Integridade
        return modules.map(module => {
            let integrityStatus = 'ok';
            let integrityMessage = '';
            const missingFolders: string[] = [];

            // Verificar Backend
            if (module.hasBackend) {
                const backendPath = path.join(this.backendModulesPath, module.slug);
                if (!fs.existsSync(backendPath)) {
                    missingFolders.push('backend');
                }
            }

            // Verificar Frontend
            if (module.hasFrontend) {
                const frontendPath = path.join(this.frontendBase, module.slug);
                if (!fs.existsSync(frontendPath)) {
                    missingFolders.push('frontend');
                }
            }

            if (missingFolders.length > 0) {
                integrityStatus = 'corrupted';
                integrityMessage = `Arquivos ausentes: ${missingFolders.join(', ')}`;
            }

            return {
                slug: module.slug,
                name: module.name,
                version: module.version,
                description: module.description,
                status: integrityStatus === 'corrupted' ? 'corrupted' : module.status, // Sobrescreve status visualmente se corrompido
                originalStatus: module.status,
                hasBackend: module.hasBackend,
                hasFrontend: module.hasFrontend,
                installedAt: module.installedAt,
                activatedAt: module.activatedAt,
                integrity: {
                    status: integrityStatus,
                    message: integrityMessage,
                    missingFolders
                },
                stats: {
                    tenants: module._count.tenantModules,
                    migrations: module._count.migrations,
                    menus: module._count.menus
                }
            };
        });
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

            let module;

            // Lógica de Atualização vs Instalação Limpa
            if (existingModule) {
                this.logger.log(`⚠️ Módulo ${validatedModule.name} já existe - preparando ATUALIZAÇÃO...`);

                // 1. Limpeza física prévia (importante para remover arquivos órfãos)
                await this.uninstallPhysicalFiles(validatedModule.name);

                // 2. Distribuir novos arquivos
                this.logger.log('6. Distribuindo arquivos (Atualização)...');
                await this.distributeModuleFiles(bufferToWrite, structure, validatedModule.name);
                filesDistributed = true;

                // 3. Atualizar Banco (Mantendo ID e Relacionamentos)
                this.logger.log('7. Atualizando registro no banco...');
                module = await this.prisma.module.update({
                    where: { id: existingModule.id },
                    data: {
                        name: validatedModule.displayName,
                        version: validatedModule.version,
                        description: validatedModule.description || '',
                        status: 'installed',
                        hasBackend: structure.hasBackend,
                        hasFrontend: structure.hasFrontend,
                        updatedAt: new Date()
                    }
                });

                // Limpa menus antigos
                await this.prisma.moduleMenu.deleteMany({ where: { moduleId: existingModule.id } });

            } else {
                // Instalação Nova
                this.logger.log('6. Distribuindo arquivos (Nova Instalação)...');
                await this.distributeModuleFiles(bufferToWrite, structure, validatedModule.name);
                filesDistributed = true;

                this.logger.log('7. Criando registro no banco...');
                module = await this.registerModuleInDatabase(validatedModule, structure, validatedModule.name);
            }

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
        try {
            if (Buffer.isBuffer(file.buffer)) return file.buffer;
            if (file.buffer && typeof file.buffer === 'object') {
                return Buffer.from(Object.values(file.buffer) as number[]);
            }
        } catch (error) {
            this.logger.error('Erro ao converter buffer:', error);
        }
        throw new BadRequestException('Buffer do arquivo inválido ou corrompido');
    }

    private async distributeModuleFiles(
        zipBuffer: Buffer,
        structure: ModuleStructureResult,
        moduleSlug: string
    ): Promise<void> {
        try {
            const zip = new AdmZip(zipBuffer);
            const entries = zip.getEntries();

            const frontendDest = path.join(this.frontendBase, moduleSlug);
            const backendDest = path.join(this.backendModulesPath, moduleSlug);

            // Tenta criar diretórios, loga se falhar (especialmente frontend em prod)
            try {
                if (!fs.existsSync(this.frontendBase)) fs.mkdirSync(this.frontendBase, { recursive: true });
            } catch (e) {
                this.logger.warn(`Não foi possível criar diretório frontend: ${this.frontendBase}. Ignorando arquivos de frontend.`);
            }

            try {
                if (!fs.existsSync(this.backendModulesPath)) fs.mkdirSync(this.backendModulesPath, { recursive: true });
            } catch (e) {
                throw new Error(`CRÍTICO: Não foi possível criar diretório de módulos backend: ${this.backendModulesPath}`);
            }

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
                    try {
                        const tDir = path.dirname(targetPath);
                        if (!fs.existsSync(tDir)) fs.mkdirSync(tDir, { recursive: true });
                        fs.writeFileSync(targetPath, _data);
                    } catch (writeError) {
                        this.logger.error(`Erro ao escrever arquivo ${targetPath}: ${writeError.message}`);
                        // Se for erro no frontend, apenas loga e continua (comum em Docker prod)
                        if (targetPath.includes(frontendDest)) {
                            this.logger.warn(`Skipping frontend file write due to error: ${relativePath}`);
                        } else {
                            throw writeError; // Erro no backend deve falhar a instalação
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error('Erro fatal na distribuição de arquivos:', error);
            throw new BadRequestException(`Falha ao extrair/escrever arquivos do módulo: ${error.message}`);
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

        const modulePath = path.join(this.backendModulesPath, slug);
        const count = await this.executeMigrations(slug, modulePath, 'migration');

        return { success: true, count, message: 'Migrações executadas com sucesso' };
    }

    async runModuleSeeds(slug: string) {
        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const modulePath = path.join(this.backendModulesPath, slug);
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

        const modulePath = path.join(this.backendModulesPath, slug);
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

        const modulePath = path.join(this.backendModulesPath, slug);

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
                    for (const menu of (validatedModule.menus as any[])) {
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
     * Executa migrations e seeds PENDENTES do módulo
     * NÃO remove registros existentes - apenas executa os que ainda não foram executados
     * Isso evita erros como "trigger já existe" ou "tabela já existe"
     * VERSÃO MELHORADA: Executa uma migration por vez e para no primeiro erro
     */
    async runMigrationsAndSeeds(slug: string) {
        this.logger.log(`🔄 Executando migrations e seeds pendentes para o módulo: ${slug}`);

        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const modulePath = path.join(this.backendModulesPath, slug);
        if (!fs.existsSync(modulePath)) {
            throw new BadRequestException(`Módulo não encontrado no disco: ${modulePath}`);
        }

        try {
            // NÃO remove registros existentes - apenas executa os pendentes
            // Isso evita erros de "trigger já existe" ou "tabela já existe"
            this.logger.log(`📋 Verificando migrations e seeds pendentes para ${slug}...`);

            // Executa migrations pendentes (uma por vez, parando no primeiro erro)
            const migrationsExecuted = await this.executeMigrationsOneByOne(slug, modulePath, 'migration');
            this.logger.log(`📊 ${migrationsExecuted} migrations executadas para ${slug}`);

            // Executa seeds pendentes (uma por vez, parando no primeiro erro)
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
                description: `Módulo ${module.name}: ${migrationsExecuted} migrations e ${seedsExecuted} seeds pendentes foram executados.`,
                type: 'success',
                metadata: {
                    module: slug,
                    action: 'migrations-seeds-run',
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
                const filePath = path.join(migrationsPath, file);
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
                // Verificar se o erro é de objeto que já existe (tabela, trigger, índice, etc.)
                const alreadyExistsPatterns = [
                    'já existe',
                    'already exists',
                    'duplicate key',
                    'relation .* already exists',
                    'trigger .* already exists',
                    'index .* already exists',
                    'constraint .* already exists'
                ];

                const errorMessage = error.message?.toLowerCase() || '';
                const isAlreadyExistsError = alreadyExistsPatterns.some(pattern =>
                    new RegExp(pattern, 'i').test(errorMessage)
                );

                if (isAlreadyExistsError) {
                    // Objeto já existe no banco - registrar migration como executada
                    this.logger.warn(`⚠️ ${type} ${file} - Objetos já existem no banco. Registrando como executada...`);

                    await this.prisma.moduleMigration.create({
                        data: { moduleId, filename: file, type: type as any, executedAt: new Date() }
                    });

                    executed++;
                    this.logger.log(`✅ ${type} ${file} registrada (objetos pré-existentes)`);
                    continue; // Continuar com próxima migration
                }

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

    async uninstallModule(slug: string, options: any) {
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

    private async registerModuleMenus(moduleId: string, menus: any[]) {
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
                // Verificar se o erro é de objeto que já existe (tabela, trigger, índice, etc.)
                const alreadyExistsPatterns = [
                    'já existe',
                    'already exists',
                    'duplicate key',
                    'relation .* already exists',
                    'trigger .* already exists',
                    'index .* already exists',
                    'constraint .* already exists'
                ];

                const errorMessage = error.message?.toLowerCase() || '';
                const isAlreadyExistsError = alreadyExistsPatterns.some(pattern =>
                    new RegExp(pattern, 'i').test(errorMessage)
                );

                if (isAlreadyExistsError) {
                    // Objeto já existe no banco - registrar migration como executada
                    this.logger.warn(`⚠️ ${type} ${file} - Objetos já existem no banco. Registrando como executada...`);

                    await this.prisma.moduleMigration.create({
                        data: { moduleId, filename: file, type: type as any, executedAt: new Date() }
                    });

                    executed++;
                    this.logger.log(`✅ ${type} ${file} registrada (objetos pré-existentes)`);
                    continue; // Continuar com próxima migration
                }

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
