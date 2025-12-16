import { ModuleContract } from '../../backend/src/core/contracts/ModuleContract';
import { CoreContext } from '../../backend/src/core/context/CoreContext';
import { ModuleRoutes } from './backend/routes';
import { ModulePermissions } from './permissions';
import { ModuleMenu } from './frontend/menu';

export const ModuleExemplo: ModuleContract = {
    name: 'Módulo Exemplo',
    slug: 'module-exemplo',
    version: '1.0.0',
    displayName: 'Módulo de Exemplo',
    description: 'Módulo de demonstração completo refatorado para a nova arquitetura.',
    author: 'Analista de Sistemas',

    register(ctx: CoreContext) {
        // Registra Permissões
        if (ModulePermissions.permissions) {
            ModulePermissions.permissions.forEach(permission => {
                // Lógica de registro simulada
                // ctx.permissions.register(permission);
            });
        }

        // Registra Menu
        if (ModuleMenu) {
            ModuleMenu.forEach(item => {
                // Lógica de registro simulada
                // ctx.menu.register(item);
            });
        }

        console.log('Módulo Exemplo registrado com sucesso.');
    }
};
