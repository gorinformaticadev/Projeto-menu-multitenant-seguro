/**
 * ROTAS DO FRONTEND (NEXT.JS) - MÓDULO DEMO COMPLETO
 * 
 * Este arquivo mapeia rotas HTTP para Componentes React (Páginas).
 * O sistema DynamicLoader lê este arquivo para injetar as rotas no App Router.
 * 
 * ATENÇÃO:
 * As rotas devem incluir o prefixo `/modules/demo-completo` se você quiser
 * que elas sejam acessadas dentro do contexto modular padrão.
 */

import DemoListPage from './pages/index';
import DemoCreatePage from './pages/create';
import DemoDashboardPage from './pages/dashboard';
import DemoCategoriesPage from './pages/categories';
import DemoTagsPage from './pages/tags';
import DemoEditPage from './pages/edit/[id]';
import DemoViewPage from './pages/[id]/index';

// Prefixo padrão para isolamento de rota
const MODULE_ROOT = '/demo-completo';

export const ModuleRoutes = [
    // Rota Raiz: /modules/demo-completo (Redireciona ou exibe lista)
    { path: `${MODULE_ROOT}`, component: DemoListPage },

    // Rota: /modules/demo-completo/demo
    { path: `${MODULE_ROOT}/demo`, component: DemoListPage },

    // Rota: /modules/demo-completo/demo/create
    { path: `${MODULE_ROOT}/demo/create`, component: DemoCreatePage },

    // Rota: /modules/demo-completo/demo/dashboard
    { path: `${MODULE_ROOT}/demo/dashboard`, component: DemoDashboardPage },

    // Rota: /modules/demo-completo/demo/categories
    { path: `${MODULE_ROOT}/demo/categories`, component: DemoCategoriesPage },

    // Rota: /modules/demo-completo/demo/tags
    { path: `${MODULE_ROOT}/demo/tags`, component: DemoTagsPage },

    // Rota: /modules/demo-completo/demo/edit/[id]
    { path: `${MODULE_ROOT}/demo/edit/:id`, component: DemoEditPage },

    // Rota: /modules/demo-completo/demo/[id]
    { path: `${MODULE_ROOT}/demo/:id`, component: DemoViewPage },
];
