import { BadRequestException } from '@nestjs/common';

/**
 * Interface do module.json - formato correto especificado
 */
export interface ModuleJson {
    name: string;
    displayName: string;
    version: string;
    description?: string;
    author?: string;
    category?: string;
    enabled?: boolean;
    dependencies?: string[] | null;  // string[] | null conforme especificado
    defaultConfig?: unknown;
    menus?: unknown[];
    [key: string]: unknown;
}

/**
 * Validador de module.json
 * Garante que o arquivo de configuração do módulo é válido
 */
export class ModuleJsonValidator {
    /**
     * Valida o conteúdo do module.json
     */
    static validate(moduleJson: unknown): ModuleJson {
        if (!moduleJson || typeof moduleJson !== 'object') {
            throw new BadRequestException('module.json inválido ou ausente');
        }

        const json = moduleJson as Record<string, unknown>;

        // Validações obrigatórias
        if (typeof json.name !== 'string') {
            throw new BadRequestException('Campo "name" é obrigatório e deve ser uma string');
        }

        if (typeof json.displayName !== 'string') {
            throw new BadRequestException('Campo "displayName" é obrigatório e deve ser uma string');
        }

        if (typeof json.version !== 'string') {
            throw new BadRequestException('Campo "version" é obrigatório e deve ser uma string');
        }

        // Validações opcionais
        if (json.description !== undefined && typeof json.description !== 'string') {
            throw new BadRequestException('Campo "description" deve ser uma string');
        }

        if (json.author !== undefined && typeof json.author !== 'string') {
            throw new BadRequestException('Campo "author" deve ser uma string');
        }

        if (json.category !== undefined && typeof json.category !== 'string') {
            throw new BadRequestException('Campo "category" deve ser uma string');
        }

        if (json.enabled !== undefined && typeof json.enabled !== 'boolean') {
            throw new BadRequestException('Campo "enabled" deve ser um boolean');
        }

        // Validação de dependencies
        if (json.dependencies !== undefined &&
            json.dependencies !== null &&
            !Array.isArray(json.dependencies)) {
            throw new BadRequestException('Campo "dependencies" deve ser um array ou null');
        }

        if (json.dependencies && Array.isArray(json.dependencies)) {
            for (let i = 0; i < json.dependencies.length; i++) {
                const dep = json.dependencies[i];
                if (typeof dep !== 'string') {
                    throw new BadRequestException(`Dependência no índice ${i} deve ser uma string`);
                }
            }
        }

        // Validação de defaultConfig
        if (json.defaultConfig !== undefined &&
            json.defaultConfig !== null &&
            typeof json.defaultConfig !== 'object') {
            throw new BadRequestException('Campo "defaultConfig" deve ser um objeto ou null');
        }

        // Validação de menus
        if (json.menus !== undefined &&
            json.menus !== null &&
            !Array.isArray(json.menus)) {
            throw new BadRequestException('Campo "menus" deve ser um array ou null');
        }

        // Validações de formato
        const nameRegex = /^[a-zA-Z0-9_-]+$/;
        const versionRegex = /^\d+\.\d+\.\d+$/;

        if (!nameRegex.test(json.name)) {
            throw new BadRequestException('Campo "name" deve conter apenas letras, números, hífens e underscores');
        }

        // Validação de tamanho
        if (json.name.length < 2 || json.name.length > 50) {
            throw new BadRequestException('Campo "name" deve ter entre 2 e 50 caracteres');
        }

        // Validação de versão
        if (!versionRegex.test(json.version)) {
            throw new BadRequestException('Campo "version" deve seguir o formato semver (ex: 1.0.0)');
        }

        // Validação de displayName
        if (json.displayName.length < 2 || json.displayName.length > 100) {
            throw new BadRequestException('Campo "displayName" deve ter entre 2 e 100 caracteres');
        }

        // Validação final de dependencies
        if (json.dependencies && Array.isArray(json.dependencies)) {
            for (let i = 0; i < json.dependencies.length; i++) {
                const depSlug = json.dependencies[i];
                if (typeof depSlug !== 'string' || !nameRegex.test(depSlug)) {
                    throw new BadRequestException(`Dependência "${depSlug}" deve seguir o formato de nome válido`);
                }
            }
        }

        return json as ModuleJson;
        }

        // Validar campos obrigatórios
        this.validateRequiredFields(moduleJson);

        // Validar tipos de dados
        this.validateFieldTypes(moduleJson);

        // Validar valores específicos
        this.validateFieldValues(moduleJson);

