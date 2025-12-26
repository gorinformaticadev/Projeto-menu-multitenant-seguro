
import { DynamicModule, Logger, Type } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service'; // Adjusted path
import * as path from 'path';

export class DynamicModulesLoader {
    private static readonly logger = new Logger(DynamicModulesLoader.name);

    static async load(prisma: PrismaService): Promise<Type<any>[]> {
        try {
            this.logger.log('🔄 Buscando módulos ativos no banco de dados...');

            // Busca módulos que estão com status 'active' e têm backend
            // Ajuste conforme o schema real. O schema tem status (enum) e hasBackend.
            const modules = await prisma.module.findMany({
                where: {
                    status: 'active',
                    hasBackend: true
                },
            });

            const loaded: Type<any>[] = [];

            if (modules.length === 0) {
                this.logger.log('ℹ️ Nenhum módulo ativo encontrado.');
                return [];
            }

            this.logger.log(`🔎 Encontrados ${modules.length} módulos ativos. Iniciando carregamento...`);

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

                    this.logger.log(`⏳ Carregando: ${mod.slug} de ${modulePath}`);

                    // Importação dinâmica
                    // Nota: Em produção (webpack/nest build), dynamic imports podem precisar de configuração extra
                    // mas para execução padrão Node/TS funciona.
                    const imported = await import(modulePath);

                    // Convenção de nome da classe: sistema -> SistemaModule
                    const moduleClassName = this.capitalize(mod.slug) + 'Module';
                    const moduleClass = imported[moduleClassName];

                    if (moduleClass) {
                        loaded.push(moduleClass);
                        this.logger.log(`✅ Módulo ${mod.slug} carregado com sucesso!`);
                    } else {
                        this.logger.warn(`⚠️ Classe ${moduleClassName} não encontrada em ${modulePath}`);
                        // Tenta encontrar qualquer exportação que termine com 'Module'
                        const foundKey = Object.keys(imported).find(key => key.endsWith('Module'));
                        if (foundKey) {
                            this.logger.log(`🔄 Usando classe alternativa encontrada: ${foundKey}`);
                            loaded.push(imported[foundKey]);
                        }
                    }
                } catch (err) {
                    // Não falha o boot inteiro, apenas loga e ignora o módulo quebrado
                    this.logger.error(`❌ Falha ao carregar módulo ${mod.slug}: ${err.message}`);
                    if (err.code === 'MODULE_NOT_FOUND') {
                        this.logger.warn(`   ➜ Verifique se a pasta/arquivo existe em: src/modules/${mod.slug}/`);
                    }
                }
            }

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
