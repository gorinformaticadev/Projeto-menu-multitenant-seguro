/**
 * REGISTRO CENTRALIZADO DE PÁGINAS - MODULE TEMPLATE
 * 
 * Este arquivo é OBRIGATÓRIO e define todas as páginas do módulo
 * O core apenas lê este array - nunca cria páginas manualmente
 */

export const modulePages = [
  {
    id: 'module-template.index',
    path: '/module-template',
    component: () => import('./frontend/pages/index.js'),
    protected: true,
    permissions: ['module-template.view'],
    title: 'Module Template - Página Principal',
    description: 'Página principal do módulo template'
  },
  {
    id: 'module-template.settings',
    path: '/module-template/settings',
    component: () => import('./frontend/pages/settings.js'),
    protected: true,
    permissions: ['module-template.settings'],
    title: 'Module Template - Configurações',
    description: 'Página de configurações do módulo template'
  }
] as const;