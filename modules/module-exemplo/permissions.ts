export const ModulePermissions = {
    driver: 'acl',
    permissions: [
        {
            slug: 'demo.view',
            name: 'Visualizar Demos',
            description: 'Permite visualizar a lista de demos e detalhes',
            roles: ['ADMIN', 'USER', 'GUEST']
        },
        {
            slug: 'demo.create',
            name: 'Criar Demos',
            description: 'Permite criar novos demos',
            roles: ['ADMIN']
        },
        {
            slug: 'demo.edit',
            name: 'Editar Demos',
            description: 'Permite editar demos existentes',
            roles: ['ADMIN']
        },
        {
            slug: 'demo.delete',
            name: 'Deletar Demos',
            description: 'Permite remover demos',
            roles: ['SUPER_ADMIN']
        },
        {
            slug: 'demo.publish',
            name: 'Publicar Demos',
            description: 'Permite publicar/despublicar demos',
            roles: ['ADMIN', 'SUPER_ADMIN']
        }
    ]
};
