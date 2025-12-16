import { DynamicModule, Module, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Module({})
export class AppModulesModule {
    private static readonly logger = new Logger(AppModulesModule.name);

    static async forRoot(): Promise<DynamicModule> {
        const controllers = [];
        const providers = [];
        const modulesDir = path.resolve(process.cwd(), 'modules'); // Assume root/modules

        if (fs.existsSync(modulesDir)) {
            const dirs = fs.readdirSync(modulesDir, { withFileTypes: true });
            for (const dir of dirs) {
                if (dir.isDirectory() && !dir.name.startsWith('.')) {
                    // Tentar carregar backend/routes.ts que exporta ModuleRoutes (controllers)
                    const routesPathTS = path.join(modulesDir, dir.name, 'backend', 'routes.ts');
                    // Em prod/dist, a extensÃ£o e caminho podem mudar se modules for compilado para dist/modules
                    // Se estivermos rodando via ts-node, .ts funciona.
                    // Se buildado, precisamos achar onde o tsc colocou.

                    try {
                        // ImportaÃ§Ã£o dinÃ¢mica requer caminho relativo ou alias correto
                        // Como configuramos tsconfig para incluir @core/modules, imports funcionam.
                        // Mas runtime dynamic import de arquivo fora de src pode ser tricky no Nest CLI build.
                        // Vamos tentar importar usando caminho relativo ao arquivo atual se possÃ­vel, ou alias.

                        // SoluÃ§Ã£o robusta: Usar o alias @modules configurado
                        const moduleRoutes = await import(`@modules/${dir.name}/backend/routes`);

                        if (moduleRoutes.ModuleRoutes) {
                            controllers.push(...moduleRoutes.ModuleRoutes);
                            this.logger.log(`Loaded controllers from ${dir.name}`);
                        }

                        // Carregar Providers/Services se houver um entry point
                        // providers.push(...)

                    } catch (e) {
                        this.logger.warn(`Could not load routes for module ${dir.name}: ${e.message}`);
                    }
                }
            }
        }

        return {
            module: AppModulesModule,
            controllers: controllers,
            providers: providers,
            exports: providers,
        };
    }
}

