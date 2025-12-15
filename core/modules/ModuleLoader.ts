/**
 * ModuleLoader - Carregador de módulos
 * Responsável por descobrir, validar e inicializar módulos
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModuleContract } from '../contracts/ModuleContract';
import { CoreContext } from '../context/CoreContext';
import { ModuleRegistry, moduleRegistry } from './ModuleRegistry';
import { ModuleValidator } from './ModuleValidator';
import { DependencyResolver } from './DependencyResolver';

/**
 * Opções de carregamento
 */
export interface LoaderOptions {
  /** Diretório onde módulos estão localizados */
  modulesPath: string;
  
  /** Versão do CORE */
  coreVersion: string;
  
  /** Se deve parar ao encontrar erro */
  failOnError?: boolean;
  
  /** Lista de módulos a ignorar */
  ignoreModules?: string[];
}

/**
 * Resultado de carregamento
 */
export interface LoadResult {
  /** Módulos carregados com sucesso */
  loaded: string[];
  
  /** Módulos que falharam */
  failed: Array<{ slug: string; error: Error }>;
  
  /** Módulos ignorados */
  ignored: string[];
  
  /** Tempo total de carregamento (ms) */
  duration: number;
}

/**
 * Carregador de módulos
 */
export class ModuleLoader {
  private registry: ModuleRegistry;
  private options: LoaderOptions;

  constructor(options: LoaderOptions) {
    this.options = {
      failOnError: false,
      ignoreModules: [],
      ...options,
    };
    this.registry = moduleRegistry;
  }

  /**
   * Descobre módulos no diretório especificado
   * Procura por pastas contendo module.json
   */
  private discoverModules(): string[] {
    const modulesPath = this.options.modulesPath;

    if (!fs.existsSync(modulesPath)) {
      console.warn(`Diretório de módulos não encontrado: ${modulesPath}`);
      return [];
    }

    const entries = fs.readdirSync(modulesPath, { withFileTypes: true });
    const modulePaths: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const moduleDir = path.join(modulesPath, entry.name);
      const moduleJsonPath = path.join(moduleDir, 'module.json');

      if (fs.existsSync(moduleJsonPath)) {
        modulePaths.push(moduleDir);
      }
    }

