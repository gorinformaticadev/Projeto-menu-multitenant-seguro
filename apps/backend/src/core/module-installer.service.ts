import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';
import { PrismaService } from './prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { ModuleStatus, MigrationType } from '@prisma/client';
import { ModuleJsonValidator, ModuleJson } from './validators/module-json.validator';
import { ModuleStructureValidator, ModuleStructureResult } from './validators/module-structure.validator';
import { ModuleDatabaseExecutorService } from './services/module-database-executor.service';

/**
 * Serviço de Instalação de Módulos - REFATORADO
 * Gerencia upload, instalação, ativação e migrations de módulos de forma segura e robusta
 */
@Injectable()
export class ModuleInstallerService {
    private readonly logger = new Logger(ModuleInstallerService.name);
    private readonly modulesPath = path.resolve(process.cwd(), '..', '..', 'packages', 'modules');
    private readonly uploadsPath = path.resolve(process.cwd(), 'uploads', 'modules');

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly dbExecutor: ModuleDatabaseExecutorService
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
     * Instala módulo a partir de arquivo ZIP - REFATORADO
     * 
     * Suporta dois formatos de ZIP:
     * 1. Raiz limpa: module.json na raiz do ZIP
     * 2. Pasta raiz: pasta-modulo/module.json
     * 
     * Fluxo de instalação seguro:
     * 1. Preparar buffer do arquivo
     * 2. Analisar estrutura do ZIP (SEM extrair)
     * 3. Validar module.json
     * 4. Validar nome seguro
     * 5. Validar que módulo não existe
     * 6. Extrair de forma segura (com proteção Zip Slip)
     * 7. Registrar no banco
     * 8. Registrar menus
     * 9. Notificar sucesso
     */
    async installModuleFromZip(file: Express.Multer.File) {
        this.logger.log('🚀 Iniciando instalação de módulo...');

        try {
            // 1️⃣ PREPARAR BUFFER
            this.logger.log('1. Preparando buffer do arquivo...');
            const bufferToWrite = this.prepareFileBuffer(file);
            this.logger.log(`✅ Buffer preparado: ${bufferToWrite.length} bytes`);

            // 2️⃣ ANALISAR ESTRUTURA DO ZIP (SEM EXTRAIR)
            this.logger.log('2. Analisando estrutura do ZIP...');
            const structure = ModuleStructureValidator.analyzeZipStructure(bufferToWrite);
            this.logger.log(`✅ Estrutura detectada - Base: ${structure.basePath || '(raiz)'}`);

            // 3️⃣ VALIDAR MODULE.JSON
            this.logger.log('3. Validando module.json...');
            const moduleJsonData = JSON.parse(structure.moduleJsonContent);
            const validatedModule = ModuleJsonValidator.validate(moduleJsonData);
            this.logger.log(`✅ module.json válido - Módulo: ${validatedModule.name} v${validatedModule.version}`);

            // 4️⃣ VALIDAR NOME SEGURO
            this.logger.log('4. Validando nome seguro para filesystem...');
            ModuleJsonValidator.validateSafeName(validatedModule.name);
            this.logger.log(`✅ Nome seguro validado: ${validatedModule.name}`);

            // 5️⃣ VERIFICAR SE MÓDULO JÁ EXISTE (permitir atualização)
            this.logger.log('5. Verificando se módulo já existe (atualização permitida)...');
            const existingModule = await this.prisma.module.findUnique({
                where: { slug: validatedModule.name }
            });

            if (existingModule) {
                this.logger.log(`⚠️ Módulo ${validatedModule.name} já existe - será atualizado`);
                // Remover versão antiga dos arquivos
                // Remover versão antiga dos arquivos com Retry
                const oldModulePath = path.join(this.modulesPath, validatedModule.name);
                if (fs.existsSync(oldModulePath)) {
                    try {
                        // Tenta remover diretório antigo
                        await this.robustRemoveDir(oldModulePath);
                        this.logger.log(`✅ Versão antiga removida: ${oldModulePath}`);
                    } catch (e) {
                        this.logger.warn(`⚠️ Não foi possível limpar pasta antiga (bloqueada?): ${e.message}`);
                        this.logger.warn(`ℹ️ Tentando sobrescrever arquivos...`);
                        // Não lança erro, tenta prosseguir com a extração que irá sobrescrever
                    }
                }

                // Remover registros antigos do banco
                await this.prisma.module.delete({
                    where: { slug: validatedModule.name }
                });
                this.logger.log(`✅ Registros antigos removidos do banco`);
            } else {
                this.logger.log(`✅ Módulo ${validatedModule.name} não existe - instalação limpa`);
            }

            // 6️⃣ EXTRAIR ZIP DE FORMA SEGURA
            this.logger.log('6. Extraindo módulo de forma segura...');
            const finalModulePath = path.join(this.modulesPath, validatedModule.name);
            await this.extractModuleSafely(bufferToWrite, structure, finalModulePath);
            this.logger.log(`✅ Módulo extraído para: ${finalModulePath}`);

            // 7️⃣ REGISTRAR NO BANCO
            this.logger.log('7. Registrando módulo no banco de dados...');
            const module = await this.registerModuleInDatabase(
                validatedModule,
                structure,
                finalModulePath
            );
            this.logger.log(`✅ Módulo registrado - ID: ${module.id}`);

            // 8️⃣ REGISTRAR MENUS (SE HOUVER)
            if (validatedModule.menus && validatedModule.menus.length > 0) {
                this.logger.log(`8. Registrando ${validatedModule.menus.length} menu(s)...`);
                await this.registerModuleMenus(module.id, validatedModule.menus);
                this.logger.log(`✅ Menus registrados`);
            } else {
                this.logger.log('8. Nenhum menu para registrar');
            }

            // 9️⃣ NOTIFICAR SUCESSO
            this.logger.log('9. Criando notificação de sucesso...');
            await this.notifyModuleInstalled(validatedModule);
            this.logger.log(`✅ Notificação criada`);

            this.logger.log(`✅ Módulo ${validatedModule.name} instalado com sucesso!`);

            return {
                success: true,
                module: {
                    name: validatedModule.name,
                    displayName: validatedModule.displayName,
                    version: validatedModule.version,
                    status: ModuleStatus.installed
                },
                message: 'Módulo instalado. Execute preparação de banco antes de ativar.'
            };

        } catch (error) {
            this.logger.error('❌ Erro ao instalar módulo:', error.message);
            this.logger.error('Stack:', error.stack);
            throw error;
        }
    }

