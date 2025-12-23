/**
 * REGISTRY DE COMPONENTES - GERADO AUTOMATICAMENTE
 *
 * Este arquivo é gerado pelo script register-frontend-modules.js
 * NÃO EDITE MANUALMENTE
 *
 * Atualizado em: 2025-12-23T16:44:38.627Z
 */

// Imports dinâmicos para lazy loading
export const modulePages = {
  'sistema': {
    '/ajustes': () => import('@modules/sistema/frontend/pages/ajustes.tsx'),
    '/dashboard': () => import('@modules/sistema/frontend/pages/dashboard.tsx'),
    '/modelNotification': () => import('@modules/sistema/frontend/pages/modelNotification.tsx'),
  },
};

// Função helper para resolver componente
export async function resolveModuleComponent(moduleSlug: string, route: string) {
  const modulePages = modulePages[moduleSlug];
  if (!modulePages) {
    throw new Error(`Módulo não encontrado: ${moduleSlug}`);
  }

  const pageLoader = modulePages[route];
  if (!pageLoader) {
    throw new Error(`Página não encontrada: ${moduleSlug}${route}`);
  }

  const module = await pageLoader();
  return module.default || module;
}
