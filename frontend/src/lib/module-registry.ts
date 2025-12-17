/**
 * MODULE REGISTRY - SISTEMA DE MÓDULOS FULL STACK
 *
 * PRINCÍPIO DE SEGURANÇA: Frontend NUNCA define módulos
 * Frontend apenas CONSUME dados da API
 *
 * REGRAS INEGOCIÁVEIS:
 * ❌ Frontend NÃO registra módulos
 * ❌ Frontend NÃO define menus
 * ❌ Frontend NÃO conhece permissões
 * ✅ Frontend consome /api/me/modules
 */

import api, { API_URL } from './api';

export interface ModuleMenu {
  label: string;
  icon?: string;
  route: string;
  children?: ModuleMenu[];
}

export interface ModuleData {
  slug: string;
  menus: ModuleMenu[];
}

export interface ModulesResponse {
  modules: ModuleData[];
}

/**
 * Registry simples que consome dados da API
 * Não registra módulos, apenas armazena dados recebidos
 */
class ModuleRegistry {
  private static instance: ModuleRegistry;
  private modules: ModuleData[] = [];
  private isLoaded: boolean = false;

  private constructor() { }

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Carrega módulos da API
   * Deve ser chamado após autenticação
   */
  async loadModules(): Promise<void> {
    try {
      // URL completa para garantir que vai para o backend
      const response = await api.get<ModulesResponse>(`${API_URL}/me/modules`);
      this.modules = response.data.modules;
      this.isLoaded = true;

      console.log('✅ Módulos carregados da API:', this.modules.map(m => m.slug));

    } catch (error) {
      console.error('❌ Erro ao carregar módulos:', error);
      this.modules = [];
      this.isLoaded = false;
    }
  }

  /**
   * Obtém todos os menus dos módulos ativos
   */
  getAllMenus(): ModuleMenu[] {
    if (!this.isLoaded) {
      console.warn('⚠️ Módulos ainda não carregados, chame loadModules() primeiro');
      return [];
    }

    const allMenus: ModuleMenu[] = [];

    for (const module of this.modules) {
      allMenus.push(...module.menus);
    }

    return allMenus;
  }

  /**
   * Obtém menus de um módulo específico
   */
  getModuleMenus(slug: string): ModuleMenu[] {
    const module = this.modules.find(m => m.slug === slug);
    return module ? module.menus : [];
  }

  /**
   * Verifica se um módulo está disponível
   */
  hasModule(slug: string): boolean {
    return this.modules.some(m => m.slug === slug);
  }

  /**
   * Lista todos os módulos disponíveis
   */
  getAvailableModules(): string[] {
    return this.modules.map(m => m.slug);
  }

  /**
   * Força reload dos módulos
   */
  async reload(): Promise<void> {
    this.isLoaded = false;
    await this.loadModules();
  }

  /**
   * Debug: mostra estado atual
   */
  debug(): void {
    console.log('📦 Module Registry Status:');
    console.log('  - Loaded:', this.isLoaded);
    console.log('  - Modules:', this.modules.length);
    this.modules.forEach(module => {
      console.log(`    - ${module.slug}: ${module.menus.length} menus`);
    });
  }
}

// Exporta instância singleton
export const moduleRegistry = ModuleRegistry.getInstance();