    /**
     * Prepara buffer do arquivo recebido
     * Resolve problema de buffer serializado como Object
     */
    private prepareFileBuffer(file: Express.Multer.File): Buffer {
        // Caso 1: Já é Buffer válido
        if (Buffer.isBuffer(file.buffer)) {
            return file.buffer;
        }

        // Caso 2: file.buffer é Object serializado (bug conhecido do Multer)
        if (file.buffer && typeof file.buffer === 'object') {
            this.logger.warn('⚠️ Buffer chegou como Object, convertendo...');
            const bufferArray = Object.values(file.buffer);
            return Buffer.from(bufferArray as number[]);
        }

        // Caso 3: Tipo inválido
        throw new BadRequestException(
            `Buffer de arquivo inválido - tipo recebido: ${typeof file.buffer}`
        );
    }

    /**
     * Extrai módulo de forma segura com proteção contra Zip Slip
     * Remove basePath automaticamente se houver
     */
    private async extractModuleSafely(
        zipBuffer: Buffer,
        structure: ModuleStructureResult,
        destinationPath: string
    ): Promise<void> {
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();

        // Criar diretório de destino
        if (!fs.existsSync(destinationPath)) {
            fs.mkdirSync(destinationPath, { recursive: true });
        }

        let filesExtracted = 0;

        for (const entry of entries) {
            // Ignorar diretórios (serão criados automaticamente)
            if (entry.isDirectory) {
                continue;
            }

            // Remover basePath se houver (normaliza ambos os formatos)
            let relativePath = entry.entryName;

            if (structure.basePath) {
                const basePathWithSlash = structure.basePath + '/';

                // Ignorar arquivos fora da pasta raiz do módulo
                if (!relativePath.startsWith(basePathWithSlash)) {
                    continue;
                }

                // Remover basePath para obter caminho relativo limpo
                relativePath = relativePath.substring(basePathWithSlash.length);
            }

            // Pular se caminho ficou vazio após remoção do basePath
            if (!relativePath || relativePath.trim() === '') {
                continue;
            }

            // Validar path seguro (previne Zip Slip e path traversal)
            ModuleStructureValidator.validateSafePath(relativePath);

            // Caminho final absoluto
            const targetPath = path.join(destinationPath, relativePath);

            // Validar que targetPath está dentro de destinationPath (proteção adicional)
            const normalizedTarget = path.normalize(targetPath);
            const normalizedDestination = path.normalize(destinationPath);

            if (!normalizedTarget.startsWith(normalizedDestination)) {
                throw new BadRequestException(
                    `Tentativa de Zip Slip detectada: ${entry.entryName}`
                );
            }

            // Criar diretórios intermediários
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Extrair arquivo
            const data = entry.getData();
            fs.writeFileSync(targetPath, data);
            filesExtracted++;
        }

        this.logger.log(`✅ ${filesExtracted} arquivo(s) extraído(s) com segurança`);
    }

