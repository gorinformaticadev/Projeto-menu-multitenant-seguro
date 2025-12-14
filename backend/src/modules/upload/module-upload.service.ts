import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuleValidator, ValidationResult } from '../validation/module-validator.service';
import { SafeConfigParser } from '../security/safe-config-parser.service';
import * as AdmZip from 'adm-zip';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

/**
 * MODULE UPLOAD SERVICE - Serviço de Upload de Módulos
 * 
 * Responsável por:
 * - Receber arquivo ZIP do módulo
 * - Extrair e validar conteúdo
 * - Executar validações de segurança
 * - Salvar no banco de dados
 * - Mover arquivos para pasta definitiva
 */

export interface UploadModuleDto {
    file: Express.Multer.File;
    uploadedBy: string;
}

export interface UploadResult {
    success: boolean;
    moduleId?: string;
    slug?: string;
    validation: ValidationResult;
    message: string;
}

@Injectable()
export class ModuleUploadService {
    private readonly logger = new Logger(ModuleUploadService.name);
    private readonly uploadDir = path.join(process.cwd(), '..', 'uploads', 'modules');
    private readonly modulesDir = path.join(process.cwd(), '..', 'modules');
    private readonly maxFileSize = 50 * 1024 * 1024; // 50MB

    constructor(
        private readonly prisma: PrismaService,
        private readonly validator: ModuleValidator,
        private readonly configParser: SafeConfigParser
    ) {
        this.ensureDirectories();
    }

    /**
     * Processa upload de módulo
     */
    async uploadModule(dto: UploadModuleDto): Promise<UploadResult> {
        this.logger.log(`Iniciando upload de módulo por usuário: ${dto.uploadedBy}`);

        try {
            // 1. Validar arquivo
            this.validateFile(dto.file);

            // 2. Salvar temporariamente
            const tempPath = await this.saveTempFile(dto.file);

            // 3. Extrair ZIP
            const extractedFiles = await this.extractZip(tempPath);

            // 4. Validar módulo
            const validation = await this.validator.validateModule(extractedFiles);

            if (!validation.valid) {
                await this.cleanup(tempPath);
                return {
                    success: false,
                    validation,
                    message: 'Módulo não passou na validação'
                };
            }

            // 5. Parsear configuração
            const config = this.configParser.parseModuleConfig(
                extractedFiles.get('module.config.ts')
            );

            if (!config) {
                await this.cleanup(tempPath);
                throw new BadRequestException('Configuração do módulo inválida');
            }

            // 6. Verificar se módulo já existe
            const existing = await this.prisma.moduleUpload.findUnique({
                where: { slug: config.slug }
            });

            if (existing) {
                await this.cleanup(tempPath);
                throw new BadRequestException(
                    `Módulo com slug '${config.slug}' já existe`
                );
            }

            // 7. Calcular hash do arquivo
            const fileHash = await this.calculateFileHash(tempPath);

            // 8. Salvar no banco
            const moduleUpload = await this.saveToDatabase(
                config,
                extractedFiles,
                validation,
                dto.uploadedBy,
                tempPath,
                fileHash
            );

            // 9. Mover para pasta definitiva
            await this.moveToModulesDir(tempPath, config.slug);

            this.logger.log(`Módulo ${config.slug} enviado com sucesso!`);

            return {
                success: true,
                moduleId: moduleUpload.id,
                slug: moduleUpload.slug,
                validation,
                message: 'Módulo enviado com sucesso! Aguardando validação.'
            };

        } catch (error) {
            this.logger.error('Erro ao processar upload:', error);
            throw error;
        }
    }

    /**
     * Valida arquivo enviado
     */
    private validateFile(file: Express.Multer.File): void {
        if (!file) {
            throw new BadRequestException('Nenhum arquivo enviado');
        }

        if (file.size > this.maxFileSize) {
            throw new BadRequestException(
                `Arquivo muito grande. Máximo: ${this.maxFileSize / 1024 / 1024}MB`
            );
        }

        if (!file.originalname.endsWith('.zip')) {
            throw new BadRequestException('Apenas arquivos .zip são permitidos');
        }
    }

