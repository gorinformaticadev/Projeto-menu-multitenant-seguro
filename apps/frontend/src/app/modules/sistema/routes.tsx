/**
 * ROTAS DO FRONTEND (NEXT.JS) - MÓDULO SISTEMA
 *
 * Este arquivo mapeia rotas HTTP para Componentes React (Páginas).
 * O sistema DynamicLoader lê este arquivo para injetar as rotas no App Router.
 *
 * ATENÇÃO:
 * As rotas devem incluir o prefixo `/modules/sistema` se você quiser
 * que elas sejam acessadas dentro do contexto modular padrão.
 */

import SistemaDashboardPage from './pages/dashboard/page';
import SistemaModelNotificationPage from './pages/modelNotification/page';
import SistemaAjustesPage from './pages/ajustes/page';

// Prefixo padrão para isolamento de rota
const MODULE_ROOT = '/sistema';

export const ModuleRoutes = [
    // Rota: /modules/sistema/dashboard
    { path: `${MODULE_ROOT}/dashboard`, component: SistemaDashboardPage },

    // Rota: /modules/sistema/modelNotification
    { path: `${MODULE_ROOT}/modelNotification`, component: SistemaModelNotificationPage },

    // Rota: /modules/sistema/ajustes
    { path: `${MODULE_ROOT}/ajustes`, component: SistemaAjustesPage },
];