    /**
     * Registra módulo no banco de dados
     */
    private async registerModuleInDatabase(
        moduleJson: ModuleJson,
        structure: ModuleStructureResult,
        modulePath: string
    ) {
        return await this.prisma.module.create({
            data: {
                slug: moduleJson.name,
                name: moduleJson.displayName,
                version: moduleJson.version,
                description: moduleJson.description || '',
                status: ModuleStatus.installed,
                hasBackend: structure.hasBackend,
                hasFrontend: structure.hasFrontend,
                installedAt: new Date()
            }
        });
    }

    /**
     * Cria notificação de módulo instalado
     */
    private async notifyModuleInstalled(moduleJson: ModuleJson): Promise<void> {
        await this.notificationService.create({
            title: 'Módulo Instalado',
            description: `Módulo ${moduleJson.displayName} instalado com sucesso. Execute a preparação do banco de dados antes de ativar.`,
            type: 'success',
            metadata: {
                module: moduleJson.name,
                action: 'installed',
                context: '/configuracoes/sistema/modulos'
            }
        });
    }

    /**
     * Ativa um módulo instalado
     * Validação rigorosa: status deve ser 'db_ready' ou 'disabled'
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

        // Validação rigorosa de status conforme ciclo de vida
        if (module.status !== ModuleStatus.db_ready && module.status !== ModuleStatus.disabled) {
            throw new Error(
                `Não é possível ativar este módulo.\n` +
                `Motivo: Status atual é '${module.status}' (requer 'db_ready' ou 'disabled')\n` +
                `Solução: ${this.getActivationSolution(module.status)}`
            );
        }

        // Validar dependências se declaradas no module.json
        const modulePath = path.join(this.modulesPath, slug);
        const moduleJsonPath = path.join(modulePath, 'module.json');

        if (fs.existsSync(moduleJsonPath)) {
            const moduleJson = this.readModuleJsonSafe(moduleJsonPath);

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

        // Atualizar status para ativo
        await this.prisma.module.update({
            where: { slug },
            data: {
                status: ModuleStatus.active,
                activatedAt: new Date()
            }
        });

        await this.notificationService.create({
            title: 'Módulo Ativado',
            description: `Módulo ${module.name} está agora operacional no sistema`,
            type: 'success',
            metadata: {
                module: slug,
                action: 'activated',
                context: '/configuracoes/sistema/modulos'
            }
        });

        return { success: true, message: `Módulo ${slug} ativado` };
    }

    /**
     * Desativa um módulo
     * Validação rigorosa: status deve ser 'active'
     */
    async deactivateModule(slug: string) {
        const module = await this.prisma.module.findUnique({
            where: { slug }
        });

        if (!module) {
            throw new Error('Módulo não encontrado');
        }

        // Validação rigorosa de status
        if (module.status !== ModuleStatus.active) {
            throw new Error(
                `Desativação Bloqueada\n` +
                `Este módulo não pode ser desativado.\n` +
                `Motivo: Status atual é '${module.status}' (apenas módulos 'active' podem ser desativados)`
            );
        }

        // Verificar se outros módulos dependem deste
        const allModules = await this.prisma.module.findMany({
            where: { status: ModuleStatus.active }
        });

        for (const otherModule of allModules) {
            if (otherModule.slug === slug) continue;

            const otherModulePath = path.join(this.modulesPath, otherModule.slug);
            const otherModuleJsonPath = path.join(otherModulePath, 'module.json');

            if (fs.existsSync(otherModuleJsonPath)) {
                const otherModuleJson = this.readModuleJsonSafe(otherModuleJsonPath);

                if (otherModuleJson.dependencies && otherModuleJson.dependencies.includes(slug)) {
                    throw new Error(
                        `Não é possível desativar ${slug}. Módulo ${otherModule.name} depende dele. Desative ${otherModule.name} primeiro.`
                    );
                }
            }
        }

        // Atualizar status para desativado
        await this.prisma.module.update({
            where: { slug },
            data: {
                status: ModuleStatus.disabled,
                activatedAt: null
            }
        });

        await this.notificationService.create({
            title: 'Módulo Desativado',
            description: `Módulo ${slug} foi desativado`,
            type: 'info',
            metadata: {
                module: slug,
                action: 'deactivated'
            }
        });

        return { success: true, message: `Módulo ${slug} desativado` };
    }

