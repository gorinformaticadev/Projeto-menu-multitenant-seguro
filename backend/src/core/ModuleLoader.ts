import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from './prisma.service';
import { CoreContext } from './context/CoreContext';
import { ModuleContract, RegisteredModule } from './contracts/ModuleContract';
import { ModuleStatus } from '@prisma/client';

/**
 * Loader seguro de módulos
 * Princípio: NENHUM código de módulo executa sem autorização do CORE
 */
@Injectable()
export class ModuleLoader implements OnModuleInit {
    private readonly logger = new Logger(ModuleLoader.name);
    private readonly modulesPath = path.resolve(process.cwd(), 'modules');
    private loadedModules: Map<string, RegisteredModule> = new Map();
    private coreContext: CoreContext;

    constructor(
        private readonly prisma: PrismaService,
        @Inject('CoreContext') coreContext: CoreContext
    ) {
        this.coreContext = coreContext;
    }

    async onModuleInit() {
        this.logger.log('🔐 Inicializando Module Loader Seguro...');
        await this.initializeCoreContext();
        await this.scanAndRegisterModules();
        await this.loadActiveModules();
    }

    /**
     * Inicializa o contexto do CORE
     */
    private async initializeCoreContext() {
        // O contexto já é injetado, mas podemos adicionar inicializações específicas
        this.logger.log('✅ Core Context inicializado');
    }

    /**
     * Escaneia diretório de módulos e registra no banco se não existir
     * Status inicial: 'detected'
     */
    private async scanAndRegisterModules() {
        if (!fs.existsSync(this.modulesPath)) {
            this.logger.warn(`📁 Diretório de módulos não encontrado: ${this.modulesPath}`);
            return;
        }

        const dirs = fs.readdirSync(this.modulesPath, { withFileTypes: true });

        for (const dir of dirs) {
            if (dir.isDirectory() && !dir.name.startsWith('.') && dir.name !== 'node_modules') {
                await this.registerDiscoveredModule(dir.name);
            }
        }
    }

    /**
     * Registra módulo descoberto no banco (se não existir)
     */
    private async registerDiscoveredModule(slug: string) {
        try {
            const modulePath = path.join(this.modulesPath, slug);
            const moduleJsonPath = path.join(modulePath, 'module.json');

            if (!fs.existsSync(moduleJsonPath)) {
                this.logger.warn(`⚠️ module.json não encontrado para ${slug}`);
                return;
            }

            const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf-8'));

            // Verificar se já existe no banco
            const existingModule = await this.prisma.module.findUnique({
                where: { slug }
            });

            if (!existingModule) {
                // Registrar como detectado
                await this.prisma.module.create({
                    data: {
                        slug,
                        name: moduleJson.name || slug,
                        version: moduleJson.version || '1.0.0',
                        description: moduleJson.description || '',
                        status: ModuleStatus.detected,
                        hasBackend: fs.existsSync(path.join(modulePath, 'backend')),
                        hasFrontend: fs.existsSync(path.join(modulePath, 'frontend')),
                        installedAt: new Date()
                    }
                });

                this.logger.log(`📝 Módulo detectado e registrado: ${slug}`);
            }
        } catch (error) {
            this.logger.error(`❌ Erro ao registrar módulo ${slug}:`, error);
        }
    }

    /**
     * Carrega apenas módulos ativos do banco
     */
    private async loadActiveModules() {
        const activeModules = await this.prisma.module.findMany({
            where: { status: ModuleStatus.active }
        });

        for (const moduleData of activeModules) {
            await this.loadModule(moduleData);
        }

        this.logger.log(`✅ ${this.loadedModules.size} módulos ativos carregados`);
    }

