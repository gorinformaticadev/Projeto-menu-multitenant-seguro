
import { DynamicModule, Logger, Type } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service'; // Adjusted path
import * as path from 'path';
import * as fs from 'fs';

export class DynamicModulesLoader {
    private static readonly logger = new Logger(DynamicModulesLoader.name);

    static async load(prisma: PrismaService): Promise<Type<any>[]> {
        try {
            const logFile = 'd:/github/Projeto-menu-multitenant-seguro/module_loading_debug.log';
            const log = (msg: string) => {
                const timestamp = new Date().toISOString();
                fs.appendFileSync(logFile, `[${timestamp}] [Loader] ${msg}\n`);
                this.logger.log(msg);
            };

            log('🔄 Buscando módulos ativos no banco de dados...');

            // Busca módulos que estão com status 'active' e têm backend
            const modules = await prisma.module.findMany({
                where: {
                    status: 'active',
                    hasBackend: true
                },
            });

            const loaded: Type<any>[] = [];

            if (modules.length === 0) {
                log('ℹ️ Nenhum módulo ativo encontrado.');
                return [];
            }

            log(`🔎 Encontrados ${modules.length} módulos ativos. Iniciando carregamento...`);

            for (const mod of modules) {
                try {
                    // Caminho relativo a este arquivo (src/core/dynamic-modules.loader.ts)
                    // Objetivo: src/modules/<slug>/<slug>.module.ts
                    // ../modules points to src/modules

                    const moduleDirName = mod.slug.toLowerCase();
                    const moduleFileName = mod.slug.toLowerCase() + '.module';

                    const modulePath = path.resolve(
                        __dirname,
                        `../modules/${moduleDirName}/${moduleFileName}`
                    );

                    log(`⏳ Carregando: ${mod.slug} de ${modulePath}`);

                    // Importação dinâmica
                    const imported = await import(modulePath);

                    // Convenção de nome da classe: sistema -> SistemaModule
                    const moduleClassName = this.capitalize(mod.slug) + 'Module';
                    const moduleClass = imported[moduleClassName];

                    if (moduleClass) {
                        loaded.push(moduleClass);
                        log(`✅ Módulo ${mod.slug} carregado com sucesso!`);
                    } else {
                        log(`⚠️ Classe ${moduleClassName} não encontrada em ${modulePath}`);
                        // Tenta encontrar qualquer exportação que termine com 'Module'
                        const foundKey = Object.keys(imported).find(key => key.endsWith('Module'));
                        if (foundKey) {
                            log(`🔄 Usando classe alternativa encontrada: ${foundKey}`);
                            loaded.push(imported[foundKey]);
                        }
                    }
                } catch (err) {
                    // Não falha o boot inteiro, apenas loga e ignora o módulo quebrado
                    log(`❌ Falha ao carregar módulo ${mod.slug}: ${err.message}`);
                    if (err.code === 'MODULE_NOT_FOUND') {
                        log(`   ➜ Verifique se a pasta/arquivo existe em: src/modules/${mod.slug}/`);
                    }
                }
            }

            log(`✅ Carregamento finalizado. Módulos carregados: ${loaded.length}`);
            return loaded;
        } catch (error) {
            this.logger.error(`❌ Erro fatal no loader de módulos: ${error.message}`);
            return [];
        }
    }

    private static capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
