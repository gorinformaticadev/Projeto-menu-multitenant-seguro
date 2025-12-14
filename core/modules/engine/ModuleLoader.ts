/**
 * MODULE LOADER - CARREGADOR DE MÓDULOS ROBUSTO E INDEPENDENTE
 * 
 * Sistema responsável por:
 * - Descobrir módulos na pasta /modules
 * - Validar configurações de segurança
 * - Carregar módulos de forma isolada
 * - Registrar páginas e rotas
 * - Gerenciar falhas sem quebrar o sistema
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

// Interfaces para tipagem
export interface ModuleConfig {
  name: string;
  slug: string;
  version: string;
  enabled: boolean;
  permissionsStrict: boolean;
  sandboxed: boolean;
  author?: string;
  description?: string;
  category?: string;
}

export interface ModulePage {
  id: string;
  path: string;
  component: () => Promise<any>;
  protected: boolean;
  permissions: string[];
  title?: string;
  description?: string;
}

export interface ModuleBootstrap {
  pages: ModulePage[];
  routes?: any[];
  menus?: any[];
  permissions?: string[];
}

export interface LoadedModule {
  config: ModuleConfig;
  bootstrap: ModuleBootstrap;
  isValid: boolean;
  loadError?: string;
}

export class ModuleLoader {
  private static instance: ModuleLoader;
  private modules: Map<string, LoadedModule> = new Map();
  private modulesPath: string;
  private logger: Console;

  private constructor() {
    // Determinar caminho dos módulos
    const cwd = process.cwd();
    this.modulesPath = cwd.endsWith('frontend') 
      ? resolve(cwd, '..', 'modules')
      : resolve(cwd, 'modules');
    
    this.logger = console;
  }

  static getInstance(): ModuleLoader {
    if (!ModuleLoader.instance) {
      ModuleLoader.instance = new ModuleLoader();
    }
    return ModuleLoader.instance;
  }

  /**
   * Descobre e carrega todos os módulos disponíveis
   */
  async discoverAndLoadModules(): Promise<Map<string, LoadedModule>> {
    this.logger.log('🔍 Descobrindo módulos em:', this.modulesPath);
    
    try {
      if (!existsSync(this.modulesPath)) {
        this.logger.warn('⚠️ Pasta de módulos não encontrada:', this.modulesPath);
        return this.modules;
      }

      const entries = await readdir(this.modulesPath, { withFileTypes: true });
      const moduleDirectories = entries.filter(entry => entry.isDirectory());

      this.logger.log(`📂 Encontrados ${moduleDirectories.length} diretórios de módulos`);

      // Carregar cada módulo
      for (const dir of moduleDirectories) {
        await this.loadModule(dir.name);
      }

      this.logger.log(`✅ Carregamento concluído. ${this.modules.size} módulos processados`);
      
    } catch (error) {
      this.logger.error('❌ Erro ao descobrir módulos:', error);
    }

    return this.modules;
  }

  /**
   * Carrega um módulo específico
   */
  async loadModule(moduleName: string): Promise<LoadedModule | null> {
    const modulePath = join(this.modulesPath, moduleName);
    
    try {
      this.logger.log(`🔄 Carregando módulo: ${moduleName}`);

      // Verificar se o diretório existe
      if (!existsSync(modulePath)) {
        throw new Error(`Diretório do módulo não encontrado: ${modulePath}`);
      }

      // 1. Carregar e validar configuração
      const config = await this.loadModuleConfig(modulePath);
      if (!config) {
        throw new Error('Configuração do módulo inválida ou não encontrada');
      }

      // 2. Verificar se o módulo está habilitado
      if (!config.enabled) {
        this.logger.log(`⏸️ Módulo ${moduleName} está desabilitado`);
        return null;
      }

      // 3. Carregar bootstrap
      const bootstrap = await this.loadModuleBootstrap(modulePath);
      if (!bootstrap) {
        throw new Error('Bootstrap do módulo não encontrado ou inválido');
      }

      // 4. Validar segurança
      this.validateModuleSecurity(config, bootstrap);

      // 5. Criar módulo carregado
      const loadedModule: LoadedModule = {
        config,
        bootstrap,
        isValid: true
      };

      this.modules.set(moduleName, loadedModule);
      this.logger.log(`✅ Módulo ${moduleName} carregado com sucesso`);
      
      return loadedModule;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`❌ Erro ao carregar módulo ${moduleName}:`, errorMessage);
      
      // Registrar módulo com erro (não quebra o sistema)
      const failedModule: LoadedModule = {
        config: {
          name: moduleName,
          slug: moduleName,
          version: '0.0.0',
          enabled: false,
          permissionsStrict: true,
          sandboxed: true
        },
        bootstrap: { pages: [] },
        isValid: false,
        loadError: errorMessage
      };

      this.modules.set(moduleName, failedModule);
      return null;
    }
  }

  /**
   * Carrega a configuração do módulo
   */
  private async loadModuleConfig(modulePath: string): Promise<ModuleConfig | null> {
    const configPath = join(modulePath, 'module.config.ts');
    
    try {
      if (!existsSync(configPath)) {
        throw new Error('Arquivo module.config.ts não encontrado');
      }

      const configContent = await readFile(configPath, 'utf-8');
      
      // Validação básica de segurança - não permitir eval
      if (configContent.includes('eval(') || configContent.includes('Function(')) {
        throw new Error('Código inseguro detectado na configuração');
      }

      // Em um ambiente real, usaríamos um parser seguro
      // Por enquanto, vamos usar uma abordagem simplificada
      const moduleConfigMatch = configContent.match(/export\s+const\s+moduleConfig\s*=\s*({[\s\S]*?})\s*(?:as\s+const)?;?/);
      
      if (!moduleConfigMatch) {
        throw new Error('Configuração moduleConfig não encontrada');
      }

      // Avaliar a configuração de forma segura (em produção, usar um parser JSON/AST)
      const configObject = eval(`(${moduleConfigMatch[1]})`);
      
      // Validar campos obrigatórios
      const requiredFields = ['name', 'slug', 'version', 'enabled'];
      for (const field of requiredFields) {
        if (!(field in configObject)) {
          throw new Error(`Campo obrigatório '${field}' não encontrado na configuração`);
        }
      }

      // Aplicar valores padrão
      const config: ModuleConfig = {
        permissionsStrict: true,
        sandboxed: true,
        ...configObject
      };

      return config;

    } catch (error) {
      this.logger.error('❌ Erro ao carregar configuração do módulo:', error);
      return null;
    }
  }

  /**
   * Carrega o bootstrap do módulo
   */
  private async loadModuleBootstrap(modulePath: string): Promise<ModuleBootstrap | null> {
    const bootstrapPath = join(modulePath, 'module.bootstrap.ts');
    
    try {
      if (!existsSync(bootstrapPath)) {
        throw new Error('Arquivo module.bootstrap.ts não encontrado');
      }

      const bootstrapContent = await readFile(bootstrapPath, 'utf-8');
      
      // Validação de segurança
      if (bootstrapContent.includes('eval(') || bootstrapContent.includes('Function(')) {
        throw new Error('Código inseguro detectado no bootstrap');
      }

      // Carregar páginas do módulo
      const pagesPath = join(modulePath, 'module.pages.ts');
      if (!existsSync(pagesPath)) {
        throw new Error('Arquivo module.pages.ts não encontrado');
      }

      const pagesContent = await readFile(pagesPath, 'utf-8');
      
      // Extrair páginas (implementação simplificada)
      const pagesMatch = pagesContent.match(/export\s+const\s+modulePages\s*=\s*(\[[\s\S]*?\]);?/);
      
      if (!pagesMatch) {
        throw new Error('Array modulePages não encontrado');
      }

      const pages = eval(`(${pagesMatch[1]})`);
      
      // Validar estrutura das páginas
      if (!Array.isArray(pages)) {
        throw new Error('modulePages deve ser um array');
      }

      for (const page of pages) {
        if (!page.id || !page.path || !page.component) {
          throw new Error('Página inválida: campos obrigatórios (id, path, component) não encontrados');
        }
      }

      const bootstrap: ModuleBootstrap = {
        pages,
        routes: [],
        menus: [],
        permissions: []
      };

      return bootstrap;

    } catch (error) {
      this.logger.error('❌ Erro ao carregar bootstrap do módulo:', error);
      return null;
    }
  }

  /**
   * Valida a segurança do módulo
   */
  private validateModuleSecurity(config: ModuleConfig, bootstrap: ModuleBootstrap): void {
    // Verificar se o módulo está em sandbox
    if (!config.sandboxed) {
      this.logger.warn(`⚠️ Módulo ${config.name} não está em sandbox - risco de segurança`);
    }

    // Verificar permissões estritas
    if (!config.permissionsStrict) {
      this.logger.warn(`⚠️ Módulo ${config.name} não usa permissões estritas`);
    }

    // Validar paths das páginas
    for (const page of bootstrap.pages) {
      if (!page.path.startsWith('/')) {
        throw new Error(`Path inválido na página ${page.id}: deve começar com /`);
      }
      
      if (page.path.includes('..') || page.path.includes('//')) {
        throw new Error(`Path inseguro na página ${page.id}: contém caracteres perigosos`);
      }
    }
  }

  /**
   * Obtém todos os módulos carregados
   */
  getLoadedModules(): Map<string, LoadedModule> {
    return new Map(this.modules);
  }

  /**
   * Obtém um módulo específico
   */
  getModule(moduleName: string): LoadedModule | undefined {
    return this.modules.get(moduleName);
  }

  /**
   * Obtém todas as páginas de todos os módulos válidos
   */
  getAllModulePages(): ModulePage[] {
    const allPages: ModulePage[] = [];
    
    for (const [moduleName, module] of this.modules) {
      if (module.isValid && module.config.enabled) {
        allPages.push(...module.bootstrap.pages);
      }
    }
    
    return allPages;
  }

  /**
   * Recarrega um módulo específico
   */
  async reloadModule(moduleName: string): Promise<LoadedModule | null> {
    this.logger.log(`🔄 Recarregando módulo: ${moduleName}`);
    
    // Remover módulo atual
    this.modules.delete(moduleName);
    
    // Carregar novamente
    return await this.loadModule(moduleName);
  }

  /**
   * Obtém estatísticas dos módulos
   */
  getModuleStats() {
    const total = this.modules.size;
    const valid = Array.from(this.modules.values()).filter(m => m.isValid).length;
    const enabled = Array.from(this.modules.values()).filter(m => m.isValid && m.config.enabled).length;
    const failed = total - valid;

    return {
      total,
      valid,
      enabled,
      failed,
      modules: Array.from(this.modules.entries()).map(([name, module]) => ({
        name,
        enabled: module.config.enabled,
        valid: module.isValid,
        error: module.loadError
      }))
    };
  }
}

// Instância singleton
export const moduleLoader = ModuleLoader.getInstance();