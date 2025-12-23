/**
 * DEFINIÇÃO DE PERMISSÕES - MÓDULO SISTEMA
 *
 * Define as capacidades (capabilities) que este módulo adiciona ao sistema ACL.
 * O Core usa isso para popular o banco de dados de permissões e permitir
 * atribuição a roles.
 */

export const ModulePermissions = {
    driver: 'acl',
    permissions: [
        {
            slug: 'sistema.view',
            name: 'Visualizar Sistema',
            description: 'Permite visualizar o módulo sistema',
            roles: ['ADMIN', 'USER', 'GUEST']
        },
        {
            slug: 'sistema.create',
            name: 'Criar Configurações',
            description: 'Permite criar configurações no sistema',
            roles: ['ADMIN']
        },
        {
            slug: 'sistema.edit',
            name: 'Editar Sistema',
            description: 'Permite editar configurações do sistema',
            roles: ['ADMIN']
        },
        {
            slug: 'sistema.delete',
            name: 'Excluir Sistema',
            description: 'Permite excluir configurações do sistema',
            roles: ['ADMIN']
        },
        {
            slug: 'sistema.admin',
            name: 'Administrar Sistema',
            description: 'Permite administrar o módulo sistema',
            roles: ['ADMIN']
        }
    ]
};