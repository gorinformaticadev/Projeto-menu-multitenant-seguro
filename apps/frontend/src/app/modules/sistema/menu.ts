/**
 * DEFINIÇÃO DO MENU LATERAL - MÓDULO SISTEMA
 *
 * Este arquivo define a estrutura de navegação que será injetada na Sidebar.
 * Segue estritamente a interface `SidebarItem` do Core.
 */

export const ModuleMenu = [
    {
        // Chave única para controle de estado (open/close)
        id: 'sistema-main',
        // Rótulo visível ao usuário
        name: 'Suporte',
        // Ícone da biblioteca Lucide (usada no Sidebar)
        icon: 'Headphones',
        // Rota principal (se houver)
        href: 'https://wa.me/5561996104908',
        // Ordem de exibição no menu
        order: 10,
        // Grupo lógico (pode ser usado para separadores)
        group: 'sistema',
        // Permissões necessárias para ver este item PAI
        roles: ['ADMIN', 'SUPER_ADMIN', 'USER'],

        // Sub-itens do menu
        children: [
            {
                id: 'sistema-dashboard',
                name: 'Dashboard',
                href: '/modules/sistema/dashboard',
                icon: 'BarChart3',
                order: 1
            },
            {
                id: 'sistema-notificacao',
                name: 'Notificações',
                href: '/modules/sistema/modelNotification',
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