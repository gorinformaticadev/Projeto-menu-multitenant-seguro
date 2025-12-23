/**
 * REGISTRY DE COMPONENTES - SISTEMA DE MÓDULOS
 *
 * Este arquivo registra as páginas de cada módulo para rotas dinâmicas
 * 
 * ATENÇÃO: Desabilitado temporariamente devido a limitações do Next.js
 * Next.js não permite imports de fora do diretório frontend/
 */

import dynamic from 'next/dynamic';

// Imports dinâmicos para lazy loading
// Imports dinâmicos para lazy loading
export const modulePages: Record<string, Record<string, () => Promise<any>>> = {
  // Módulo Sistema - Importando direto da raiz modules/
  sistema: {
    '/dashboard': () => import('../external_modules/sistema/frontend/pages/overview.tsx'),
    '/modelNotification': () => import('../external_modules/sistema/frontend/pages/modelNotification.tsx'),
    '/model-notification': () => import('../external_modules/sistema/frontend/pages/modelNotification.tsx'), // Fallback
    '/ajustes': () => import('../external_modules/sistema/frontend/pages/settings.tsx'),
  }
};

// Função helper para resolver componente
export async function resolveModuleComponent(moduleSlug: string, route: string) {
  console.log('🔍 [resolveModuleComponent] INÍCIO - Chamada recebida');
  console.log('🔍 [ModuleRegistry] Resolvendo componente:', { moduleSlug, route });
  console.log('📚 [ModuleRegistry] Módulos disponíveis:', Object.keys(modulePages));

  const modulePagesMap = modulePages[moduleSlug];
  if (!modulePagesMap) {
    console.error('❌ [ModuleRegistry] Módulo não encontrado:', moduleSlug);
    throw new Error(`Módulo não encontrado: ${moduleSlug}`);
  }

  console.log('📝 [ModuleRegistry] Rotas disponíveis:', Object.keys(modulePagesMap));

  const pageLoader = modulePagesMap[route];
  if (!pageLoader) {
    console.error('❌ [ModuleRegistry] Página não encontrada:', route);
    console.error('📄 [ModuleRegistry] Rotas disponíveis para', moduleSlug, ':', Object.keys(modulePagesMap));
    throw new Error(`Página não encontrada: ${moduleSlug}${route}`);
  }

  console.log('✅ [ModuleRegistry] Carregando página:', `${moduleSlug}${route}`);
  const module = await pageLoader();
  console.log('✅ [ModuleRegistry] Página carregada com sucesso');
  return module.default || module;
}
