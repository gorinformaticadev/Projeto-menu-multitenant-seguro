/**
 * ModuleRegistry - Registro centralizado de módulos
 * Armazena informações sobre todos os módulos carregados
 */

import { ModuleContract, RegisteredModule } from '../contracts/ModuleContract';

/**
 * Registry de módulos (Singleton)
 */
export class ModuleRegistry {
  private static instance: ModuleRegistry;
  private modules: Map<string, RegisteredModule> = new Map();

  private constructor() {}

  /**
   * Obtém instância única do registry
   */
  public static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Registra um módulo no sistema
   * @param module - Contrato do módulo
   * @param status - Status inicial do módulo
   */
  public register(module: ModuleContract, status: RegisteredModule['status'] = 'loading'): void {
    const registered: RegisteredModule = {
      ...module,
      status,
      registeredAt: new Date(),
      updatedAt: new Date(),
    };

    this.modules.set(module.slug, registered);
  }

  /**
   * Atualiza status de um módulo
   * @param slug - Identificador do módulo
   * @param status - Novo status
   * @param error - Erro (se houver)
   */
  public updateStatus(slug: string, status: RegisteredModule['status'], error?: Error): void {
    const module = this.modules.get(slug);
    if (module) {
      module.status = status;
      module.error = error;
      module.updatedAt = new Date();
    }
  }

  /**
   * Obtém um módulo registrado
   * @param slug - Identificador do módulo
   */
  public get(slug: string): RegisteredModule | undefined {
    return this.modules.get(slug);
  }

  /**
   * Lista todos os módulos registrados
   * @param filterStatus - Filtrar por status (opcional)
   */
  public getAll(filterStatus?: RegisteredModule['status']): RegisteredModule[] {
    const modules = Array.from(this.modules.values());
    
    if (filterStatus) {
      return modules.filter(m => m.status === filterStatus);
    }
    
    return modules;
  }

  /**
   * Verifica se um módulo está registrado
   * @param slug - Identificador do módulo
   */
  public has(slug: string): boolean {
    return this.modules.has(slug);
  }

  /**
   * Remove um módulo do registry
   * @param slug - Identificador do módulo
   */
  public unregister(slug: string): boolean {
    return this.modules.delete(slug);
  }

  /**
   * Limpa todos os módulos registrados
   */
  public clear(): void {
    this.modules.clear();
  }

  /**
   * Retorna quantidade de módulos registrados
   */
  public count(): number {
    return this.modules.size;
  }

  /**
   * Retorna slugs de todos os módulos
   */
  public getSlugs(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Retorna módulos ativos
   */
  public getActive(): RegisteredModule[] {
    return this.getAll('active');
  }

  /**
   * Retorna módulos com erro
   */
  public getWithErrors(): RegisteredModule[] {
    return this.getAll('error');
  }

  /**
   * Debug - lista informações de todos os módulos
   */
  public debug(): void {
    console.log('=== Module Registry Debug ===');
    console.log(`Total modules: ${this.count()}`);
    console.log(`Active: ${this.getActive().length}`);
    console.log(`Errors: ${this.getWithErrors().length}`);
    console.log('\nModules:');
    
    this.modules.forEach((module, slug) => {
      console.log(`  - ${slug}: ${module.status} (v${module.version})`);
      if (module.error) {
        console.log(`    Error: ${module.error.message}`);
      }
    });
  }
}

// Exporta instância única
export const moduleRegistry = ModuleRegistry.getInstance();
