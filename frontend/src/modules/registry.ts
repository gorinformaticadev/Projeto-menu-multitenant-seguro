/**
 * REGISTRY DE COMPONENTES - GERADO AUTOMATICAMENTE
 *
 * Este arquivo é gerado pelo script register-frontend-modules.js
 * NÃO EDITE MANUALMENTE
 *
 * Atualizado em: 2025-12-18T00:00:00.000Z
 */

// Imports dinâmicos para lazy loading
export const modulePages: Record<string, Record<string, () => Promise<any>>> = {
  // Módulos instalados aparecerão aqui
};

// Função helper para resolver componente
export async function resolveModuleComponent(moduleSlug: string, route: string) {
  const modulePagesMap = modulePages[moduleSlug];
  if (!modulePagesMap) {
    throw new Error(`Módulo não encontrado: ${moduleSlug}`);
  }

  const pageLoader = modulePagesMap[route];
  if (!pageLoader) {
    throw new Error(`Página não encontrada: ${moduleSlug}${route}`);
  }

  const module = await pageLoader();
  return module.default || module;
}