        return moduleJson as ModuleJson;
    }

    /**
     * Valida presença de campos obrigatórios
     */
    private static validateRequiredFields(moduleJson: unknown): void {
        const requiredFields = ['name', 'displayName', 'version'];
        const missingFields: string[] = [];

        for (const field of requiredFields) {
            if (!moduleJson[field]) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            throw new BadRequestException(
                `Campos obrigatórios ausentes no module.json: ${missingFields.join(', ')}`
            );
        }
    }

    /**
     * Valida tipos de dados dos campos
     */
    private static validateFieldTypes(moduleJson: unknown): void {
        // name: string
        if (typeof moduleJson.name !== 'string') {
            throw new BadRequestException('Campo "name" deve ser string');
        }

        // displayName: string
        if (typeof moduleJson.displayName !== 'string') {
            throw new BadRequestException('Campo "displayName" deve ser string');
        }

        // version: string
        if (typeof moduleJson.version !== 'string') {
            throw new BadRequestException('Campo "version" deve ser string');
        }

        // description: string (opcional)
        if (moduleJson.description !== undefined && typeof moduleJson.description !== 'string') {
            throw new BadRequestException('Campo "description" deve ser string');
        }

        // author: string (opcional)
        if (moduleJson.author !== undefined && typeof moduleJson.author !== 'string') {
            throw new BadRequestException('Campo "author" deve ser string');
        }

        // category: string (opcional)
        if (moduleJson.category !== undefined && typeof moduleJson.category !== 'string') {
            throw new BadRequestException('Campo "category" deve ser string');
        }

        // enabled: boolean (opcional)
        if (moduleJson.enabled !== undefined && typeof moduleJson.enabled !== 'boolean') {
            throw new BadRequestException('Campo "enabled" deve ser boolean');
        }

        // dependencies: string[] | null (opcional)
        if (moduleJson.dependencies !== undefined &&
            moduleJson.dependencies !== null &&
            !Array.isArray(moduleJson.dependencies)) {
            throw new BadRequestException('Campo "dependencies" deve ser array de strings ou null');
        }

        // Validar se dependencies é array de strings
        if (moduleJson.dependencies && Array.isArray(moduleJson.dependencies)) {
            for (let i = 0; i < moduleJson.dependencies.length; i++) {
                const dep = moduleJson.dependencies[i];
                if (typeof dep !== 'string' || dep.trim() === '') {
                    throw new BadRequestException(
                        `Dependência ${i + 1} deve ser string não vazia`
                    );
                }
            }
        }

        // defaultConfig: object (opcional)
        if (moduleJson.defaultConfig !== undefined && 
            moduleJson.defaultConfig !== null && 
            typeof moduleJson.defaultConfig !== 'object') {
            throw new BadRequestException('Campo "defaultConfig" deve ser objeto ou null');
        }

        // menus: array (opcional)
        if (moduleJson.menus !== undefined && 
            moduleJson.menus !== null && 
            !Array.isArray(moduleJson.menus)) {
            throw new BadRequestException('Campo "menus" deve ser array ou null');
        }
    }

    /**
     * Valida valores específicos dos campos
     */
    private static validateFieldValues(moduleJson: unknown): void {
        // name: apenas letras, números, hífen e underscore
        const nameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!nameRegex.test(moduleJson.name)) {
            throw new BadRequestException(
                'Campo "name" deve conter apenas letras, números, hífen e underscore'
            );
        }

        // name: comprimento
        if (moduleJson.name.length < 2 || moduleJson.name.length > 50) {
            throw new BadRequestException('Campo "name" deve ter entre 2 e 50 caracteres');
        }

        // version: formato semântico (X.Y.Z)
        const versionRegex = /^\d+\.\d+\.\d+$/;
        if (!versionRegex.test(moduleJson.version)) {
            throw new BadRequestException(
                'Campo "version" deve seguir formato semântico (ex: 1.0.0)'
            );
        }

        // displayName: comprimento
        if (moduleJson.displayName.length < 2 || moduleJson.displayName.length > 100) {
            throw new BadRequestException('Campo "displayName" deve ter entre 2 e 100 caracteres');
        }

        // Validar que cada dependência é um slug válido
        if (moduleJson.dependencies && Array.isArray(moduleJson.dependencies)) {
            for (let i = 0; i < moduleJson.dependencies.length; i++) {
                const depSlug = moduleJson.dependencies[i];
                const depRegex = /^[a-zA-Z0-9_-]+$/;
                
                if (!depRegex.test(depSlug)) {
                    throw new BadRequestException(
                        `Dependência ${i + 1} (${depSlug}) deve conter apenas letras, números, hífen e underscore`
                    );
                }
            }
        }
    }

    /**
     * Valida que o nome do módulo é seguro para filesystem
     */
    static validateSafeName(name: string): void {
        // Prevenir nomes perigosos
        const dangerousNames = ['.', '..', 'node_modules', 'package.json', '.env'];
        if (dangerousNames.includes(name)) {
            throw new BadRequestException(`Nome de módulo "${name}" não é permitido`);
        }

        // Prevenir paths relativos
        if (name.includes('/') || name.includes('\\')) {
            throw new BadRequestException('Nome de módulo não pode conter separadores de diretório');
        }

        // Validar caracteres seguros
        const safeNameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!safeNameRegex.test(name)) {
            throw new BadRequestException(
                'Nome de módulo deve conter apenas letras, números, hífen e underscore'
            );
        }
    }
}
