/**
 * DEFINIÇÃO DE PERMISSÕES - MÓDULO SISTEMA
 *
 * Define as capacidades (capabilities) que este módulo adiciona ao sistema ACL.
 * O Core usa isso para popular o banco de dados de permissões e permitir
 * atribuição a roles.
 *
 * Cada permissão tem:
 * - slug: Identificador único da permissão
 * - name: Nome amigável exibido na interface
 * - description: Descrição detalhada do que a permissão permite
 * - roles: Lista de papéis que têm esta permissão por padrão
 */

export const ModulePermissions = {
    driver: 'acl',
    permissions: [
        /**
         * Permissão para visualizar o módulo sistema
         * Disponível para administradores, usuários comuns e convidados
         */
        {
            slug: 'sistema.view',
            name: 'Visualizar Sistema',
            description: 'Permite visualizar o módulo sistema',
            roles: ['ADMIN', 'USER', 'GUEST']
        },
        /**
         * Permissão para criar configurações no sistema
         * Apenas administradores têm esta permissão por padrão
         */
        {
            slug: 'sistema.create',
            name: 'Criar Configurações',
            description: 'Permite criar configurações no sistema',
            roles: ['ADMIN']
        },
        /**
         * Permissão para editar configurações do sistema
         * Apenas administradores têm esta permissão por padrão
         */
        {
            slug: 'sistema.edit',
            name: 'Editar Sistema',
            description: 'Permite editar configurações do sistema',
            roles: ['ADMIN']
        },
        /**
         * Permissão para excluir configurações do sistema
         * Apenas administradores têm esta permissão por padrão
         */
        {
            slug: 'sistema.delete',
            name: 'Excluir Sistema',
            description: 'Permite excluir configurações do sistema',
            roles: ['ADMIN']
        },
        /**
         * Permissão para administrar o módulo sistema
         * Apenas administradores têm esta permissão por padrão
         */
        {
            slug: 'sistema.admin',
            name: 'Administrar Sistema',
            description: 'Permite administrar o módulo sistema',
            roles: ['ADMIN']
        }
    ]
};