export const ModuleMenu = [
    {
        key: 'module-exemplo-main',
        label: 'Demos',
        icon: 'ViewList', // Nome do ícone Material UI
        path: '/demo', // Frontend route
        order: 10,
        permissions: ['demo.view'],
        children: [
            {
                key: 'module-exemplo-list',
                label: 'Listar Demos',
                path: '/demo',
                permissions: ['demo.view']
            },
            {
                key: 'module-exemplo-create',
                label: 'Criar Novo',
                path: '/demo/create',
                permissions: ['demo.create']
            },
            {
                key: 'module-exemplo-categories',
                label: 'Categorias',
                path: '/demo/categories',
                permissions: ['demo.view'] // Ajuste conforme necessidade
            },
            {
                key: 'module-exemplo-tags',
                label: 'Tags',
                path: '/demo/tags',
                permissions: ['demo.view']
            }
        ]
    }
];
