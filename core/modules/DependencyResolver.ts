/**
 * DependencyResolver - Resolvedor de dependências entre módulos
 * Cria ordem de carregamento baseada em dependências
 */

import { ModuleContract } from '../contracts/ModuleContract';

/**
 * Grafo de dependências
 */
interface DependencyGraph {
  [moduleSlug: string]: string[];
}

/**
 * Resolvedor de dependências
 */
export class DependencyResolver {
  /**
   * Resolve ordem de carregamento dos módulos baseado em dependências
   * Usa ordenação topológica (Kahn's algorithm)
   * 
   * @param modules - Lista de módulos a serem ordenados
   * @returns Módulos ordenados por dependências
   * @throws Error se houver dependências circulares ou faltantes
   */
  public static resolve(modules: ModuleContract[]): ModuleContract[] {
    // Criar mapa de módulos por slug
    const moduleMap = new Map<string, ModuleContract>();
    modules.forEach(m => moduleMap.set(m.slug, m));

    // Construir grafo de dependências
    const graph: DependencyGraph = {};
    const inDegree: { [slug: string]: number } = {};

    // Inicializar grafo
    modules.forEach(module => {
      graph[module.slug] = module.dependencies?.modules || [];
      inDegree[module.slug] = 0;
    });

    // Calcular grau de entrada (quantas dependências cada módulo tem)
    modules.forEach(module => {
      const deps = module.dependencies?.modules || [];
      
      deps.forEach(depSlug => {
        // Verificar se dependência existe
        if (!moduleMap.has(depSlug)) {
          throw new Error(
            `Módulo "${module.slug}" depende de "${depSlug}", mas este módulo não está disponível`
          );
        }
        
        inDegree[depSlug] = (inDegree[depSlug] || 0) + 1;
      });
    });

    // Ordenação topológica (Kahn's algorithm)
    const queue: string[] = [];
    const result: ModuleContract[] = [];

    // Adicionar módulos sem dependências à fila
    Object.keys(inDegree).forEach(slug => {
      if (inDegree[slug] === 0) {
        queue.push(slug);
      }
    });

    // Processar fila
    while (queue.length > 0) {
      const currentSlug = queue.shift()!;
      const currentModule = moduleMap.get(currentSlug)!;
      result.push(currentModule);

      // Processar dependências do módulo atual
      const deps = graph[currentSlug] || [];
      deps.forEach(depSlug => {
        inDegree[depSlug]--;
        
        if (inDegree[depSlug] === 0) {
          queue.push(depSlug);
        }
      });
    }

    // Verificar se todos os módulos foram processados
    // Se não, há dependências circulares
    if (result.length !== modules.length) {
      const unprocessed = modules
        .filter(m => !result.includes(m))
        .map(m => m.slug)
        .join(', ');
      
      throw new Error(
        `Dependências circulares detectadas nos módulos: ${unprocessed}`
      );
    }

    return result;
  }

  /**
   * Verifica se há dependências circulares
   * @param modules - Lista de módulos
   * @returns true se houver ciclos
   */
  public static hasCircularDependencies(modules: ModuleContract[]): boolean {
    try {
      this.resolve(modules);
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return message.includes('circulares');
    }
  }

  /**
   * Valida todas as dependências de um módulo
   * @param module - Módulo a validar
   * @param availableModules - Módulos disponíveis
   * @returns Lista de dependências faltantes
   */
  public static validateDependencies(
    module: ModuleContract,
    availableModules: ModuleContract[]
  ): string[] {
    const deps = module.dependencies?.modules || [];
    const availableSlugs = new Set(availableModules.map(m => m.slug));
    
    return deps.filter(dep => !availableSlugs.has(dep));
  }

  /**
   * Retorna módulos que dependem de um módulo específico
   * @param moduleSlug - Slug do módulo
   * @param allModules - Todos os módulos
   * @returns Módulos dependentes
   */
  public static getDependents(
    moduleSlug: string,
    allModules: ModuleContract[]
  ): ModuleContract[] {
    return allModules.filter(m => {
      const deps = m.dependencies?.modules || [];
      return deps.includes(moduleSlug);
    });
  }

  /**
   * Cria visualização do grafo de dependências (para debug)
   * @param modules - Lista de módulos
   * @returns String representando o grafo
   */
  public static visualize(modules: ModuleContract[]): string {
    const lines: string[] = ['Grafo de Dependências:', ''];

    modules.forEach(module => {
      const deps = module.dependencies?.modules || [];
      
      if (deps.length === 0) {
        lines.push(`  ${module.slug} (sem dependências)`);
      } else {
        lines.push(`  ${module.slug} depende de:`);
        deps.forEach(dep => {
          lines.push(`    → ${dep}`);
        });
      }
    });

    return lines.join('\n');
  }
}
