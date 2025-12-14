import { Injectable, Logger } from '@nestjs/common';
import { SafeConfigParser, ModuleConfigParsed, ModulePageParsed } from '../security/safe-config-parser.service';

/**
 * MODULE VALIDATOR - Validador de Módulos
 * 
 * Valida estrutura, segurança e conformidade dos módulos
 * antes de serem ativados no sistema
 */

export interface ValidationResult {
    valid: boolean;
    score: number; // 0-100
    errors: ValidationError[];
    warnings: ValidationWarning[];
    checks: ValidationCheck[];
}

export interface ValidationError {
    code: string;
    message: string;
    severity: 'critical' | 'high' | 'medium';
    file?: string;
}

export interface ValidationWarning {
    code: string;
    message: string;
    recommendation: string;
}

export interface ValidationCheck {
    name: string;
    passed: boolean;
    message: string;
}

@Injectable()
export class ModuleValidator {
    private readonly logger = new Logger(ModuleValidator.name);

    constructor(private readonly configParser: SafeConfigParser) { }

    /**
     * Valida módulo completo
     */
    async validateModule(
        moduleFiles: Map<string, string>
    ): Promise<ValidationResult> {
        const result: ValidationResult = {
            valid: true,
            score: 100,
            errors: [],
            warnings: [],
            checks: []
        };

        // 1. Validar estrutura de arquivos obrigatórios
        this.validateFileStructure(moduleFiles, result);

        // 2. Validar conteúdo dos arquivos
        if (result.valid) {
            await this.validateFileContents(moduleFiles, result);
        }

        // 3. Validar configuração de segurança
        if (result.valid) {
            this.validateSecurityConfig(moduleFiles, result);
        }

        // 4. Validar paths e rotas
        if (result.valid) {
            this.validatePathsAndRoutes(moduleFiles, result);
        }

        // Calcular score final
        result.score = this.calculateScore(result);
        result.valid = result.errors.length === 0 && result.score >= 70;

        return result;
    }

    /**
     * Valida estrutura de arquivos obrigatórios
     */
    private validateFileStructure(
        moduleFiles: Map<string, string>,
        result: ValidationResult
    ): void {
        const requiredFiles = [
            'module.config.ts',
            'module.bootstrap.ts',
            'module.pages.ts'
        ];

        for (const file of requiredFiles) {
            if (!moduleFiles.has(file)) {
                result.errors.push({
                    code: 'MISSING_FILE',
                    message: `Arquivo obrigatório '${file}' não encontrado`,
                    severity: 'critical',
                    file
                });
                result.valid = false;
            } else {
                result.checks.push({
                    name: `Arquivo ${file}`,
                    passed: true,
                    message: 'Arquivo encontrado'
                });
            }
        }
    }

    /**
     * Valida conteúdo dos arquivos
     */
    private async validateFileContents(
        moduleFiles: Map<string, string>,
        result: ValidationResult
    ): Promise<void> {
        // Validar module.config.ts
        const configContent = moduleFiles.get('module.config.ts');
        if (configContent) {
            this.validateConfigContent(configContent, result);
        }

        // Validar module.pages.ts
        const pagesContent = moduleFiles.get('module.pages.ts');
        if (pagesContent) {
            this.validatePagesContent(pagesContent, result);
        }

        // Validar todos os arquivos para código inseguro
        for (const [filename, content] of moduleFiles) {
            this.validateSecureCode(filename, content, result);
        }
    }

    /**
     * Valida conteúdo do module.config.ts
     */
    private validateConfigContent(
        content: string,
        result: ValidationResult
    ): void {
        const config = this.configParser.parseModuleConfig(content);

        if (!config) {
            result.errors.push({
                code: 'INVALID_CONFIG',
                message: 'Não foi possível parsear module.config.ts',
                severity: 'critical',
                file: 'module.config.ts'
            });
            result.valid = false;
            return;
        }

        result.checks.push({
            name: 'Configuração válida',
            passed: true,
            message: 'module.config.ts parseado com sucesso'
        });

        // Validar campos obrigatórios
        const requiredFields = ['name', 'slug', 'version', 'enabled'];
        for (const field of requiredFields) {
            if (!config[field]) {
                result.errors.push({
                    code: 'MISSING_CONFIG_FIELD',
                    message: `Campo obrigatório '${field}' não encontrado em module.config.ts`,
                    severity: 'high',
                    file: 'module.config.ts'
                });
                result.valid = false;
            }
        }
    }

