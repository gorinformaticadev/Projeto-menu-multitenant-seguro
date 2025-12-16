import { ModuleContract } from '@core/contracts/ModuleContract';
import { CoreContext } from '@core/context/CoreContext';
import { ModuleRoutes } from './backend/routes';
import { ModulePermissions } from './permissions';
import { ModuleMenu } from './frontend/menu';

export const ModuleExemplo: ModuleContract = {
    name: 'MÃ³dulo Exemplo',
    slug: 'module-exemplo',
    version: '1.0.0',
    displayName: 'MÃ³dulo de Exemplo',
    description: 'MÃ³dulo de demonstraÃ§Ã£o completo refatorado para a nova arquitetura.',
    author: 'Analista de Sistemas',

    register(ctx: CoreContext) {
        // Registra PermissÃµes
        if (ModulePermissions.permissions) {
            ModulePermissions.permissions.forEach(permission => {
                // LÃ³gica de registro simulada
                // ctx.permissions.register(permission);
            });
        }

        // Registra Menu
        if (ModuleMenu) {
            ModuleMenu.forEach(item => {
                // LÃ³gica de registro simulada
                // ctx.menu.register(item);
            });
        }

        console.log('MÃ³dulo Exemplo registrado com sucesso.');
    }
};

