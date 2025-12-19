/**
 * DEFINIÇÃO DO MENU LATERAL - MÓDULO SISTEMA
 *
 * Este arquivo define a estrutura de navegação que será injetada na Sidebar.
 * Segue estritamente a interface `SidebarItem` do Core.
 *
 * A estrutura do menu inclui:
 * - Um item principal (pai) que aparece no menu lateral
 * - Sub-itens que aparecem quando o item principal é expandido
 * - Cada item pode ter uma rota, ícone e permissões específicas
 */

export const ModuleMenu = [
    {
        // Chave única para controle de estado (open/close)
        id: 'sistema-main',
        // Rótulo visível ao usuário no menu lateral
        name: 'Suporte',
        // Ícone da biblioteca Lucide (usada no Sidebar)
        icon: 'Headphones',
        // Rota principal (se houver) - neste caso, link para WhatsApp
        href: 'https://wa.me/5561996104908',
        // Ordem de exibição no menu (quanto menor, mais acima)
        order: 10,
        // Grupo lógico (pode ser usado para separadores)
        group: 'sistema',
        // Permissões necessárias para ver este item PAI
        // Qualquer um desses papéis pode ver o item principal
        roles: ['ADMIN', 'SUPER_ADMIN', 'USER'],

        // Sub-itens do menu que aparecem quando o item principal é expandido
        children: [
            {
                // Identificador único do sub-item
                id: 'sistema-dashboard',
                // Nome exibido no submenu
                name: 'Dashboard',
                // Rota para a página do dashboard do módulo
                href: '/modules/sistema/dashboard',
                // Ícone do Lucide para o sub-item
                icon: 'BarChart3',
                // Ordem de exibição no submenu
                order: 1
            },
            {
                id: 'sistema-notificacao',
                name: 'Notificações',
                href: '/modules/sistema/notificacao',
                icon: 'Bell',
                order: 2
            },
            {
                id: 'sistema-ajustes',
                name: 'Ajustes',
                href: '/modules/sistema/ajustes',
                icon: 'Settings',
                order: 3
            }
        ]
    }
];