import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';

/**
 * Resultado da detecção de estrutura do módulo
 */
export interface ModuleStructureResult {
    /**
     * Caminho base do módulo dentro do ZIP
     * - "" se formato raiz limpa
     * - "nome-pasta/" se formato com pasta raiz
     */
    basePath: string;

    /**
     * Conteúdo do module.json
     */
    moduleJsonContent: string;

    /**
     * Lista de arquivos encontrados no ZIP
     */
    files: string[];

    /**
     * Se possui pasta backend/
     */
    hasBackend: boolean;

    /**
     * Se possui pasta frontend/
     */
    hasFrontend: boolean;
}

/**
 * Validador de estrutura de módulo
 * Detecta e valida a estrutura do ZIP antes da extração
 */
export class ModuleStructureValidator {
    /**
     * Analisa a estrutura de um ZIP de módulo
     * 
     * Suporta dois formatos:
     * 1. Raiz limpa: module.json na raiz do ZIP
     * 2. Pasta raiz: pasta-modulo/module.json
     * 
     * @param zipBuffer Buffer do arquivo ZIP
     * @returns Informações sobre a estrutura do módulo
     */
    static analyzeZipStructure(zipBuffer: Buffer): ModuleStructureResult {
        let zip: AdmZip;

        try {
            zip = new AdmZip(zipBuffer);
        } catch (error) {
            throw new BadRequestException('Arquivo ZIP inválido ou corrompido');
        }

        const entries = zip.getEntries();
        
        if (entries.length === 0) {
            throw new BadRequestException('Arquivo ZIP está vazio');
        }

        // Extrair lista de caminhos
        const files = entries
            .filter(entry => !entry.isDirectory)
            .map(entry => entry.entryName);

        console.log('📦 Arquivos encontrados no ZIP:', files.slice(0, 10));

        // Detectar formato do ZIP
        const result = this.detectModuleFormat(files, zip);

        console.log('✅ Estrutura detectada:', {
            basePath: result.basePath || '(raiz)',
            hasBackend: result.hasBackend,
            hasFrontend: result.hasFrontend,
            totalFiles: files.length
        });

        return result;
    }

    /**
     * Detecta o formato do ZIP e localiza o module.json
     */
    private static detectModuleFormat(files: string[], zip: AdmZip): ModuleStructureResult {
        // FORMATO 1: module.json na raiz
        if (files.includes('module.json')) {
            return this.analyzeRootFormat(files, zip);
        }

        // FORMATO 2: pasta raiz única com module.json dentro
        const rootFolders = this.getRootFolders(files);

        if (rootFolders.length === 0) {
            throw new BadRequestException('ZIP não contém arquivos válidos');
        }

        if (rootFolders.length > 1) {
            throw new BadRequestException(
                `ZIP contém múltiplas pastas raiz: ${rootFolders.join(', ')}. ` +
                `Deve conter apenas uma pasta com o módulo ou arquivos na raiz.`
            );
        }

        const rootFolder = rootFolders[0];
        const moduleJsonPath = `${rootFolder}/module.json`;

        if (!files.includes(moduleJsonPath)) {
            throw new BadRequestException(
                `module.json não encontrado. ` +
                `Esperado em: raiz do ZIP ou ${moduleJsonPath}`
            );
        }

        return this.analyzeFolderFormat(files, zip, rootFolder);
    }

    /**
     * Analisa formato com module.json na raiz
     */
    private static analyzeRootFormat(files: string[], zip: AdmZip): ModuleStructureResult {
        const moduleJsonEntry = zip.getEntry('module.json');
        
        if (!moduleJsonEntry) {
            throw new BadRequestException('Erro ao ler module.json do ZIP');
        }

        const moduleJsonContent = moduleJsonEntry.getData().toString('utf8');

        return {
            basePath: '',
            moduleJsonContent,
            files,
            hasBackend: files.some(f => f.startsWith('backend/')),
            hasFrontend: files.some(f => f.startsWith('frontend/'))
        };
    }

    /**
     * Analisa formato com pasta raiz
     */
    private static analyzeFolderFormat(files: string[], zip: AdmZip, rootFolder: string): ModuleStructureResult {
        const moduleJsonPath = `${rootFolder}/module.json`;
        const moduleJsonEntry = zip.getEntry(moduleJsonPath);

        if (!moduleJsonEntry) {
            throw new BadRequestException(`Erro ao ler ${moduleJsonPath} do ZIP`);
        }

        const moduleJsonContent = moduleJsonEntry.getData().toString('utf8');

        return {
            basePath: rootFolder,
            moduleJsonContent,
            files,
            hasBackend: files.some(f => f.startsWith(`${rootFolder}/backend/`)),
            hasFrontend: files.some(f => f.startsWith(`${rootFolder}/frontend/`))
        };
    }

    /**
     * Obtém pastas raiz do ZIP (primeiro nível de diretórios)
     */
    private static getRootFolders(files: string[]): string[] {
        const folders = new Set<string>();

        for (const file of files) {
            const parts = file.split('/');
            
            // Se tem pelo menos 2 partes (pasta/arquivo), é pasta raiz
            if (parts.length >= 2) {
                folders.add(parts[0]);
            }
        }

        // Ignorar pastas especiais
        const specialFolders = ['__MACOSX', '.git', 'node_modules'];
        return Array.from(folders).filter(f => !specialFolders.includes(f));
    }

    /**
     * Valida se o caminho é seguro (previne Zip Slip)
     */
    static validateSafePath(entryPath: string): void {
        // Normalizar caminho
        const normalized = path.normalize(entryPath);

        // Prevenir paths relativos perigosos
        if (normalized.includes('..')) {
            throw new BadRequestException(
                `Caminho inseguro detectado no ZIP: ${entryPath}`
            );
        }

        // Prevenir caminhos absolutos
        if (path.isAbsolute(normalized)) {
            throw new BadRequestException(
                `Caminho absoluto não permitido no ZIP: ${entryPath}`
            );
        }

        // Prevenir nomes de arquivo perigosos
        const basename = path.basename(normalized);
        const dangerousNames = ['.env', '.git', 'node_modules', 'package-lock.json'];
        
        if (dangerousNames.includes(basename)) {
            throw new BadRequestException(
                `Arquivo não permitido no módulo: ${basename}`
            );
        }
    }

    /**
     * Valida que o módulo não existe ainda
     */
    static validateModuleNotExists(moduleName: string, modulesPath: string): void {
        const modulePath = path.join(modulesPath, moduleName);

        if (fs.existsSync(modulePath)) {
            throw new BadRequestException(
                `Módulo "${moduleName}" já existe. ` +
                `Para atualizar, desinstale a versão atual primeiro.`
            );
        }
    }
}
