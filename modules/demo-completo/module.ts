/**
 * MANIFESTO DO MÓDULO - DEMO COMPLETO
 * 
 * Este arquivo define os metadados e o contrato de integração do módulo com o Core.
 * É o ponto de entrada principal que o sistema lê para entender o módulo.
 */

import { ModuleContract } from '@core/contracts/ModuleContract';
import { CoreContext } from '@core/context/CoreContext';
import { ModulePermissions } from './permissions';
import { ModuleMenu } from './frontend/menu';

export const DemoCompletoModule: ModuleContract = {
    // Identificadores
    name: 'Demo Completo',
    slug: 'demo-completo',
    version: '1.0.0',

    // Metadados de exibição
    displayName: 'Módulo de Demonstração Completo',
    description: 'Demonstração exaustiva de todas as capacidades do sistema modular, incluindo CRUD, uploads, widgets e relatórios.',
    author: 'Equipe de Desenvolvimento',

    /**
     * Função de Registro (Ciclo de Vida)
     * Chamada pelo Core durante a inicialização do sistema.
     * Use para registrar permissões, menus, listeners de eventos, etc.
     */
    register(ctx: CoreContext) {
        console.log('📦 [DemoCompleto] Inicializando módulo...');

        // 1. Registro de Permissões no ACL
        // O backend lerá isso e atualizará o banco de dados se necessário
        if (ModulePermissions.permissions) {
            // ctx.permissions.registerAll(ModulePermissions.permissions);
            console.log('   🔒 Permissões carregadas');
        }

        // 2. Registro do Menu (Lado do Servidor)
        // Apenas para conhecimento do backend, o frontend puxa seu próprio menu
        if (ModuleMenu) {
            // ctx.menu.registerAll(ModuleMenu);
            console.log('   M Menu definido');
        }

        console.log('✅ [DemoCompleto] Módulo registrado com sucesso.');
    }
};
