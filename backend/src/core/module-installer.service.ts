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
            if (moduleJson.menus) {
                await this.registerModuleMenus(moduleJson.slug, moduleJson.menus);
            }

            // Notifica
            await this.notifications.notifyModuleActivated(moduleJson.slug, moduleJson.name);

            this.logger.log(`✅ Módulo ${moduleJson.slug} instalado com sucesso`);

            return {
                success: true,
                module: {
                    slug: module.slug,
                    name: module.name,
                    version: module.version,
                    status: module.status
                }
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
            where: { slug }
        });

        if (!module) {
            throw new Error('Módulo não encontrado');
        }

        if (module.status !== ModuleStatus.db_ready) {
            throw new Error('Módulo deve ter banco atualizado antes da ativação');
        }

        // Atualiza status para ativo
        await this.prisma.module.update({
            where: { slug },
            data: {
                status: ModuleStatus.active,
                activatedAt: new Date()
            }
        });

        await this.notifications.notifyModuleActivated(slug, module.name);
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
            message: `Módulo ${slug} foi desativado`,
            severity: 'info',
            audience: 'super_admin',
            source: 'core',
            module: slug
        });

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

        // Executa migrations
        await this.executeMigrations(slug, modulePath, 'migration');

        // Executa seeds
        await this.executeMigrations(slug, modulePath, 'seed');

        // Atualiza status
        await this.prisma.module.update({
            where: { slug },
            data: { status: ModuleStatus.db_ready }
        });

        return { success: true, message: 'Banco de dados atualizado' };
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
     * Registra menus do módulo
     */
    private async registerModuleMenus(slug: string, menus: any[]) {
        for (const menu of menus) {
            await this.prisma.moduleMenu.create({
                data: {
                    moduleId: (await this.prisma.module.findUnique({ where: { slug } }))!.id,
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
     */
    private async executeMigrations(slug: string, modulePath: string, type: MigrationType) {
        const migrationsPath = path.join(modulePath, type === MigrationType.migration ? 'migrations' : 'seeds');

        if (!fs.existsSync(migrationsPath)) {
            return;
        }

        const files = fs.readdirSync(migrationsPath)
            .filter(file => file.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const filePath = path.join(migrationsPath, file);

            // Verifica se já foi executado
            const existing = await this.prisma.moduleMigration.findUnique({
                where: {
                    moduleId_filename_type: {
                        moduleId: (await this.prisma.module.findUnique({ where: { slug } }))!.id,
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
                        moduleId: (await this.prisma.module.findUnique({ where: { slug } }))!.id,
                        filename: file,
                        type,
                        executedAt: new Date()
                    }
                });

                const duration = Date.now() - startTime;
                await this.notifications.notifyMigrationExecuted(slug, file, true);

                this.logger.log(`✅ ${type} ${file} executado em ${duration}ms`);

            } catch (error) {
                await this.notifications.notifyMigrationExecuted(slug, file, false);
                throw error;
            }
        }
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