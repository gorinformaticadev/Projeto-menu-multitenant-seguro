/**
 * CARREGADOR DINÂMICO DE MÓDULOS
 * 
 * Sistema que carrega módulos baseado EXCLUSIVAMENTE no banco de dados
 * SEM listas fixas, SEM hardcoded modules
 * 
 * PRINCÍPIO: O BANCO É A ÚNICA FONTE DE VERDADE
 */

import { moduleRegistry } from '../registry/module-registry';
import { ModuleContribution } from '../types/module.types';

/**
 * Carrega módulos externos baseado nos dados da API
 * Não há lista fixa - os módulos são descobertos dinamicamente
 */
export async function loadExternalModules(): Promise<void> {
  try {
    // Buscar módulos ativos da API
    const response = await fetch('/api/me/modules', {
      credentials: 'include'
    });

    if (!response.ok) {
      console.warn('⚠️ Não foi possível carregar módulos da API');
      return;
    }

    const _data = await response.json();
    const modules = data.modules || [];

    console.log(`📦 ${modules.length} módulo(s) encontrado(s) no banco de dados`);

    // Para cada módulo retornado pela API, tentar carregar sua definição
    for (const module of modules) {
      try {
        await loadModuleDynamically(module);
      } catch (error) {
        console.error(`❌ Erro ao carregar módulo ${module.slug}:`, error);
        // Continua carregando outros módulos mesmo se um falhar
      }
    }

    } catch (error) {
    console.error('❌ Erro ao carregar lista de módulos:', error);
  }
}

/**
 * Carrega um módulo específico dinamicamente
 * Tenta importar o módulo baseado em convenção de nomes
 */
async function loadModuleDynamically(moduleData: unknown): Promise<void> {
  const { slug, name, menus } = moduleData;

  try {
    // Tentar carregar definição do módulo se existir
    // Convenção: @modules/{slug}/frontend/index.ts exporta ModuleContribution
    const _modulePath = `@modules/${slug}/frontend`;

    // Import dinâmico (pode falhar se módulo não tiver definição frontend)
    const moduleDefinition = await import(
      /* webpackIgnore: true */
      `../../../../../packages/modules/${slug}/frontend/index`
    ).catch(() => null);

    if (moduleDefinition && moduleDefinition.default) {
      // Módulo tem definição completa - registrar
      moduleRegistry.register(moduleDefinition.default);
      } else {
      // Módulo não tem definição - criar contribuição básica baseada nos dados da API
      const basicContribution: ModuleContribution = {
        id: slug,
        name: name,
        version: '1.0.0',
        enabled: true,
        sidebar: menus?.map((menu: any, index: number) => ({
          id: menu.id || `${slug}-${index}`,
          name: menu.label,
          href: menu.route,
          icon: menu.icon || 'Package',
          order: menu.order || 50
        })) || [],
        dashboard: []
      };

      moduleRegistry.register(basicContribution);
      }

  } catch (error) {
    console.warn(`⚠️ Não foi possível carregar definição de ${slug}, usando fallback`);

    // Fallback: registrar apenas com dados da API
    const fallbackContribution: ModuleContribution = {
      id: slug,
      name: name,
      version: '1.0.0',
      enabled: true,
      sidebar: menus?.map((menu: any, index: number) => ({
        id: menu.id || `${slug}-${index}`,
        name: menu.label,
        href: menu.route,
        icon: menu.icon || 'Package',
        order: menu.order || 50
      })) || [],
      dashboard: []
    };

    moduleRegistry.register(fallbackContribution);
  }
}
