/**
 * ROTAS DO FRONTEND (NEXT.JS) - MÓDULO SISTEMA
 *
 * Este arquivo mapeia rotas HTTP para Componentes React (Páginas).
 * O sistema DynamicLoader lê este arquivo para injetar as rotas no App Router.
 *
 * ATENÇÃO:
 * As rotas devem incluir o prefixo `/modules/sistema` se você quiser
 * que elas sejam acessadas dentro do contexto modular padrão.
 *
 * Cada rota mapeia uma URL para um componente React que representa uma página.
 * O componente será renderizado quando o usuário acessar a URL correspondente.
 */

// Importação das páginas React que serão associadas às rotas
import SistemaDashboardPage from './pages/dashboard';
import SistemaNotificacaoPage from './pages/notificacao';
import SistemaAjustesPage from './pages/ajustes';

// Prefixo padrão para isolamento de rota
// Todas as rotas deste módulo serão acessadas sob /modules/sistema
const MODULE_ROOT = '/modules/sistema';

export const ModuleRoutes = [
    // Rota: /modules/sistema/dashboard
    // Mapeia a URL do dashboard para o componente SistemaDashboardPage
    { path: `${MODULE_ROOT}/dashboard`, component: SistemaDashboardPage },

    // Rota: /modules/sistema/notificacao
    // Mapeia a URL de notificações para o componente SistemaNotificacaoPage
    { path: `${MODULE_ROOT}/notificacao`, component: SistemaNotificacaoPage },

    // Rota: /modules/sistema/ajustes
    // Mapeia a URL de ajustes para o componente SistemaAjustesPage
    { path: `${MODULE_ROOT}/ajustes`, component: SistemaAjustesPage },
];