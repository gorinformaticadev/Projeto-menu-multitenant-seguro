/**
 * REGISTRO CENTRALIZADO DE PÁGINAS - MODULE TEMPLATE
 * 
 * Este arquivo é OBRIGATÓRIO e define todas as páginas do módulo
 * O core apenas lê este array - nunca cria páginas manualmente
 */

export const modulePages = [
  {
    id: 'sistema-de-vendas.index',
    path: '/sistema-de-vendas',
    component: () => import('./frontend/pages/index.js'),
    protected: true,
    permissions: ['sistema-de-vendas.view'],
    title: 'Sistema de Vendas - Página Principal',
    description: 'Página principal do módulo sistemadevendas'
  },
  {
    id: 'sistema-de-vendas.settings',
    path: '/sistema-de-vendas/settings',
    component: () => import('./frontend/pages/settings.js'),
    protected: true,
    permissions: ['sistema-de-vendas.settings'],
    title: 'Sistema de Vendas - Configurações',
    description: 'Página de configurações do módulo sistemadevendas'
  }
] as const;