    /**
     * Valida conteúdo do module.pages.ts
     */
    private validatePagesContent(
        content: string,
        result: ValidationResult
    ): void {
        const pages = this.configParser.parseModulePages(content);

        if (!pages) {
            result.errors.push({
                code: 'INVALID_PAGES',
                message: 'Não foi possível parsear module.pages.ts',
                severity: 'critical',
                file: 'module.pages.ts'
            });
            result.valid = false;
            return;
        }

        if (pages.length === 0) {
            result.warnings.push({
                code: 'NO_PAGES',
                message: 'Módulo não declara nenhuma página',
                recommendation: 'Adicione pelo menos uma página em module.pages.ts'
            });
        }

        result.checks.push({
            name: 'Páginas válidas',
            passed: true,
            message: `${pages.length} página(s) encontrada(s)`
        });
    }

    /**
     * Valida código seguro (sem eval, Function, etc)
     */
    private validateSecureCode(
        filename: string,
        content: string,
        result: ValidationResult
    ): void {
        const dangerousPatterns = [
            { pattern: /eval\s*\(/g, name: 'eval()' },
            { pattern: /Function\s*\(/g, name: 'Function()' },
            { pattern: /new\s+Function/g, name: 'new Function' },
            { pattern: /setTimeout\s*\(\s*["'`]/g, name: 'setTimeout com string' },
            { pattern: /setInterval\s*\(\s*["'`]/g, name: 'setInterval com string' },
        ];

        for (const { pattern, name } of dangerousPatterns) {
            if (pattern.test(content)) {
                result.errors.push({
                    code: 'UNSAFE_CODE',
                    message: `Código inseguro detectado: ${name}`,
                    severity: 'critical',
                    file: filename
                });
                result.valid = false;
            }
        }

        result.checks.push({
            name: `Segurança de código - ${filename}`,
            passed: true,
            message: 'Nenhum padrão inseguro detectado'
        });
    }

    /**
     * Valida configuração de segurança
     */
    private validateSecurityConfig(
        moduleFiles: Map<string, string>,
        result: ValidationResult
    ): void {
        const configContent = moduleFiles.get('module.config.ts');
        if (!configContent) return;

        const config = this.configParser.parseModuleConfig(configContent);
        if (!config) return;

        // Verificar sandboxed
        if (!config.sandboxed) {
            result.errors.push({
                code: 'NOT_SANDBOXED',
                message: 'Módulo deve ter sandboxed: true',
                severity: 'critical',
                file: 'module.config.ts'
            });
            result.valid = false;
        } else {
            result.checks.push({
                name: 'Sandbox ativo',
                passed: true,
                message: 'Módulo configurado para execução em sandbox'
            });
        }

        // Verificar permissionsStrict
        if (!config.permissionsStrict) {
            result.warnings.push({
                code: 'PERMISSIONS_NOT_STRICT',
                message: 'Recomendado usar permissionsStrict: true',
                recommendation: 'Ative permissões estritas para maior segurança'
            });
        } else {
            result.checks.push({
                name: 'Permissões estritas',
                passed: true,
                message: 'Módulo usa permissões estritas'
            });
        }

        // Verificar allowEval
        if (config.allowEval) {
            result.errors.push({
                code: 'EVAL_ALLOWED',
                message: 'allowEval: true não é permitido',
                severity: 'critical',
                file: 'module.config.ts'
            });
            result.valid = false;
        }
    }

    /**
     * Valida paths e rotas
     */
    private validatePathsAndRoutes(
        moduleFiles: Map<string, string>,
        result: ValidationResult
    ): void {
        const pagesContent = moduleFiles.get('module.pages.ts');
        if (!pagesContent) return;

        const pages = this.configParser.parseModulePages(pagesContent);
        if (!pages) return;

        for (const page of pages) {
            // Validar path
            if (!page.path.startsWith('/')) {
                result.errors.push({
                    code: 'INVALID_PATH',
                    message: `Path '${page.path}' deve começar com /`,
                    severity: 'high',
                    file: 'module.pages.ts'
                });
                result.valid = false;
            }

            // Verificar path traversal
            if (page.path.includes('..') || page.path.includes('//')) {
                result.errors.push({
                    code: 'UNSAFE_PATH',
                    message: `Path '${page.path}' contém caracteres perigosos`,
                    severity: 'critical',
                    file: 'module.pages.ts'
                });
                result.valid = false;
            }
        }

        result.checks.push({
            name: 'Paths seguros',
            passed: true,
            message: 'Todos os paths são válidos e seguros'
        });
    }

    /**
     * Calcula score de segurança (0-100)
     */
    private calculateScore(result: ValidationResult): number {
        let score = 100;

        // Penalidades por erros
        for (const error of result.errors) {
            switch (error.severity) {
                case 'critical':
                    score -= 30;
                    break;
                case 'high':
                    score -= 20;
                    break;
                case 'medium':
                    score -= 10;
                    break;
            }
        }

        // Penalidades por warnings
        score -= result.warnings.length * 5;

        return Math.max(0, score);
    }
}
