import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';
import { PrismaService } from './prisma.service';
import { ModuleSecurityService } from './module-security.service';
import { NotificationService } from './notification.service';
import { ModuleStatus, MigrationType } from '@prisma/client';

/**
 * Serviço de Instalação de Módulos
 * Gerencia upload, instalação, ativação e migrations de módulos
 */
@Injectable()
export class ModuleInstallerService {
    private readonly logger = new Logger(ModuleInstallerService.name);
    private readonly modulesPath = path.resolve(process.cwd(), 'modules');
    private readonly uploadsPath = path.resolve(process.cwd(), 'uploads', 'modules');

    constructor(
        private readonly prisma: PrismaService,
        private readonly security: ModuleSecurityService,
        private readonly notifications: NotificationService
    ) {
        // Garante que os diretórios existem
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
        const tempPath = path.join(this.uploadsPath, `temp_${Date.now()}_${file.originalname}`);

        try {
            // Salva arquivo temporariamente
            fs.writeFileSync(tempPath, file.buffer);

            // Extrai ZIP
            const extractPath = path.join(this.modulesPath, path.parse(file.originalname).name);
            await this.extractZip(tempPath, extractPath);

            // Valida estrutura
            const validation = await this.security.validateModuleStructure(path.parse(file.originalname).name);
            if (!validation.valid) {
                throw new Error(`Estrutura inválida: ${validation.errors.join(', ')}`);
            }

            // Lê module.json
            const moduleJsonPath = path.join(extractPath, 'module.json');
            const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf-8'));

            // Registra no banco como "installed"
            const module = await this.prisma.module.upsert({
                where: { slug: moduleJson.slug },
                update: {
                    name: moduleJson.name,
                    version: moduleJson.version,
                    description: moduleJson.description,
                    status: ModuleStatus.installed,
                    hasBackend: fs.existsSync(path.join(extractPath, 'backend')),
                    hasFrontend: fs.existsSync(path.join(extractPath, 'frontend')),
                    installedAt: new Date()
                },
                create: {
                    slug: moduleJson.slug,
                    name: moduleJson.name,
                    version: moduleJson.version,
                    description: moduleJson.description,
                    status: ModuleStatus.installed,
                    hasBackend: fs.existsSync(path.join(extractPath, 'backend')),
                    hasFrontend: fs.existsSync(path.join(extractPath, 'frontend')),
                    installedAt: new Date()
                }
            });

            // Registra menus se definidos
            if (moduleJson.menus && moduleJson.menus.length > 0) {
                await this.registerModuleMenus(module.id, moduleJson.menus);
            }

            // Notifica instalação (NÃO ativação)
            await this.notifications.createNotification({
                title: 'Módulo Instalado',
                message: `Módulo ${moduleJson.name} instalado com sucesso. Execute a preparação do banco de dados antes de ativar.`,
                severity: 'info',
                audience: 'super_admin',
                source: 'core',
                module: moduleJson.slug,
                context: '/configuracoes/sistema/modulos'
            });

            this.logger.log(`✅ Módulo ${moduleJson.slug} instalado com sucesso`);

            return {
                success: true,
                module: {
                    slug: module.slug,
                    name: module.name,
                    version: module.version,
                    status: module.status
                },
                message: 'Módulo instalado. Execute preparação de banco antes de ativar.'
            };

        } catch (error) {
            this.logger.error('Erro ao instalar módulo:', error);
            throw error;
        } finally {
            // Limpa arquivo temporário
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    /**
     * Ativa um módulo instalado
     */
    async activateModule(slug: string) {
        const module = await this.prisma.module.findUnique({
            where: { slug },
            include: {
                _count: {
                    select: { migrations: true }
                }
            }
        });

        if (!module) {
            throw new Error('Módulo não encontrado');
        }

        if (module.status !== ModuleStatus.db_ready) {
            throw new Error('Módulo deve ter banco atualizado antes da ativação');
        }

        // Validar dependências se declaradas no module.json
        const modulePath = path.join(this.modulesPath, slug);
        const moduleJsonPath = path.join(modulePath, 'module.json');
        
        if (fs.existsSync(moduleJsonPath)) {
            const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf-8'));
            
            if (moduleJson.dependencies && moduleJson.dependencies.length > 0) {
                const inactiveDeps = [];
                
                for (const depSlug of moduleJson.dependencies) {
                    const depModule = await this.prisma.module.findUnique({
                        where: { slug: depSlug }
                    });
                    
                    if (!depModule) {
                        throw new Error(`Dependência não encontrada: ${depSlug}`);
                    }
                    
                    if (depModule.status !== ModuleStatus.active) {
                        inactiveDeps.push(depSlug);
                    }
                }
                
                if (inactiveDeps.length > 0) {
                    throw new Error(`Módulos dependentes não estão ativos: ${inactiveDeps.join(', ')}`);
                }
            }
        }

        // Atualiza status para ativo
        await this.prisma.module.update({
            where: { slug },
            data: {
                status: ModuleStatus.active,
                activatedAt: new Date()
            }
        });

        await this.notifications.createNotification({
            title: 'Módulo Ativado',
            message: `Módulo ${module.name} está agora operacional no sistema.`,
            severity: 'info',
            audience: 'super_admin',
            source: 'core',
            module: slug
        });
        
        this.logger.log(`✅ Módulo ${slug} ativado com sucesso`);
        return { success: true, message: `Módulo ${slug} ativado` };
    }

    /**
     * Desativa um módulo
     */
    async deactivateModule(slug: string) {
        const module = await this.prisma.module.findUnique({
            where: { slug }
        });

        if (!module) {
            throw new Error('Módulo não encontrado');
        }

        // Verificar dependências inversas (outros módulos que dependem deste)
        const allModules = await this.prisma.module.findMany({
            where: { status: ModuleStatus.active }
        });

        const dependentModules = [];
        
        for (const otherModule of allModules) {
            if (otherModule.slug === slug) continue;
            
            const otherModulePath = path.join(this.modulesPath, otherModule.slug);
            const otherModuleJsonPath = path.join(otherModulePath, 'module.json');
            
            if (fs.existsSync(otherModuleJsonPath)) {
                const otherModuleJson = JSON.parse(fs.readFileSync(otherModuleJsonPath, 'utf-8'));
                
                if (otherModuleJson.dependencies && otherModuleJson.dependencies.includes(slug)) {
                    dependentModules.push(otherModule.name);
                }
            }
        }
        
        if (dependentModules.length > 0) {
            throw new Error(`Não é possível desativar. Módulos dependentes: ${dependentModules.join(', ')}`);
        }

        // Atualiza status para desativado
        await this.prisma.module.update({
            where: { slug },
            data: {
                status: ModuleStatus.disabled,
                activatedAt: null
            }
        });

        await this.notifications.createNotification({
            title: 'Módulo Desativado',
            message: `Módulo ${module.name} foi desativado`,
            severity: 'info',
            audience: 'super_admin',
            source: 'core',
            module: slug
        });

        this.logger.log(`⏸️ Módulo ${slug} desativado com sucesso`);
        return { success: true, message: `Módulo ${slug} desativado` };
    }

    /**
     * Atualiza banco de dados do módulo (executa migrations e seeds)
     */
    async updateModuleDatabase(slug: string) {
        const module = await this.prisma.module.findUnique({
            where: { slug }
        });

        if (!module || module.status !== ModuleStatus.installed) {
            throw new Error('Módulo deve estar instalado');
        }

        const modulePath = path.join(this.modulesPath, slug);
        let migrationsExecuted = 0;
        let seedsExecuted = 0;

        try {
            // Executa migrations
            migrationsExecuted = await this.executeMigrations(slug, modulePath, 'migration');

            // Executa seeds
            seedsExecuted = await this.executeMigrations(slug, modulePath, 'seed');

            // Atualiza status
            await this.prisma.module.update({
                where: { slug },
                data: { status: ModuleStatus.db_ready }
            });

            // Notifica sucesso
            await this.notifications.createNotification({
                title: 'Banco de Dados Atualizado',
                message: `Módulo ${module.name} está pronto. ${migrationsExecuted} migrations e ${seedsExecuted} seeds executados.`,
                severity: 'info',
                audience: 'super_admin',
                source: 'core',
                module: slug
            });

            this.logger.log(`✅ Banco de dados do módulo ${slug} atualizado`);
            
            return {
                success: true,
                executed: {
                    migrations: migrationsExecuted,
                    seeds: seedsExecuted
                },
                message: 'Banco de dados atualizado'
            };
        } catch (error) {
            // Notifica erro
            await this.notifications.createNotification({
                title: 'Erro ao Preparar Banco',
                message: `Falha ao atualizar banco do módulo ${module.name}: ${error.message}`,
                severity: 'critical',
                audience: 'super_admin',
                source: 'core',
                module: slug
            });
            
            throw error;
        }
    }

    /**
     * Obtém status detalhado de um módulo
     */
    async getModuleStatus(slug: string) {
        const module = await this.prisma.module.findUnique({
            where: { slug },
            include: {
                migrations: {
                    orderBy: { executedAt: 'desc' }
                },
                menus: true,
                tenantModules: {
                    include: {
                        tenant: {
                            select: { nomeFantasia: true }
                        }
                    }
                }
            }
        });

        if (!module) {
            throw new Error('Módulo não encontrado');
        }

        return {
            module: {
                slug: module.slug,
                name: module.name,
                version: module.version,
                status: module.status,
                hasBackend: module.hasBackend,
                hasFrontend: module.hasFrontend,
                installedAt: module.installedAt,
                activatedAt: module.activatedAt
            },
            migrations: module.migrations,
            menus: module.menus,
            tenants: module.tenantModules.map(tm => ({
                tenantName: tm.tenant.nomeFantasia,
                enabled: tm.enabled
            }))
        };
    }

    /**
     * Desinstala um módulo com opções de remoção de dados
     */
    async uninstallModule(slug: string, options: {
        dataRemovalOption: 'keep' | 'core_only' | 'full';
        confirmationName: string;
    }) {
        const module = await this.prisma.module.findUnique({
            where: { slug },
            include: {
                tenantModules: true,
                migrations: true
            }
        });

        if (!module) {
            throw new Error('Módulo não encontrado');
        }

        // VALIDAÇÃO 1: Status deve ser disabled ou installed
        if (module.status !== ModuleStatus.disabled && module.status !== ModuleStatus.installed) {
            throw new Error('Desative o módulo antes de desinstalar');
        }

        // VALIDAÇÃO 2: Verificar dependências inversas
        const allModules = await this.prisma.module.findMany({
            where: {
                status: { in: [ModuleStatus.active, ModuleStatus.db_ready] }
            }
        });

        const dependentModules = [];
        
        for (const otherModule of allModules) {
            if (otherModule.slug === slug) continue;
            
            const otherModulePath = path.join(this.modulesPath, otherModule.slug);
            const otherModuleJsonPath = path.join(otherModulePath, 'module.json');
            
            if (fs.existsSync(otherModuleJsonPath)) {
                const otherModuleJson = JSON.parse(fs.readFileSync(otherModuleJsonPath, 'utf-8'));
                
                if (otherModuleJson.dependencies && otherModuleJson.dependencies.includes(slug)) {
                    dependentModules.push(otherModule.name);
                }
            }
        }
        
        if (dependentModules.length > 0) {
            throw new Error(`Módulos dependentes: ${dependentModules.join(', ')}. Desative-os primeiro`);
        }

        // VALIDAÇÃO 3: Verificar tenants ativos
        const activeTenants = module.tenantModules.filter(tm => tm.enabled);
        if (activeTenants.length > 0) {
            throw new Error(`Módulo em uso por ${activeTenants.length} tenant(s). Desabilite primeiro`);
        }

        // VALIDAÇÃO 4: Confirmação de nome
        if (options.confirmationName !== slug) {
            throw new Error('Nome de confirmação incorreto');
        }

        const result: any = {
            success: true,
            removed: {
                coreRecords: false,
                tables: [],
                files: null
            },
            message: 'Módulo desinstalado'
        };

        try {
            // CAMADA 1: Remover registros do CORE (SEMPRE)
            // Os registros de module_menus, module_migrations e module_tenant
            // serão removidos em cascata devido ao onDelete: Cascade no Prisma
            await this.prisma.module.delete({
                where: { slug }
            });
            result.removed.coreRecords = true;
            this.logger.log(`✅ Registros do CORE removidos para módulo ${slug}`);

            // CAMADA 2: Remover tabelas do módulo (CONDICIONAL)
            if (options.dataRemovalOption === 'full') {
                const modulePath = path.join(this.modulesPath, slug);
                const moduleJsonPath = path.join(modulePath, 'module.json');
                
                // Buscar tabelas criadas pelo módulo
                const tablesToDrop = [];
                
                if (fs.existsSync(moduleJsonPath)) {
                    const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf-8'));
                    
                    // Se módulo declara allowDataRemoval: true e possui rollback.sql
                    const rollbackPath = path.join(modulePath, 'rollback.sql');
                    const uninstallPath = path.join(modulePath, 'uninstall.sql');
                    
                    if (moduleJson.allowDataRemoval && fs.existsSync(rollbackPath)) {
                        // Executar script de rollback customizado
                        const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8');
                        await this.prisma.$executeRawUnsafe(rollbackSql);
                        this.logger.log(`✅ Rollback customizado executado para ${slug}`);
                    } else if (moduleJson.allowDataRemoval && fs.existsSync(uninstallPath)) {
                        // Executar script de uninstall customizado
                        const uninstallSql = fs.readFileSync(uninstallPath, 'utf-8');
                        await this.prisma.$executeRawUnsafe(uninstallSql);
                        this.logger.log(`✅ Uninstall customizado executado para ${slug}`);
                    }
                    
                    // Extrair tabelas das migrations
                    const migrationsPath = path.join(modulePath, 'migrations');
                    if (fs.existsSync(migrationsPath)) {
                        const migrationFiles = fs.readdirSync(migrationsPath)
                            .filter(f => f.endsWith('.sql'))
                            .sort();
                        
                        for (const file of migrationFiles) {
                            const filePath = path.join(migrationsPath, file);
                            const sql = fs.readFileSync(filePath, 'utf-8');
                            
                            // Regex simples para detectar CREATE TABLE
                            const tableMatches = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi);
                            if (tableMatches) {
                                tableMatches.forEach(match => {
                                    const tableName = match.replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?/i, '').replace(/["']?.*/, '');
                                    if (tableName && !tablesToDrop.includes(tableName.toLowerCase())) {
                                        tablesToDrop.push(tableName.toLowerCase());
                                    }
                                });
                            }
                        }
                    }
                }
                
                // Executar DROP TABLE para cada tabela detectada
                for (const tableName of tablesToDrop) {
                    try {
                        // Verificar se tabela existe antes de dropar
                        const tableExists = await this.prisma.$queryRawUnsafe<any[]>(
                            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
                            tableName
                        );
                        
                        if (tableExists && tableExists.length > 0) {
                            await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
                            result.removed.tables.push(tableName);
                            this.logger.log(`✅ Tabela ${tableName} removida`);
                        }
                    } catch (error) {
                        this.logger.warn(`⚠️ Não foi possível remover tabela ${tableName}: ${error.message}`);
                        // Não lança erro, apenas registra aviso
                    }
                }
            }

            // CAMADA 3: Remover arquivos do módulo
            const modulePath = path.join(this.modulesPath, slug);
            if (fs.existsSync(modulePath)) {
                // Remover diretório recursivamente
                fs.rmSync(modulePath, { recursive: true, force: true });
                result.removed.files = `/modules/${slug}`;
                this.logger.log(`✅ Arquivos do módulo ${slug} removidos`);
            }

            // AUDITORIA
            await this.notifications.createNotification({
                title: 'Módulo Desinstalado',
                message: `Módulo ${module.name} foi removido do sistema`,
                severity: 'warning',
                audience: 'super_admin',
                source: 'core',
                module: slug
            });

            this.logger.log(`✅ Módulo ${slug} desinstalado com sucesso`);
            return result;

        } catch (error) {
            this.logger.error(`❌ Erro ao desinstalar módulo ${slug}:`, error);
            throw error;
        }
    }

    /**
     * Registra menus do módulo
     */
    private async registerModuleMenus(moduleId: string, menus: any[]) {
        // Deletar menus existentes do módulo (para atualizações)
        await this.prisma.moduleMenu.deleteMany({
            where: { moduleId }
        });

        // Criar novos menus
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

    /**
     * Executa migrations ou seeds
     * @returns Número de arquivos executados
     */
    private async executeMigrations(slug: string, modulePath: string, type: MigrationType): Promise<number> {
        const migrationsPath = path.join(modulePath, type === MigrationType.migration ? 'migrations' : 'seeds');

        if (!fs.existsSync(migrationsPath)) {
            return 0;
        }

        const files = fs.readdirSync(migrationsPath)
            .filter(file => file.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            return 0;
        }

        // Buscar moduleId uma vez
        const module = await this.prisma.module.findUnique({ where: { slug } });
        if (!module) {
            throw new Error(`Módulo ${slug} não encontrado`);
        }

        let executedCount = 0;

        for (const file of files) {
            const filePath = path.join(migrationsPath, file);

            // Verifica se já foi executado
            const existing = await this.prisma.moduleMigration.findUnique({
                where: {
                    moduleId_filename_type: {
                        moduleId: module.id,
                        filename: file,
                        type
                    }
                }
            });

            if (existing) continue;

            const startTime = Date.now();
            const sql = fs.readFileSync(filePath, 'utf-8');

            try {
                // Executa SQL
                await this.prisma.$executeRawUnsafe(sql);

                // Registra execução
                await this.prisma.moduleMigration.create({
                    data: {
                        moduleId: module.id,
                        filename: file,
                        type,
                        executedAt: new Date()
                    }
                });

                const duration = Date.now() - startTime;
                executedCount++;

                this.logger.log(`✅ ${type} ${file} executado em ${duration}ms`);

            } catch (error) {
                this.logger.error(`❌ Erro ao executar ${type} ${file}:`, error);
                throw new Error(`Falha ao executar ${file}: ${error.message}`);
            }
        }

        return executedCount;
    }

    /**
     * Extrai arquivo ZIP
     */
    private async extractZip(zipPath: string, extractPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const zip = new AdmZip(zipPath);
                zip.extractAllTo(extractPath, true);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Garante que diretórios necessários existem
     */
    private ensureDirectories() {
        [this.modulesPath, this.uploadsPath].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
}