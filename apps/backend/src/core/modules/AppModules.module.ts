import { Module, Logger, DynamicModule } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaModule } from '@core/prisma/prisma.module';
import { CommonModule } from '@common/common.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({})
export class AppModulesModule {
    private static readonly logger = new Logger(AppModulesModule.name);

    static async forRoot(): Promise<DynamicModule> {
        const imports = [];
        const prisma = new PrismaClient(); // Instância local para bootstrap

        try {
            await prisma.$connect();
            this.logger.log('🔄 Loading modules from database...');
            this.logger.log(`📂 CWD: ${process.cwd()}`);

            // Buscar apenas módulos ativos com backend
            // O controle de habilitação por tenant é feito via ModuleTenant.enabled
            const enabledModules = await prisma.module.findMany({
                where: {
                    status: 'active',
                    hasBackend: true
                }
            });

            // NOTA: Carregamento dinâmico de módulos desabilitado
            // O campo 'backendEntry' não existe no banco de dados
            // Módulos são gerenciados pelo ModuleLoader
            this.logger.log(`✅ Found ${enabledModules.length} active module(s) in database`);
            this.logger.log(`ℹ️  Dynamic module loading is managed by ModuleLoader service`);

            /*
            for (const mod of enabledModules) {
                if (!mod.backendEntry) continue;

                try {
                    const _modulePath = path.resolve(process.cwd(), mod.backendEntry);
                    this.logger.log(`⏳ Loading module: ${mod.slug} (Path: ${modulePath})`);

                    // Importação dinâmica com caminho absoluto
                    const moduleExports = await import(modulePath);

                    let moduleClass = moduleExports.default;
                    if (!moduleClass) {
                        for (const key of Object.keys(moduleExports)) {
                            if (typeof moduleExports[key] === 'function' && moduleExports[key].name.endsWith('Module')) {
                                moduleClass = moduleExports[key];
                                break;
                            }
                        }
                    }

                    if (moduleClass) {
                        imports.push(moduleClass);
                        this.logger.log(`✅ Module ${mod.slug} loaded successfully.`);
                    } else {
                        throw new Error(`No module class found`);
                    }

                } catch (error) {
                    this.logger.error(`❌ Failed to load module ${mod.slug}: ${error.message}`);
                    // Erro já está logado, não precisa armazenar no banco
                }
            }
            */

        } catch (dbError) {
            // Tratamento específico para erros de schema
            if (dbError.message?.includes('does not exist') || dbError.code === 'P2010') {
                this.logger.error(`❌ Schema inconsistency detected: ${dbError.message}`);
                this.logger.warn('⚠️ Continuing without modules. Please check database migrations.');
            } else {
                this.logger.error(`❌ Database error while loading modules: ${dbError.message}`);
            }
            // Sistema continua sem módulos em vez de quebrar
        } finally {
            await prisma.$disconnect();
        }

        return {
            module: AppModulesModule,
            imports: [
                PrismaModule,
                CommonModule,
                NotificationsModule,
                ...imports
            ],
            exports: imports, // Re-export loaded modules
            global: true,
        };
    }
}
