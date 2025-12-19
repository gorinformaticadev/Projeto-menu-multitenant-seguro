/**
 * MANIFESTO DO MÓDULO - SISTEMA
 *
 * Este arquivo define os metadados e o contrato de integração do módulo com o Core.
 * É o ponto de entrada principal que o sistema lê para entender o módulo.
 *
 * O módulo sistema é um exemplo completo que demonstra:
 * - Registro de permissões no sistema ACL
 * - Injeção de itens no menu lateral
 * - Envio de notificações
 * - Adição de itens no menu do usuário
 */

import { ModuleContract } from '@core/contracts/ModuleContract';
import { CoreContext } from '@core/context/CoreContext';
import { ModulePermissions } from './permissions';
import { ModuleMenu } from './frontend/menu';

export const SistemaModule: ModuleContract = {
    // Identificadores únicos do módulo
    name: 'Sistema',
    slug: 'sistema',
    version: '1.0.1',

    // Metadados de exibição na interface do usuário
    displayName: 'Módulo Sistema',
    description: 'Módulo integrado com funcionalidades do sistema.',
    author: 'Equipe CORE',

    /**
     * Função de Registro (Ciclo de Vida)
     * 
     * Esta função é chamada pelo Core durante a inicialização do sistema.
     * É aqui que o módulo registra suas permissões, menus, listeners de eventos, etc.
     * 
     * @param ctx - Contexto do Core que fornece acesso a serviços do sistema
     */
    register(ctx: CoreContext) {
        console.log('📦 [Sistema] Inicializando módulo...');

        // 1. Registro de Permissões no sistema ACL (Access Control List)
        // As permissões definem quem pode acessar o que neste módulo
        if (ModulePermissions.permissions) {
            console.log('   🔒 Permissões carregadas');
        }

        // 2. Registro do Menu (Lado do Servidor)
        // Define como o módulo aparecerá na barra de navegação lateral
        if (ModuleMenu) {
            console.log('   📋 Menu definido');
        }

        // 3. Adicionar notificação na topbar
        // Envia uma notificação informativa quando o módulo é carregado
        ctx.events.on('notifications:register', () => {
            ctx.notifier.send('system-channel', {
                type: 'info',
                title: 'Módulo Sistema',
                message: 'Módulo sistema carregado com sucesso.',
            }, []);
        });

        // 4. Adicionar item no menu do usuário para configurações
        // Injeta um item no menu dropdown do usuário com link para configurações
        ctx.events.on('menu:register', () => {
            ctx.menu.add({
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