    /**
     * Carrega um módulo específico (apenas se autorizado pelo CORE)
     */
    private async loadModule(moduleData: any) {
        try {
            const modulePath = path.join(this.modulesPath, moduleData.slug);
            const moduleEntry = this.findModuleEntry(modulePath);

            if (!moduleEntry) {
                this.logger.warn(`⚠️ Arquivo de entrada não encontrado para ${moduleData.slug}`);
                return;
            }

            // Importar dinamicamente (com validação de segurança)
            const moduleExports = await this.safeImport(moduleEntry);

            if (!this.validateModuleContract(moduleExports.default || moduleExports)) {
                this.logger.error(`❌ Contrato inválido para módulo ${moduleData.slug}`);
                return;
            }

            const moduleContract: ModuleContract = moduleExports.default || moduleExports;

            // Registrar no módulo
            await moduleContract.register(this.coreContext);

            // Marcar como carregado
            const registeredModule: RegisteredModule = {
                ...moduleContract,
                status: 'active',
                registeredAt: new Date(),
                updatedAt: new Date()
            };

            this.loadedModules.set(moduleData.slug, registeredModule);
            this.logger.log(`🚀 Módulo carregado com sucesso: ${moduleData.slug}`);

        } catch (error) {
            this.logger.error(`❌ Erro ao carregar módulo ${moduleData.slug}:`, error);

            // Atualizar status no banco
            await this.prisma.module.update({
                where: { slug: moduleData.slug },
                data: { status: ModuleStatus.disabled }
            });
        }
    }

    /**
     * Encontra o arquivo de entrada do módulo
     */
    private findModuleEntry(modulePath: string): string | null {
        const possibleEntries = ['module.ts', 'module.js', 'index.ts', 'index.js'];

        for (const entry of possibleEntries) {
            const entryPath = path.join(modulePath, entry);
            if (fs.existsSync(entryPath)) {
                return entryPath;
            }
        }

        return null;
    }

    /**
     * Importação segura com validações básicas
     */
    private async safeImport(modulePath: string): Promise<any> {
        // Validações de segurança básicas
        if (!modulePath.startsWith(this.modulesPath)) {
            throw new Error('Tentativa de importação fora do diretório de módulos');
        }

        // Verificar se o arquivo existe e é legível
        if (!fs.existsSync(modulePath)) {
            throw new Error('Arquivo de módulo não encontrado');
        }

        // Importar dinamicamente
        return await import(modulePath);
    }

    /**
     * Valida se o módulo implementa o contrato obrigatório
     */
    private validateModuleContract(moduleExport: any): moduleExport is ModuleContract {
        return (
            moduleExport &&
            typeof moduleExport.name === 'string' &&
            typeof moduleExport.slug === 'string' &&
            typeof moduleExport.version === 'string' &&
            typeof moduleExport.register === 'function'
        );
    }

    /**
     * Obtém módulo carregado por slug
     */
    getModule(slug: string): RegisteredModule | undefined {
        return this.loadedModules.get(slug);
    }

    /**
     * Lista todos os módulos carregados
     */
    getLoadedModules(): RegisteredModule[] {
        return Array.from(this.loadedModules.values());
    }

    /**
     * Ativa um módulo (chamado pelo instalador após migrations)
     * Aceita módulos com status 'db_ready' ou 'disabled' (reativação)
     */
    async activateModule(slug: string): Promise<boolean> {
        try {
            const moduleData = await this.prisma.module.findUnique({
                where: { slug }
            });

            // Permite ativação de módulos db_ready ou disabled
            if (!moduleData || 
                (moduleData.status !== ModuleStatus.db_ready && moduleData.status !== ModuleStatus.disabled)) {
                this.logger.warn(`⚠️ Não é possível ativar módulo ${slug} com status: ${moduleData?.status}`);
                return false;
            }

            // Carregar o módulo
            await this.loadModule(moduleData);

            // Atualizar status
            await this.prisma.module.update({
                where: { slug },
                data: {
                    status: ModuleStatus.active,
                    activatedAt: new Date()
                }
            });

            this.logger.log(`✅ Módulo ativado: ${slug}`);
            return true;

        } catch (error) {
            this.logger.error(`❌ Erro ao ativar módulo ${slug}:`, error);
            return false;
        }
    }

    /**
     * Desativa um módulo
     */
    async deactivateModule(slug: string): Promise<boolean> {
        try {
            const module = this.loadedModules.get(slug);
            if (module?.shutdown) {
                await module.shutdown();
            }

            this.loadedModules.delete(slug);

            await this.prisma.module.update({
                where: { slug },
                data: { status: ModuleStatus.disabled }
            });

            this.logger.log(`⏸️ Módulo desativado: ${slug}`);
            return true;

        } catch (error) {
            this.logger.error(`❌ Erro ao desativar módulo ${slug}:`, error);
            return false;
        }
    }
}

