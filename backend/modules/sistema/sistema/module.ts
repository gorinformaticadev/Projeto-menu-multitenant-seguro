/**
 * MANIFESTO DO MÓDULO - SISTEMA
 *
 * Este arquivo define os metadados e o contrato de integração do módulo com o Core.
 * É o ponto de entrada principal que o sistema lê para entender o módulo.
 */

import { ModuleContract } from '@core/contracts/ModuleContract';
import { CoreContext } from '@core/context/CoreContext';
import { ModulePermissions } from './permissions';
import { ModuleMenu } from './frontend/menu';

export const SistemaModule: ModuleContract = {
    // Identificadores
    name: 'Sistema',
    slug: 'sistema',
    version: '1.0.0',

    // Metadados de exibição
    displayName: 'Módulo Sistema',
    description: 'Módulo integrado com funcionalidades do sistema.',
    author: 'Equipe CORE',

    /**
     * Função de Registro (Ciclo de Vida)
     * Chamada pelo Core durante a inicialização do sistema.
     * Use para registrar permissões, menus, listeners de eventos, etc.
     */
    register(ctx: CoreContext) {
        console.log('📦 [Sistema] Inicializando módulo...');

        // 1. Registro de Permissões no ACL
        if (ModulePermissions.permissions) {
            console.log('   🔒 Permissões carregadas');
        }

        // 2. Registro do Menu (Lado do Servidor)
        if (ModuleMenu) {
            console.log('   M Menu definido');
        }

        // 3. Adicionar notificação na topbar
        ctx.events.on('notifications:register', () => {
            ctx.notifier.send('system-channel', {
                type: 'info',
                title: 'Módulo Sistema',
                message: 'Módulo sistema carregado com sucesso.',
            }, []);
        });

        // 4. Adicionar item no menu do usuário para configurações
        ctx.events.on('user-menu:register', () => {
            ctx.menu.addUserMenuItem({
                id: 'sistema-config',
                label: 'Configurações do Sistema',
                href: '/modules/sistema/ajustes',
                icon: 'Settings',
                order: 10,
                permissions: ['sistema.view']
            });
        });

        console.log('✅ [Sistema] Módulo registrado com sucesso.');
    }
};