    console.log(`📦 Descobertos ${modulePaths.length} módulos em ${modulesPath}`);
    return modulePaths;
  }

  /**
   * Carrega metadados de um módulo (module.json)
   */
  private async loadModuleMetadata(modulePath: string): Promise<ModuleContract | null> {
    try {
      const moduleJsonPath = path.join(modulePath, 'module.json');
      const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf-8'));

      // Tentar carregar arquivo de boot (index.js ou index.ts)
      const indexPath = fs.existsSync(path.join(modulePath, 'index.js'))
        ? path.join(modulePath, 'index.js')
        : path.join(modulePath, 'index.ts');

      if (!fs.existsSync(indexPath)) {
        throw new Error(`Arquivo de boot não encontrado (index.js ou index.ts)`);
      }

      // Importar módulo dinamicamente
      const moduleExports = await import(indexPath);
      const moduleInstance = moduleExports.default || moduleExports;

      // Combinar metadata do JSON com implementação
      const module: ModuleContract = {
        ...moduleJson,
        boot: moduleInstance.boot?.bind(moduleInstance),
        shutdown: moduleInstance.shutdown?.bind(moduleInstance),
      };

      return module;
    } catch (error) {
      console.error(`Erro ao carregar módulo de ${modulePath}:`, error);
      return null;
    }
  }

  /**
   * Carrega todos os módulos descobertos
   */
  public async loadAll(context: CoreContext): Promise<LoadResult> {
    const startTime = Date.now();
    const result: LoadResult = {
      loaded: [],
      failed: [],
      ignored: [],
      duration: 0,
    };

    console.log('🚀 Iniciando carregamento de módulos...');

    // 1. Descobrir módulos
    const modulePaths = this.discoverModules();

    // 2. Carregar metadados de todos os módulos
    const modules: ModuleContract[] = [];
    
    for (const modulePath of modulePaths) {
      const module = await this.loadModuleMetadata(modulePath);
      
      if (!module) continue;

      // Verificar se deve ignorar
      if (this.options.ignoreModules?.includes(module.slug)) {
        console.log(`⏭️  Ignorando módulo: ${module.slug}`);
        result.ignored.push(module.slug);
        continue;
      }

      // Validar módulo
      try {
        ModuleValidator.validateOrThrow(module);
        
        // Validar versão do CORE se especificada
        if (module.dependencies?.coreVersion) {
          const compatible = ModuleValidator.validateCoreVersion(
            module.dependencies.coreVersion,
            this.options.coreVersion
          );
          
          if (!compatible) {
            throw new Error(
              `Módulo requer CORE v${module.dependencies.coreVersion}, mas versão atual é v${this.options.coreVersion}`
            );
          }
        }

        modules.push(module);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Validação falhou para ${module.slug}:`, err.message);
        result.failed.push({ slug: module.slug, error: err });

        if (this.options.failOnError) {
          throw err;
        }
      }
    }

    // 3. Resolver dependências e ordenar
    let orderedModules: ModuleContract[];
    try {
      console.log('🔗 Resolvendo dependências...');
      orderedModules = DependencyResolver.resolve(modules);
      console.log('✅ Dependências resolvidas com sucesso');
      
      if (process.env.NODE_ENV === 'development') {
        console.log(DependencyResolver.visualize(orderedModules));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('❌ Erro ao resolver dependências:', err.message);
      
      if (this.options.failOnError) {
        throw err;
      }
      
      // Usar ordem original se resolução falhar
      orderedModules = modules;
    }

    // 4. Inicializar módulos em ordem
    console.log(`📋 Inicializando ${orderedModules.length} módulos...`);
    
    for (const module of orderedModules) {
      try {
        // Registrar módulo como loading
        this.registry.register(module, 'loading');
        console.log(`  ⏳ Carregando: ${module.slug} v${module.version}`);

        // Chamar método boot
        await Promise.resolve(module.boot(context));

        // Atualizar status para active
        this.registry.updateStatus(module.slug, 'active');
        result.loaded.push(module.slug);
        console.log(`  ✅ Carregado: ${module.slug}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`  ❌ Erro ao carregar ${module.slug}:`, err.message);
        
        this.registry.updateStatus(module.slug, 'error', err);
        result.failed.push({ slug: module.slug, error: err });

        if (this.options.failOnError) {
          throw err;
        }
      }
    }

    result.duration = Date.now() - startTime;

    // Resumo
    console.log('\n' + '='.repeat(50));
    console.log('📊 Resumo do Carregamento de Módulos');
    console.log('='.repeat(50));
    console.log(`✅ Carregados: ${result.loaded.length}`);
    console.log(`❌ Falharam: ${result.failed.length}`);
    console.log(`⏭️  Ignorados: ${result.ignored.length}`);
    console.log(`⏱️  Tempo: ${result.duration}ms`);
    console.log('='.repeat(50) + '\n');

    if (result.loaded.length > 0) {
      console.log('Módulos ativos:', result.loaded.join(', '));
    }

    return result;
  }

  /**
   * Descarrega todos os módulos (shutdown gracioso)
   */
  public async unloadAll(): Promise<void> {
    console.log('🛑 Descarregando módulos...');

    const modules = this.registry.getActive();

    for (const module of modules.reverse()) {
      try {
        console.log(`  ⏳ Descarregando: ${module.slug}`);
        
        if (module.shutdown) {
          await Promise.resolve(module.shutdown());
        }

        this.registry.updateStatus(module.slug, 'disabled');
        console.log(`  ✅ Descarregado: ${module.slug}`);
      } catch (error) {
        console.error(`  ❌ Erro ao descarregar ${module.slug}:`, error);
      }
    }

    console.log('✅ Todos os módulos foram descarregados');
  }
}
