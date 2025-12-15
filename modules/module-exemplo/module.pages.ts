/**
 * REGISTRO CENTRALIZADO DE PÁGINAS - MODULE EXEMPLO
 * 
 * Este arquivo é OBRIGATÓRIO e define todas as páginas do módulo
 * O core apenas lê este array - nunca cria páginas manualmente
 */

export const modulePages = [
  {
    id: 'module-exemplo.index',
    path: '/module-exemplo',
    component: () => import('./frontend/pages/index.js'),
    protected: true,
    permissions: ['module-exemplo.view'],
    title: 'Module Exemplo - Página Principal',
    description: 'Página principal do módulo de exemplo com funcionalidades de demonstração'
  },
  {
    id: 'module-exemplo.settings',
    path: '/module-exemplo/settings',
    component: () => import('./frontend/pages/settings.js'),
    protected: true,
    permissions: ['module-exemplo.settings'],
    title: 'Module Exemplo - Configurações',
    description: 'Página de configurações do módulo de exemplo'
  }
] as const;