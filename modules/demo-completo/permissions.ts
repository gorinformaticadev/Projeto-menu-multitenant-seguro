/**
 * DEFINIÇÃO DE PERMISSÕES - MÓDULO DEMO COMPLETO
 * 
 * Define as capacidades (capabilities) que este módulo adiciona ao sistema ACL.
 * O Core usa isso para popular o banco de dados de permissões e permitir
 * atribuição a roles.
 */

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
            description: 'Permite criar novos registros de demonstração',
            roles: ['ADMIN']
        },
        {
            slug: 'demo.edit',
            name: 'Editar Demos',
            description: 'Permite editar registros existentes',
            roles: ['ADMIN']
        },
        {
            slug: 'demo.delete',
            name: 'Excluir Demos',
            description: 'Permite remover registros',
            roles: ['ADMIN']
        },
        {
            slug: 'demo.publish',
            name: 'Publicar Demos',
            description: 'Permite alterar status para publicado',
            roles: ['ADMIN', 'EDITOR']
        }
    ]
};
