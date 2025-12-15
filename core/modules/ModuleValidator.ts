/**
 * ModuleValidator - Validador de contratos de módulo
 * Valida se módulos implementam corretamente o ModuleContract
 */

import { ModuleContract } from '../contracts/ModuleContract';

/**
 * Resultado de validação
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validador de módulos
 */
export class ModuleValidator {
  /**
   * Valida se um objeto implementa corretamente o ModuleContract
   * @param module - Objeto a ser validado
   * @returns Resultado da validação
   */
  public static validate(module: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verificar se module existe
    if (!module) {
      errors.push('Módulo não pode ser null ou undefined');
      return { valid: false, errors, warnings };
    }

    // Validar campos obrigatórios de identificação
    if (!module.name || typeof module.name !== 'string') {
      errors.push('Campo "name" é obrigatório e deve ser string');
    }

    if (!module.slug || typeof module.slug !== 'string') {
      errors.push('Campo "slug" é obrigatório e deve ser string');
    } else if (!/^[a-z0-9-]+$/.test(module.slug)) {
      errors.push('Campo "slug" deve conter apenas letras minúsculas, números e hífens');
    }

    if (!module.version || typeof module.version !== 'string') {
      errors.push('Campo "version" é obrigatório e deve ser string');
    } else if (!/^\d+\.\d+\.\d+/.test(module.version)) {
      warnings.push('Campo "version" não segue o padrão semver (x.y.z)');
    }

    // Validar metadados obrigatórios
    if (!module.displayName || typeof module.displayName !== 'string') {
      errors.push('Campo "displayName" é obrigatório e deve ser string');
    }

    if (!module.description || typeof module.description !== 'string') {
      errors.push('Campo "description" é obrigatório e deve ser string');
    }

    if (!module.author || typeof module.author !== 'string') {
      errors.push('Campo "author" é obrigatório e deve ser string');
    }

    // Validar método boot (obrigatório)
    if (!module.boot || typeof module.boot !== 'function') {
      errors.push('Método "boot" é obrigatório e deve ser uma função');
    }

    // Validar método shutdown (opcional)
    if (module.shutdown && typeof module.shutdown !== 'function') {
      errors.push('Método "shutdown" deve ser uma função');
    }

    // Validar dependências (opcional)
    if (module.dependencies) {
      if (typeof module.dependencies !== 'object') {
        errors.push('Campo "dependencies" deve ser um objeto');
      } else {
        if (module.dependencies.modules && !Array.isArray(module.dependencies.modules)) {
          errors.push('Campo "dependencies.modules" deve ser um array');
        }

        if (module.dependencies.coreVersion && typeof module.dependencies.coreVersion !== 'string') {
          errors.push('Campo "dependencies.coreVersion" deve ser uma string');
        }
      }
    }

    // Validar enabled (opcional)
    if (module.enabled !== undefined && typeof module.enabled !== 'boolean') {
      errors.push('Campo "enabled" deve ser boolean');
    }

    // Validar defaultConfig (opcional)
    if (module.defaultConfig !== undefined && typeof module.defaultConfig !== 'object') {
      errors.push('Campo "defaultConfig" deve ser um objeto');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valida e lança erro se inválido
   * @param module - Módulo a ser validado
   * @throws Error se módulo inválido
   */
  public static validateOrThrow(module: any): asserts module is ModuleContract {
    const result = this.validate(module);

    if (!result.valid) {
      const errorMessage = [
        'Módulo inválido:',
        ...result.errors.map(e => `  - ${e}`),
      ].join('\n');

      throw new Error(errorMessage);
    }

    // Exibir warnings se houver
    if (result.warnings.length > 0) {
      console.warn('Avisos de validação do módulo:');
      result.warnings.forEach(w => console.warn(`  - ${w}`));
    }
  }

  /**
   * Valida compatibilidade de versão do CORE
   * @param requiredVersion - Versão requerida pelo módulo
   * @param coreVersion - Versão atual do CORE
   * @returns true se compatível
   */
  public static validateCoreVersion(requiredVersion: string, coreVersion: string): boolean {
    try {
      const [reqMajor, reqMinor] = requiredVersion.split('.').map(Number);
      const [coreMajor, coreMinor] = coreVersion.split('.').map(Number);

      // Major version deve ser igual
      if (reqMajor !== coreMajor) {
        return false;
      }

      // Minor version do core deve ser >= requerida
      return coreMinor >= reqMinor;
    } catch {
      console.warn(`Não foi possível validar versão: ${requiredVersion} vs ${coreVersion}`);
      return true; // Assume compatível se não conseguir validar
    }
  }
}
