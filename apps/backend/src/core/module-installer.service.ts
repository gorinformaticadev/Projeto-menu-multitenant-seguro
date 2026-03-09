import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';
import { createHash } from 'crypto';
import { PrismaService } from './prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { ModuleJsonValidator, ModuleJson } from './validators/module-json.validator';
import { ModuleStructureValidator, ModuleStructureResult } from './validators/module-structure.validator';
import { ModuleDatabaseExecutorService } from './services/module-database-executor.service';
import { AuditService } from '../audit/audit.service';
import { PathsService } from './common/paths/paths.service';

type ModuleLifecycleStepStatus = 'pending' | 'ready' | 'blocked' | 'error';
type ModuleLifecycleState = 'uploaded' | 'files_installed' | 'db_ready' | 'approved' | 'active' | 'disabled' | 'error';
type FrontendInspectMode = 'filesystem' | 'unavailable' | 'not_required';
type FrontendValidationLevel = 'structural' | 'permissive' | 'not_required';

interface ModuleLifecycleStep {
    status: ModuleLifecycleStepStatus;
    detail: string;
}

interface ModuleLifecycleSnapshot {
    current: ModuleLifecycleState;
    blockers: string[];
    dependencies: string[];
    frontendInspectMode: FrontendInspectMode;
    frontendValidationLevel: FrontendValidationLevel;
    steps: {
        files: ModuleLifecycleStep;
        database: ModuleLifecycleStep;
        dependencies: ModuleLifecycleStep;
        build: ModuleLifecycleStep;
        approval: ModuleLifecycleStep;
        activation: ModuleLifecycleStep;
    };
}

interface ModuleOperationActorContext {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
}

interface PrepareModuleDatabaseOptions {
    invokedBy?: string;
    visited?: Set<string>;
    actor?: ModuleOperationActorContext;
}