    /**
     * Salva arquivo temporariamente
     */
    private async saveTempFile(file: Express.Multer.File): Promise<string> {
        const filename = `${Date.now()}-${file.originalname}`;
        const filepath = path.join(this.uploadDir, filename);

        await fs.writeFile(filepath, file.buffer);

        return filepath;
    }

    /**
     * Extrai conteúdo do ZIP
     */
    private async extractZip(zipPath: string): Promise<Map<string, string>> {
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        const files = new Map<string, string>();

        for (const entry of zipEntries) {
            if (!entry.isDirectory) {
                const content = entry.getData().toString('utf8');
                const filename = entry.entryName;

                // Armazenar apenas arquivos relevantes
                if (
                    filename.endsWith('.ts') ||
                    filename.endsWith('.js') ||
                    filename.endsWith('.json')
                ) {
                    files.set(filename, content);
                }
            }
        }

        return files;
    }

    /**
     * Calcula hash SHA256 do arquivo
     */
    private async calculateFileHash(filepath: string): Promise<string> {
        const buffer = await fs.readFile(filepath);
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Salva módulo no banco de dados
     */
    private async saveToDatabase(
        config: any,
        files: Map<string, string>,
        validation: ValidationResult,
        uploadedBy: string,
        filePath: string,
        fileHash: string
    ) {
        // Parsear páginas
        const pagesContent = files.get('module.pages.ts');
        const pages = pagesContent
            ? this.configParser.parseModulePages(pagesContent)
            : [];

        // Criar módulo
        const moduleUpload = await this.prisma.moduleUpload.create({
            data: {
                slug: config.slug,
                name: config.name,
                version: config.version,
                description: config.description,
                author: config.author,
                category: config.category,
                enabled: false, // Sempre inicia desabilitado
                validated: validation.valid && validation.score >= 80,
                sandboxed: config.sandboxed,
                permissionsStrict: config.permissionsStrict,
                uploadedBy,
                filePath,
                fileHash,
                configJson: JSON.stringify(config),
                securityFlags: JSON.stringify({
                    allowEval: config.allowEval || false,
                    allowWindowAccess: config.allowWindowAccess || false,
                    requiresAuth: config.requiresAuth || true
                }),
                validationReport: JSON.stringify(validation)
            }
        });

        // Criar páginas
        if (pages && pages.length > 0) {
            await this.prisma.moduleUploadPage.createMany({
                data: pages.map(page => ({
                    moduleId: moduleUpload.id,
                    pageId: page.id,
                    path: page.path,
                    title: page.title,
                    description: page.description,
                    component: page.component,
                    protected: page.protected,
                    permissions: JSON.stringify(page.permissions || [])
                }))
            });
        }

        return moduleUpload;
    }

    /**
     * Move arquivo para pasta de módulos
     */
    private async moveToModulesDir(
        tempPath: string,
        slug: string
    ): Promise<void> {
        const destDir = path.join(this.modulesDir, slug);
        const destPath = path.join(destDir, `${slug}.zip`);

        // Criar diretório do módulo
        await fs.mkdir(destDir, { recursive: true });

        // Copiar arquivo
        await fs.copyFile(tempPath, destPath);

        // Remover temporário
        await fs.unlink(tempPath);
    }

    /**
     * Limpa arquivos temporários
     */
    private async cleanup(filepath: string): Promise<void> {
        try {
            if (existsSync(filepath)) {
                await fs.unlink(filepath);
            }
        } catch (error) {
            this.logger.warn('Erro ao limpar arquivo temporário:', error);
        }
    }

    /**
     * Garante que diretórios existem
     */
    private async ensureDirectories(): Promise<void> {
        await fs.mkdir(this.uploadDir, { recursive: true });
        await fs.mkdir(this.modulesDir, { recursive: true });
    }
}
