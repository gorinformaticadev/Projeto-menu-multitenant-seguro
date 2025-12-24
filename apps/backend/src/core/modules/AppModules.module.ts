import { DynamicModule, Module, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
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

            const enabledModules = await prisma.module.findMany({
                where: { enabled: true, hasBackend: true }
            });

            for (const mod of enabledModules) {
                if (!mod.backendEntry) continue;

                try {
                    const modulePath = path.resolve(process.cwd(), mod.backendEntry);
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
                    await prisma.module.update({
                        where: { id: mod.id },
                        data: { lastError: error.message }
                    });
                }
            }

        } catch (dbError) {
            this.logger.error(`❌ Database error while loading modules: ${dbError.message}`);
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