interface ModuleManifestIntegrity {
    valid: boolean;
    detail: string;
    manifest: ModuleJson | null;
}

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
    private readonly preparingModules = new Set<string>();

    // Caminhos definidos conforme especificação do monorepo
    private readonly backendModulesPath = path.resolve(process.cwd(), 'src', 'modules');
    private readonly frontendBase = path.resolve(process.cwd(), '..', 'frontend', 'src', 'app', 'modules');
    private readonly uploadsPath: string;
    private readonly allowedTextExtensions = new Set(['.json', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.md', '.txt', '.sql', '.yml', '.yaml']);
    private readonly allowedBinaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly dbExecutor: ModuleDatabaseExecutorService,
        private readonly auditService: AuditService,
        private readonly pathsService: PathsService
    ) {
        this.uploadsPath = path.resolve(this.pathsService.getUploadsDir(), 'modules');
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
        return await Promise.all(modules.map(async module => {
            let integrityStatus = 'ok';
            let integrityMessage = '';
            const missingFolders: string[] = [];
            const backendPath = path.join(this.backendModulesPath, module.slug);
            const legacyBackendPath = path.join(backendPath, 'backend');
            const legacyFrontendPath = path.join(backendPath, 'frontend');
            const expectsBackend = module.hasBackend || fs.existsSync(legacyBackendPath);
            const expectsFrontend = module.hasFrontend || module._count.menus > 0 || fs.existsSync(legacyFrontendPath);
            const physicalIntegrity = this.getPhysicalIntegrity(module.slug, expectsBackend, expectsFrontend);
            missingFolders.push(...physicalIntegrity.issues);

            if (fs.existsSync(legacyBackendPath)) {
                missingFolders.push('legacy-backend-layout');
            }

            if (expectsFrontend && fs.existsSync(legacyFrontendPath) && !fs.existsSync(path.join(this.frontendBase, module.slug))) {
                missingFolders.push('legacy-frontend-layout');
            }

            if (missingFolders.length > 0) {
                integrityStatus = 'corrupted';
                integrityMessage = `Problemas detectados: ${missingFolders.join(', ')}`;
            }

            const lifecycle = await this.buildModuleLifecycle(module);

            return {
                slug: module.slug,
                name: module.name,
                version: module.version,
                description: module.description,
                status: integrityStatus === 'corrupted' ? 'corrupted' : module.status,
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
                lifecycle,
                stats: {
                    tenants: module._count.tenantModules,
                    migrations: module._count.migrations,
                    menus: module._count.menus
                }
            };
        }));
    }
    /**
     * Instala modulo a partir de arquivo ZIP
     */
    async installModuleFromZip(
        file: Express.Multer.File,
        uploadedBy?: string,
        ipAddress?: string,
        userAgent?: string,
    ) {
        this.logger.log('Iniciando instalacao de modulo distribuida...');

        let moduleNameForRollback: string | null = null;
        let filesDistributed = false;
        let wasExistingModule = false;

        try {
            const bufferToWrite = this.prepareFileBuffer(file);
            const moduleHash = createHash('sha256').update(bufferToWrite).digest('hex');

            const structure = ModuleStructureValidator.analyzeZipStructure(bufferToWrite);
            const moduleJsonData = JSON.parse(structure.moduleJsonContent);
            const validatedModule = ModuleJsonValidator.validate(moduleJsonData);

            moduleNameForRollback = validatedModule.name;
            ModuleJsonValidator.validateSafeName(validatedModule.name);

            const existingModule = await this.prisma.module.findUnique({
                where: { slug: validatedModule.name }
            });

            wasExistingModule = !!existingModule;
            let module;

            if (existingModule) {
                this.logger.log(`Modulo ${validatedModule.name} ja existe - preparando atualizacao...`);
                await this.distributeModuleFiles(bufferToWrite, structure, validatedModule.name);
                filesDistributed = true;

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

                await this.prisma.moduleMenu.deleteMany({ where: { moduleId: existingModule.id } });
            } else {
                this.logger.log('Distribuindo arquivos (nova instalacao)...');
                await this.distributeModuleFiles(bufferToWrite, structure, validatedModule.name);
                filesDistributed = true;

                module = await this.registerModuleInDatabase(validatedModule, structure, validatedModule.name);
            }

            if (validatedModule.menus?.length) {
                await this.registerModuleMenus(module.id, validatedModule.menus);
            }

            await this.auditService.log({
                action: 'MODULE_UPLOAD',
                userId: uploadedBy,
                ipAddress,
                userAgent,
                details: {
                    slug: validatedModule.name,
                    version: validatedModule.version,
                    size: file.size,
                    sha256: moduleHash,
                    dependencies: validatedModule.dependencies ?? [],
                    validation: 'passed',
                    hasBackend: structure.hasBackend,
                    hasFrontend: structure.hasFrontend,
                    mode: wasExistingModule ? 'update' : 'install',
                }
            });

            await this.notifyModuleInstalled(validatedModule);

            return {
                success: true,
                module: {
                    name: validatedModule.name,
                    displayName: validatedModule.displayName,
                    version: validatedModule.version,
                    status: 'installed'
                },
                message: 'Modulo instalado com sucesso.'
            };

        } catch (error) {
            this.logger.error('Erro ao instalar modulo:', error);

            if (moduleNameForRollback && filesDistributed && !wasExistingModule) {
                this.logger.warn(`Executando rollback para modulo ${moduleNameForRollback}...`);
                try {
                    await this.uninstallPhysicalFiles(moduleNameForRollback);
                    await this.prisma.module.deleteMany({ where: { slug: moduleNameForRollback } });
                } catch (rollbackError) {
                    this.logger.error('Falha critica no rollback:', rollbackError);
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
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();

        const frontendDest = path.join(this.frontendBase, moduleSlug);
        const backendDest = path.join(this.backendModulesPath, moduleSlug);
        const backendStaging = path.join(this.backendModulesPath, `.staging-${moduleSlug}-${Date.now()}`);
        const frontendStaging = path.join(this.frontendBase, `.staging-${moduleSlug}-${Date.now()}`);

        try {
            if (!fs.existsSync(this.backendModulesPath)) fs.mkdirSync(this.backendModulesPath, { recursive: true });
            if (!fs.existsSync(this.frontendBase)) fs.mkdirSync(this.frontendBase, { recursive: true });

            fs.mkdirSync(backendStaging, { recursive: true });
            fs.mkdirSync(frontendStaging, { recursive: true });

            for (const entry of entries) {
                if (entry.isDirectory) continue;

                if (this.isSymlinkEntry(entry)) {
                    throw new BadRequestException(`ZIP contem symlink proibido: ${entry.entryName}`);
                }

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
                ModuleStructureValidator.validateSafePath(relativePath);

                const data = entry.getData();
                this.validateModuleFileEntry(relativePath, data);

                let targetPath = '';
                if (relativePath.startsWith('frontend/')) {
                    const inner = relativePath.substring('frontend/'.length);
                    if (inner.trim() !== '') {
                        targetPath = path.join(frontendStaging, inner);
                    }
                } else if (relativePath.startsWith('backend/')) {
                    const inner = relativePath.substring('backend/'.length);
                    targetPath = path.join(backendStaging, inner);
                } else if (!relativePath.includes('/')) {
                    targetPath = path.join(backendStaging, relativePath);
                }

                if (!targetPath) continue;

                const targetDir = path.dirname(targetPath);
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
                fs.writeFileSync(targetPath, data);
            }

            await this.atomicReplaceDir(backendStaging, backendDest);

            const hasFrontendPayload = fs.readdirSync(frontendStaging).length > 0;
            if (hasFrontendPayload) {
                await this.atomicReplaceDir(frontendStaging, frontendDest);
            } else {
                await this.safeRemoveDir(frontendStaging);
            }
        } catch (error) {
            await this.safeRemoveDir(backendStaging);
            await this.safeRemoveDir(frontendStaging);
            this.logger.error('Erro fatal na distribuicao de arquivos:', error);
            throw new BadRequestException(`Falha ao extrair/escrever arquivos do modulo: ${error.message}`);
        }
    }

    private isSymlinkEntry(entry: any): boolean {
        const attr = entry.header?.attr || 0;
        const mode = (attr >> 16) & 0xF000;
        return mode === 0xA000;
    }

    private validateModuleFileEntry(relativePath: string, data: Buffer): void {
        const ext = path.extname(relativePath).toLowerCase();

        if (!this.allowedTextExtensions.has(ext) && !this.allowedBinaryExtensions.has(ext)) {
            throw new BadRequestException(`Arquivo nao permitido no modulo: ${relativePath}`);
        }

        if (this.allowedTextExtensions.has(ext) && data.includes(0x00)) {
            throw new BadRequestException(`Arquivo binario nao permitido para extensao textual: ${relativePath}`);
        }
    }

    private async atomicReplaceDir(stagingDir: string, finalDir: string): Promise<void> {
        const backupDir = `${finalDir}.backup-${Date.now()}`;

        if (fs.existsSync(finalDir)) {
            fs.renameSync(finalDir, backupDir);
        }

        try {
            fs.renameSync(stagingDir, finalDir);
            await this.safeRemoveDir(backupDir);
        } catch (error) {
            if (fs.existsSync(backupDir)) {
                if (fs.existsSync(finalDir)) await this.safeRemoveDir(finalDir);
                fs.renameSync(backupDir, finalDir);
            }
            throw error;
        }
    }

    private async safeRemoveDir(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) return;
        await new Promise<void>((resolve) => {
            fs.rm(dirPath, { recursive: true, force: true }, () => resolve());
        });
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

        const lifecycle = await this.buildModuleLifecycle(module);

        if (lifecycle.steps.files.status !== 'ready') {
            throw new BadRequestException(`Módulo com integridade inválida: ${lifecycle.steps.files.detail}`);
        }

        if (lifecycle.steps.dependencies.status !== 'ready') {
            throw new BadRequestException(`Dependências não satisfeitas: ${lifecycle.steps.dependencies.detail}`);
        }

        if (lifecycle.steps.database.status !== 'ready') {
            throw new BadRequestException(`Banco do módulo não está pronto: ${lifecycle.steps.database.detail}`);
        }

        if (lifecycle.steps.build.status === 'blocked') {
            throw new BadRequestException(`Frontend do módulo não está pronto: ${lifecycle.steps.build.detail}`);
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

    async runModuleMigrations(slug: string, actor?: ModuleOperationActorContext) {
        const result = await this.prepareModuleDatabase(slug, {
            invokedBy: 'legacy-run-migrations',
            actor,
        });

        return {
            success: true,
            count: result.module.migrationsExecuted,
            message: 'Endpoint legado redirecionado para a preparação oficial do banco do módulo.',
            officialOperation: result.officialOperation,
            module: result.module,
            checks: result.checks,
        };
    }

    async runModuleSeeds(slug: string, actor?: ModuleOperationActorContext) {
        const result = await this.prepareModuleDatabase(slug, {
            invokedBy: 'legacy-run-seeds',
            actor,
        });

        return {
            success: true,
            count: result.module.seedsExecuted,
            message: 'Endpoint legado redirecionado para a preparação oficial do banco do módulo.',
            officialOperation: result.officialOperation,
            module: result.module,
            checks: result.checks,
        };
    }

    async prepareModuleDatabase(slug: string, options: PrepareModuleDatabaseOptions = {}) {
        const {
            invokedBy = 'prepare-database',
            visited = new Set<string>(),
            actor,
        } = options;
        let currentStage = 'validate-request';

        if (visited.has(slug)) {
            throw new BadRequestException(`Dependência circular detectada ao preparar ${slug}`);
        }

        if (this.preparingModules.has(slug)) {
            throw new BadRequestException(`Já existe uma preparação de banco em andamento para o módulo ${slug}`);
        }

        this.preparingModules.add(slug);
        visited.add(slug);

        try {
            currentStage = 'load-module';
            const module = await this.prisma.module.findUnique({ where: { slug } });
            if (!module) throw new BadRequestException('Módulo não encontrado');

            const modulePath = path.join(this.backendModulesPath, slug);
            if (!fs.existsSync(modulePath)) {
                throw new BadRequestException(`Módulo não encontrado no disco: ${modulePath}`);
            }

            currentStage = 'validate-integrity';
            const integrity = this.getPhysicalIntegrity(module.slug, module.hasBackend, module.hasFrontend);
            if (!integrity.valid) {
                throw new BadRequestException(`Integridade inválida: ${integrity.issues.join(', ')}`);
            }

            const manifest = integrity.manifestIntegrity.manifest;
            if (!manifest) {
                throw new BadRequestException(`Integridade inválida: ${integrity.manifestIntegrity.detail}`);
            }

            const dependencies = manifest.dependencies ?? [];
            currentStage = 'resolve-dependencies';
            await this.ensureDependenciesPrepared(slug, dependencies, visited, actor);
            currentStage = 'validate-seeds';
            await this.assertPendingSeedsAreSafe(slug, modulePath);

            currentStage = 'audit-start';
            await this.auditService.log({
                action: 'MODULE_DB_PREPARE_STARTED',
                userId: actor?.userId,
                ipAddress: actor?.ipAddress,
                userAgent: actor?.userAgent,
                details: {
                    slug,
                    invokedBy,
                    dependencies,
                }
            });

            currentStage = 'run-migrations';
            const migrationsExecuted = await this.executeMigrationsOneByOne(slug, modulePath, 'migration');
            currentStage = 'run-seeds';
            const seedsExecuted = await this.executeMigrationsOneByOne(slug, modulePath, 'seed');

            if (module.status !== 'active' && module.status !== 'disabled') {
                currentStage = 'persist-status';
                await this.prisma.module.update({
                    where: { slug },
                    data: { status: 'db_ready' }
                });
            }

            currentStage = 'audit-success';
            await this.auditService.log({
                action: 'MODULE_DB_PREPARE_SUCCESS',
                userId: actor?.userId,
                ipAddress: actor?.ipAddress,
                userAgent: actor?.userAgent,
                details: {
                    slug,
                    invokedBy,
                    dependencies,
                    migrationsExecuted,
                    seedsExecuted,
                }
            });

            return {
                success: true,
                officialOperation: 'prepare-module-database',
                message: 'Banco do módulo preparado com sucesso',
                module: {
                    slug,
                    status: module.status === 'active' || module.status === 'disabled' ? module.status : 'db_ready',
                    migrationsExecuted,
                    seedsExecuted,
                },
                checks: {
                    integrity: 'ready',
                    dependencies: dependencies.length > 0 ? 'ready' : 'not_required',
                }
            };
        } catch (error) {
            await this.auditService.log({
                action: 'MODULE_DB_PREPARE_FAILED',
                userId: actor?.userId,
                ipAddress: actor?.ipAddress,
                userAgent: actor?.userAgent,
                details: {
                    slug,
                    invokedBy,
                    stage: currentStage,
                    error: error instanceof Error ? error.message : String(error),
                }
            });
            throw error;
        } finally {
            visited.delete(slug);
            this.preparingModules.delete(slug);
        }
    }

    async updateModuleDatabase(slug: string, actor?: ModuleOperationActorContext) {
        return await this.prepareModuleDatabase(slug, {
            invokedBy: 'legacy-update-db',
            actor,
        });
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
    async runMigrationsAndSeeds(slug: string, actor?: ModuleOperationActorContext) {
        return await this.prepareModuleDatabase(slug, {
            invokedBy: 'legacy-run-migrations-seeds',
            actor,
        });
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
        const lifecycle = await this.buildModuleLifecycle(module);
        return { module: { ...module, lifecycle }, migrations: module.migrations, menus: module.menus };
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

    private readInstalledModuleManifest(slug: string, modulePath?: string): ModuleJson {
        const resolvedModulePath = modulePath ?? path.join(this.backendModulesPath, slug);
        const moduleJsonPath = path.join(resolvedModulePath, 'module.json');

        if (!fs.existsSync(moduleJsonPath)) {
            throw new BadRequestException(`module.json não encontrado para o módulo ${slug}`);
        }

        const raw = fs.readFileSync(moduleJsonPath, 'utf-8');
        return ModuleJsonValidator.validate(JSON.parse(raw));
    }

    private getManifestIntegrity(slug: string, modulePath?: string): ModuleManifestIntegrity {
        try {
            const manifest = this.readInstalledModuleManifest(slug, modulePath);
            return {
                valid: true,
                detail: 'module.json válido e legível.',
                manifest,
            };
        } catch (error) {
            return {
                valid: false,
                detail: error instanceof Error ? error.message : String(error),
                manifest: null,
            };
        }
    }

    private getPhysicalIntegrity(slug: string, hasBackend: boolean, hasFrontend: boolean) {
        const issues: string[] = [];
        const backendPath = path.join(this.backendModulesPath, slug);
        const frontendPath = path.join(this.frontendBase, slug);
        const manifestIntegrity = this.getManifestIntegrity(slug, backendPath);
        const backendEntrypointExists =
            fs.existsSync(path.join(backendPath, `${slug}.module.ts`)) ||
            fs.existsSync(path.join(backendPath, `${slug}.module.js`));

        if (!manifestIntegrity.valid) {
            issues.push(`manifest (${manifestIntegrity.detail})`);
        }

        if (hasBackend && (!fs.existsSync(backendPath) || !backendEntrypointExists)) {
            issues.push('backend');
        }

        if (hasFrontend && fs.existsSync(path.resolve(process.cwd(), '..', 'frontend')) && !fs.existsSync(frontendPath)) {
            issues.push('frontend');
        }

        return {
            valid: issues.length === 0,
            issues,
            manifestIntegrity,
        };
    }

    private getFrontendReadiness(slug: string, hasFrontend: boolean) {
        if (!hasFrontend) {
            return {
                inspectMode: 'not_required' as const,
                validationLevel: 'not_required' as const,
                ready: true,
                detail: 'Módulo sem frontend.',
            };
        }

        const frontendRootVisible = fs.existsSync(path.resolve(process.cwd(), '..', 'frontend'));
        if (!frontendRootVisible) {
            return {
                inspectMode: 'unavailable' as const,
                validationLevel: 'permissive' as const,
                ready: true,
                detail: 'Validação permissiva: o frontend não é inspecionável a partir deste processo; o build atual não pôde ser comprovado.',
            };
        }

        const frontendPath = path.join(this.frontendBase, slug);
        if (!fs.existsSync(frontendPath)) {
            return {
                inspectMode: 'filesystem' as const,
                validationLevel: 'structural' as const,
                ready: false,
                detail: 'Pasta do frontend do módulo não encontrada.',
            };
        }

        const hasPageFile = this.findFilesRecursively(frontendPath, ['page.tsx', 'page.jsx', 'page.ts', 'page.js']).length > 0;
        if (!hasPageFile) {
            return {
                inspectMode: 'filesystem' as const,
                validationLevel: 'structural' as const,
                ready: false,
                detail: 'Nenhum arquivo de página do módulo foi encontrado no frontend.',
            };
        }

        return {
            inspectMode: 'filesystem' as const,
            validationLevel: 'structural' as const,
            ready: true,
            detail: 'Validação estrutural: páginas do módulo encontradas no filesystem, mas o build atual não foi verificado.',
        };
    }

    private findFilesRecursively(root: string, acceptedNames: string[]): string[] {
        if (!fs.existsSync(root)) return [];

        const result: string[] = [];
        const stack = [root];

        while (stack.length > 0) {
            const current = stack.pop()!;
            const entries = fs.readdirSync(current, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                    continue;
                }

                if (acceptedNames.includes(entry.name)) {
                    result.push(fullPath);
                }
            }
        }

        return result;
    }

    private async ensureDependenciesPrepared(
        slug: string,
        dependencies: string[],
        visited: Set<string>,
        actor?: ModuleOperationActorContext,
    ) {
        for (const dependencySlug of dependencies) {
            if (dependencySlug === slug) {
                throw new BadRequestException(`Módulo ${slug} não pode depender de si mesmo`);
            }

            const dependency = await this.prisma.module.findUnique({ where: { slug: dependencySlug } });
            if (!dependency) {
                throw new BadRequestException(`Dependência obrigatória não instalada: ${dependencySlug}`);
            }

            if (visited.has(dependencySlug)) {
                throw new BadRequestException(`Dependência circular detectada entre ${slug} e ${dependencySlug}`);
            }

            if (dependency.status === 'installed') {
                await this.prepareModuleDatabase(dependencySlug, {
                    invokedBy: `dependency-of:${slug}`,
                    visited,
                    actor,
                });
                continue;
            }

            if (!['db_ready', 'active'].includes(dependency.status)) {
                throw new BadRequestException(`Dependência ${dependencySlug} não está pronta para uso (status: ${dependency.status})`);
            }
        }
    }

    private async assertPendingSeedsAreSafe(slug: string, modulePath: string) {
        const seedsPath = path.join(modulePath, 'seeds');
        if (!fs.existsSync(seedsPath)) return;

        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) throw new BadRequestException('Módulo não encontrado');

        const pendingSeeds = fs.readdirSync(seedsPath).filter(file => file.endsWith('.sql')).sort();

        for (const file of pendingSeeds) {
            const existing = await this.prisma.moduleMigration.findUnique({
                where: {
                    moduleId_filename_type: {
                        moduleId: module.id,
                        filename: file,
                        type: 'seed',
                    }
                }
            });

            if (existing) continue;

            const sql = fs.readFileSync(path.join(seedsPath, file), 'utf-8');
            const normalizedSql = sql.toUpperCase();
            const hasInsert = normalizedSql.includes('INSERT INTO');
            const hasSafeGuard =
                normalizedSql.includes('ON CONFLICT') ||
                normalizedSql.includes('NOT EXISTS');

            if (hasInsert && !hasSafeGuard) {
                throw new BadRequestException(
                    `Seed inseguro bloqueado (${file}). Use ON CONFLICT, NOT EXISTS ou verificação equivalente antes do INSERT.`
                );
            }
        }
    }

    private async buildModuleLifecycle(module: {
        id: string;
        slug: string;
        status: string;
        hasBackend: boolean;
        hasFrontend: boolean;
    }): Promise<ModuleLifecycleSnapshot> {
        const integrity = this.getPhysicalIntegrity(module.slug, module.hasBackend, module.hasFrontend);
        const manifestIntegrity = integrity.manifestIntegrity;
        const dependencies = manifestIntegrity.manifest?.dependencies ?? [];
        const frontend = this.getFrontendReadiness(module.slug, module.hasFrontend);

        const dependencyModules = dependencies.length > 0
            ? await this.prisma.module.findMany({
                where: { slug: { in: dependencies } },
                select: { slug: true, status: true }
            })
            : [];

        const dependencyMap = new Map(dependencyModules.map(dep => [dep.slug, dep.status]));
        const missingDependencies = dependencies.filter(dep => !dependencyMap.has(dep));
        const blockedDependencies = dependencies.filter(dep => {
            const status = dependencyMap.get(dep);
            return status !== undefined && !['db_ready', 'active'].includes(status);
        });

        const databaseReady = ['db_ready', 'active', 'disabled'].includes(module.status);
        const filesStep: ModuleLifecycleStep = integrity.valid
            ? { status: 'ready', detail: 'Arquivos, entrypoints e manifesto principal foram validados.' }
            : { status: 'error', detail: `Problemas encontrados: ${integrity.issues.join(', ')}` };

        const dependenciesStep: ModuleLifecycleStep = !manifestIntegrity.valid
            ? { status: 'blocked', detail: `Manifesto inválido: ${manifestIntegrity.detail}` }
            : missingDependencies.length > 0
            ? { status: 'blocked', detail: `Dependências ausentes: ${missingDependencies.join(', ')}` }
            : blockedDependencies.length > 0
                ? { status: 'blocked', detail: `Dependências ainda não prontas: ${blockedDependencies.join(', ')}` }
                : { status: 'ready', detail: dependencies.length > 0 ? 'Dependências instaladas e prontas.' : 'Módulo sem dependências.' };

        const databaseStep: ModuleLifecycleStep = databaseReady
            ? { status: 'ready', detail: 'Banco do módulo preparado.' }
            : { status: 'pending', detail: 'Banco do módulo ainda não foi preparado.' };

        const buildStep: ModuleLifecycleStep = frontend.ready
            ? { status: 'ready', detail: frontend.detail }
            : { status: 'blocked', detail: frontend.detail };

        const blockers = [
            ...(filesStep.status !== 'ready' ? [filesStep.detail] : []),
            ...(dependenciesStep.status !== 'ready' ? [dependenciesStep.detail] : []),
            ...(databaseStep.status !== 'ready' ? [databaseStep.detail] : []),
            ...(buildStep.status === 'blocked' ? [buildStep.detail] : []),
        ];

        const approvalReady = blockers.length === 0;
        const approvalStep: ModuleLifecycleStep = approvalReady
            ? { status: 'ready', detail: 'Módulo apto para aprovação/ativação global.' }
            : { status: 'blocked', detail: blockers[0] };

        const activationStep: ModuleLifecycleStep = module.status === 'active'
            ? { status: 'ready', detail: 'Módulo ativo no sistema.' }
            : approvalReady
                ? { status: 'pending', detail: 'Módulo pronto para ativação.' }
                : { status: 'blocked', detail: blockers[0] };

        let current: ModuleLifecycleState = 'uploaded';
        if (filesStep.status === 'error') current = 'error';
        else if (module.status === 'active') current = 'active';
        else if (module.status === 'disabled') current = 'disabled';
        else if (approvalReady && module.status === 'db_ready') current = 'approved';
        else if (databaseReady) current = 'db_ready';
        else if (module.status === 'installed') current = 'files_installed';

        return {
            current,
            blockers,
            dependencies,
            frontendInspectMode: frontend.inspectMode,
            frontendValidationLevel: frontend.validationLevel,
            steps: {
                files: filesStep,
                database: databaseStep,
                dependencies: dependenciesStep,
                build: buildStep,
                approval: approvalStep,
                activation: activationStep,
            }
        };
    }

    private ensureDirectories() {
        if (!fs.existsSync(this.backendModulesPath)) fs.mkdirSync(this.backendModulesPath, { recursive: true });
        if (!fs.existsSync(this.uploadsPath)) fs.mkdirSync(this.uploadsPath, { recursive: true });
    }
}
