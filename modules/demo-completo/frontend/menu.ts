/**
 * DEFINIÇÃO DO MENU LATERAL - MÓDULO DEMO COMPLETO
 * 
 * Este arquivo define a estrutura de navegação que será injetada na Sidebar.
 * Segue estritamente a interface `SidebarItem` do Core.
 */

export const ModuleMenu = [
    {
        // Chave única para controle de estado (open/close)
        id: 'demo-completo-main',
        // Rótulo visível ao usuário
        name: 'Demo Completo',
        // Ícone da biblioteca Lucide (usada no Sidebar)
        icon: 'Rocket',
        // Rota principal (se houver)
        href: '/modules/demo-completo',
        // Ordem de exibição no menu
        order: 15,
        // Grupo lógico (pode ser usado para separadores)
        group: 'demo-completo',
        // Permissões necessárias para ver este item PAI
        roles: ['ADMIN', 'SUPER_ADMIN', 'USER'],

        // Sub-itens do menu
        children: [
            {
                id: 'demo-list',
                name: 'Listar Demos',
                href: '/modules/demo-completo/demo',
                icon: 'List',
                order: 1
            },
            {
                id: 'demo-dashboard',
                name: 'Dashboard',
                href: '/modules/demo-completo/demo/dashboard',
                icon: 'BarChart3',
                order: 2
            },
            {
                id: 'demo-create',
                name: 'Novo Demo',
                href: '/modules/demo-completo/demo/create',
                icon: 'PlusCircle',
                order: 3,
                roles: ['ADMIN']
            },
            {
                id: 'demo-categories',
                name: 'Categorias',
                href: '/modules/demo-completo/demo/categories',
                icon: 'FolderKanban',
                order: 4
            },
            {
                id: 'demo-tags',
                name: 'Tags',
                href: '/modules/demo-completo/demo/tags',
                icon: 'Tags',
                order: 5
            }
        ]
    }
];
