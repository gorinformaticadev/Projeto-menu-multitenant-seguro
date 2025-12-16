import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { ModuleValidator, ValidationResult } from '../validation/module-validator.service';
import { SafeConfigParser } from '../security/safe-config-parser.service';
import * as AdmZip from 'adm-zip';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

/**
 * MODULE UPLOAD SERVICE - ServiÃ§o de Upload de MÃ³dulos
 * 
 * ResponsÃ¡vel por:
 * - Receber arquivo ZIP do mÃ³dulo
 * - Extrair e validar conteÃºdo
 * - Executar validaÃ§Ãµes de seguranÃ§a
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
     * Processa upload de mÃ³dulo
     */
    async uploadModule(dto: UploadModuleDto): Promise<UploadResult> {
        this.logger.log(`Iniciando upload de mÃ³dulo por usuÃ¡rio: ${dto.uploadedBy}`);

        try {
            // 1. Validar arquivo
            this.validateFile(dto.file);

            // 2. Salvar temporariamente
            const tempPath = await this.saveTempFile(dto.file);

            // 3. Extrair ZIP
            const extractedFiles = await this.extractZip(tempPath);

            // 4. Validar mÃ³dulo
            const validation = await this.validator.validateModule(extractedFiles);

            if (!validation.valid) {
                await this.cleanup(tempPath);
                return {
                    success: false,
                    validation,
                    message: 'MÃ³dulo nÃ£o passou na validaÃ§Ã£o'
                };
            }

            // 5. Parsear configuraÃ§Ã£o
            const config = this.configParser.parseModuleConfig(
                extractedFiles.get('module.config.ts')
            );

            if (!config) {
                await this.cleanup(tempPath);
                throw new BadRequestException('ConfiguraÃ§Ã£o do mÃ³dulo invÃ¡lida');
            }

            // 6. Verificar se mÃ³dulo jÃ¡ existe
            const existing = await this.prisma.moduleUpload.findUnique({
                where: { slug: config.slug }
            });

            if (existing) {
                await this.cleanup(tempPath);
                throw new BadRequestException(
                    `MÃ³dulo com slug '${config.slug}' jÃ¡ existe`
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

            this.logger.log(`MÃ³dulo ${config.slug} enviado com sucesso!`);

            return {
                success: true,
                moduleId: moduleUpload.id,
                slug: moduleUpload.slug,
                validation,
                message: 'MÃ³dulo enviado com sucesso! Aguardando validaÃ§Ã£o.'
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
                `Arquivo muito grande. MÃ¡ximo: ${this.maxFileSize / 1024 / 1024}MB`
            );
        }

        if (!file.originalname.endsWith('.zip')) {
            throw new BadRequestException('Apenas arquivos .zip sÃ£o permitidos');
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
     * Extrai conteÃºdo do ZIP
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
     * Salva mÃ³dulo no banco de dados
     */
    private async saveToDatabase(
        config: any,
        files: Map<string, string>,
        validation: ValidationResult,
        uploadedBy: string,
        filePath: string,
        fileHash: string
    ) {
        // Parsear pÃ¡ginas
        const pagesContent = files.get('module.pages.ts');
        const pages = pagesContent
            ? this.configParser.parseModulePages(pagesContent)
            : [];

        // Criar mÃ³dulo
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

        // Criar pÃ¡ginas
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
     * Move arquivo para pasta de mÃ³dulos
     */
    private async moveToModulesDir(
        tempPath: string,
        slug: string
    ): Promise<void> {
        const destDir = path.join(this.modulesDir, slug);
        const destPath = path.join(destDir, `${slug}.zip`);

        // Criar diretÃ³rio do mÃ³dulo
        await fs.mkdir(destDir, { recursive: true });

        // Copiar arquivo
        await fs.copyFile(tempPath, destPath);

        // Remover temporÃ¡rio
        await fs.unlink(tempPath);
    }

    /**
     * Limpa arquivos temporÃ¡rios
     */
    private async cleanup(filepath: string): Promise<void> {
        try {
            if (existsSync(filepath)) {
                await fs.unlink(filepath);
            }
        } catch (error) {
            this.logger.warn('Erro ao limpar arquivo temporÃ¡rio:', error);
        }
    }

    /**
     * Garante que diretÃ³rios existem
     */
    private async ensureDirectories(): Promise<void> {
        await fs.mkdir(this.uploadDir, { recursive: true });
        await fs.mkdir(this.modulesDir, { recursive: true });
    }
}