    /**
     * Atualiza banco de dados do módulo (executa migrations e seeds)
     * MANTIDO SEM ALTERAÇÕES
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
        const migrationsExecuted = await this.executeMigrations(slug, modulePath, MigrationType.migration);

        // Executa seeds
        const seedsExecuted = await this.executeMigrations(slug, modulePath, MigrationType.seed);

        // Atualiza status
        await this.prisma.module.update({
            where: { slug },
            data: { status: ModuleStatus.db_ready }
        });

        await this.notificationService.create({
            title: 'Banco de Dados Atualizado',
            description: `Módulo ${module.name}: ${migrationsExecuted} migration(s) e ${seedsExecuted} seed(s) executados`,
            type: 'success',
            metadata: {
                module: slug,
                action: 'database_updated',
                migrationsExecuted,
                seedsExecuted
            }
        });

        return {
            success: true,
            executed: {
                migrations: migrationsExecuted,
                seeds: seedsExecuted
            },
            message: 'Banco de dados atualizado'
        };
    }

    /**
     * Obtém status detalhado de um módulo
     * MANTIDO SEM ALTERAÇÕES
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
     * MANTIDO SEM ALTERAÇÕES
     */
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

    /**
     * Executa migrations ou seeds
     * MANTIDO SEM ALTERAÇÕES
     */
    private async executeMigrations(slug: string, modulePath: string, type: MigrationType): Promise<number> {
        const migrationsPath = path.join(modulePath, type === MigrationType.migration ? 'migrations' : 'seeds');

        if (!fs.existsSync(migrationsPath)) {
            return 0;
        }

        const files = fs.readdirSync(migrationsPath)
            .filter(file => file.endsWith('.sql'))
            .sort();

        const moduleId = (await this.prisma.module.findUnique({ where: { slug } }))!.id;
        let executed = 0;

        for (const file of files) {
            const filePath = path.join(migrationsPath, file);

            // Verifica se já foi executado
            const existing = await this.prisma.moduleMigration.findUnique({
                where: {
                    moduleId_filename_type: {
                        moduleId,
                        filename: file,
                        type
                    }
                }
            });

            if (existing) continue;

            const startTime = Date.now();
            const sql = fs.readFileSync(filePath, 'utf-8');

            try {
                // Executa SQL de forma segura com transação
                await this.dbExecutor.executeInTransaction(sql);

                // Registra execução
                await this.prisma.moduleMigration.create({
                    data: {
                        moduleId,
                        filename: file,
                        type,
                        executedAt: new Date()
                    }
                });

                const duration = Date.now() - startTime;
                this.logger.log(`✅ ${type} ${file} executado em ${duration}ms`);
                executed++;

            } catch (error) {
                this.logger.error(`❌ Erro ao executar ${type} ${file}:`, error);
                throw error;
            }
        }

        return executed;
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

    /**
     * Obtém mensagem de solução para erro de ativação
     */
    private getActivationSolution(currentStatus: ModuleStatus): string {
        switch (currentStatus) {
            case ModuleStatus.detected:
                return 'O módulo precisa ser instalado primeiro';
            case ModuleStatus.installed:
                return 'Execute "Atualizar Banco" antes de ativar';
            case ModuleStatus.active:
                return 'Módulo já está ativo';
            default:
                return 'Verifique o status do módulo';
        }
    }

    /**
     * Desinstala um módulo do sistema
     * 
     * Validações obrigatórias:
     * 1. Módulo deve estar disabled ou installed
     * 2. Nenhum módulo ativo pode depender dele
     * 3. Nenhum tenant pode ter o módulo habilitado
     * 4. Confirmação de nome deve ser exata
     */
    async uninstallModule(
        slug: string,
        options: {
            dataRemovalOption: 'keep' | 'core_only' | 'full';
            confirmationName: string;
        }
    ) {
        this.logger.log(`🗑️ Iniciando desinstalação do módulo: ${slug}`);

        // 1️⃣ VALIDAR MÓDULO EXISTE
        const module = await this.prisma.module.findUnique({
            where: { slug },
            include: {
                tenantModules: true
            }
        });

        if (!module) {
            throw new BadRequestException('Módulo não encontrado');
        }

        // 2️⃣ VALIDAR STATUS
        if (module.status !== ModuleStatus.disabled && module.status !== ModuleStatus.installed) {
            throw new BadRequestException(
                `Módulo deve estar desativado antes de desinstalar. Status atual: ${module.status}`
            );
        }

        // 3️⃣ VALIDAR DEPENDÊNCIAS INVERSAS
        const allModules = await this.prisma.module.findMany({
            where: { status: ModuleStatus.active }
        });

        const dependentModules: string[] = [];

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
            throw new BadRequestException(
                `Não é possível desinstalar. Módulos dependentes: ${dependentModules.join(', ')}. Desative-os primeiro.`
            );
        }

        // 4️⃣ VALIDAR TENANTS ATIVOS
        const activeTenants = module.tenantModules.filter(tm => tm.enabled);

        if (activeTenants.length > 0) {
            throw new BadRequestException(
                `Módulo em uso por ${activeTenants.length} tenant(s). Desabilite o módulo em todos os tenants primeiro.`
            );
        }

        // 5️⃣ VALIDAR CONFIRMAÇÃO DE NOME
        if (options.confirmationName !== slug) {
            throw new BadRequestException(
                'Nome de confirmação incorreto. Digite o slug exato do módulo para confirmar.'
            );
        }

        this.logger.log('✅ Todas as validações passaram');

        // 6️⃣ REMOVER REGISTROS DO CORE (SEMPRE)
        this.logger.log('Removendo registros do CORE do banco de dados...');
        await this.prisma.module.delete({
            where: { slug }
        });
        this.logger.log('✅ Registros do CORE removidos (module, menus, migrations, tenant associations)');

        // 7️⃣ REMOVER ARQUIVOS DO MÓDULO
        const modulePath = path.join(this.modulesPath, slug);

        if (fs.existsSync(modulePath)) {
            this.logger.log(`Removendo arquivos do módulo: ${modulePath}`);
            fs.rmSync(modulePath, { recursive: true, force: true });
            this.logger.log('✅ Arquivos do módulo removidos');
        }

        // 8️⃣ NOTIFICAR
        await this.notificationService.create({
            title: 'Módulo Desinstalado',
            description: `Módulo ${module.name} foi removido do sistema`,
            type: 'warning',
            metadata: {
                module: slug,
                action: 'uninstalled'
            }
        });

        this.logger.log(`✅ Módulo ${slug} desinstalado com sucesso`);

        return {
            success: true,
            removed: {
                coreRecords: true,
                files: modulePath
            },
            message: 'Módulo desinstalado com sucesso'
        };
    }
    /**
     * Recarrega configuração do módulo a partir do disco (module.json)
     * Útil para desenvolvimento ou correções manuais
     */
    async reloadModuleConfig(slug: string) {
        this.logger.log(`🔄 Recarregando configuração do módulo: ${slug}`);

        const modulePath = path.join(this.modulesPath, slug);
        const moduleJsonPath = path.join(modulePath, 'module.json');

        if (!fs.existsSync(moduleJsonPath)) {
            throw new BadRequestException(`Arquivo module.json não encontrado em ${modulePath}`);
        }

        try {
            const moduleJson = this.readModuleJsonSafe(moduleJsonPath);
            const validatedModule = ModuleJsonValidator.validate(moduleJson);

            // Validar que o slug corresponde
            if (validatedModule.name !== slug) {
                throw new BadRequestException(`Nome no module.json (${validatedModule.name}) difere do slug solicitado (${slug})`);
            }

            // 1. Atualizar dados do módulo
            const module = await this.prisma.module.update({
                where: { slug },
                data: {
                    name: validatedModule.displayName,
                    version: validatedModule.version,
                    description: validatedModule.description || ''
                }
            });

            // 2. Atualizar Menus (Strategy: Delete All + Recreate)
            // Primeiro remove menus existentes
            await this.prisma.moduleMenu.deleteMany({
                where: { moduleId: module.id }
            });

            // Recria menus se houver
            if (validatedModule.menus && validatedModule.menus.length > 0) {
                await this.registerModuleMenus(module.id, validatedModule.menus);
                this.logger.log(`✅ ${validatedModule.menus.length} menus recriados`);
            } else {
                this.logger.log('ℹ️ Nenhum menu para registrar');
            }

            this.logger.log(`✅ Configuração do módulo ${slug} recarregada com sucesso`);

            return {
                success: true,
                message: 'Configuração e menus recarregados com sucesso',
                module: {
                    slug: module.slug,
                    version: module.version,
                    menusCount: validatedModule.menus?.length || 0
                }
            };

        } catch (error) {
            this.logger.error(`❌ Erro ao recarregar configuração: ${error.message}`);
            throw new BadRequestException(`Falha ao recarregar configuração: ${error.message}`);
        }
    }
    private readModuleJsonSafe(filePath: string): any {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Remove BOM and trim
        const cleanContent = content.replace(/^\uFEFF/, '').trim();
        return JSON.parse(cleanContent);
    }

    /**
     * Remove diretório de forma robusta com retries
     * Útil no Windows onde arquivos podem estar bloqueados temporariamente
     */
    private async robustRemoveDir(dirPath: string, retries = 5, delay = 1000): Promise<void> {
        for (let i = 0; i < retries; i++) {
            try {
                if (!fs.existsSync(dirPath)) return;

                fs.rmSync(dirPath, { recursive: true, force: true });
                return;
            } catch (err) {
                if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'ENOTEMPTY') {
                    if (i === retries - 1) throw err; // Desiste na última tentativa

                    // Espera um pouco antes de tentar de novo
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err;
                }
            }
        }
    }
}

