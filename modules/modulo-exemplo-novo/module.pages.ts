/**
 * REGISTRO CENTRALIZADO DE PÁGINAS - MODULE TEMPLATE
 * 
 * Este arquivo é OBRIGATÓRIO e define todas as páginas do módulo
 * O core apenas lê este array - nunca cria páginas manualmente
 */

export const modulePages = [
  {
    id: 'm-dulo-exemplo-novo.index',
    path: '/m-dulo-exemplo-novo',
    component: () => import('./frontend/pages/index.js'),
    protected: true,
    permissions: ['m-dulo-exemplo-novo.view'],
    title: 'Módulo Exemplo Novo - Página Principal',
    description: 'Página principal do módulo mduloexemplonovo'
  },
  {
    id: 'm-dulo-exemplo-novo.settings',
    path: '/m-dulo-exemplo-novo/settings',
    component: () => import('./frontend/pages/settings.js'),
    protected: true,
    permissions: ['m-dulo-exemplo-novo.settings'],
    title: 'Módulo Exemplo Novo - Configurações',
    description: 'Página de configurações do módulo mduloexemplonovo'
  }
] as const;