/**
 * REGISTRY DE COMPONENTES - GERADO AUTOMATICAMENTE
 *
 * Este arquivo é gerado pelo script register-frontend-modules.js
 * NÃO EDITE MANUALMENTE
 *
 * Atualizado em: 2025-12-24
 */

// Imports dinâmicos para lazy loading
export const modulePages: Record<string, Record<string, () => Promise<unknown>>> = {
  // 'sistema': {
  //   '/ajustes': () => import('@modules/sistema/frontend/pages/ajustes.tsx'),
  // },
};

// Função helper para resolver componente
export async function resolveModuleComponent(moduleSlug: string, route: string) {
  const moduleRoutes = modulePages[moduleSlug];
  if (!moduleRoutes) {
    throw new Error(`Módulo não encontrado no registro frontend: ${moduleSlug}`);
  }

  const pageLoader = moduleRoutes[route];
  if (!pageLoader) {
    throw new Error(`Página não encontrada: ${moduleSlug}${route}`);
  }

  const module = await pageLoader();
  return module.default || module;
}
