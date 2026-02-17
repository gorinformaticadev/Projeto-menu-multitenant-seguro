import { Logger, Type } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

export class DynamicModulesLoader {
  private static readonly logger = new Logger(DynamicModulesLoader.name);

  static async load(prisma: PrismaService): Promise<Type<any>[]> {
    try {
      const logFile = path.join(process.cwd(), 'module_loading_debug.log');
      const log = (msg: string) => {
        try {
          const timestamp = new Date().toISOString();
          fs.appendFileSync(logFile, `[${timestamp}] [Loader] ${msg}\n`);
        } catch {
          // Ignore log file errors
        }
        this.logger.log(msg);
      };

      log('Buscando modulos ativos no banco de dados...');

      const modules = await prisma.module.findMany({
        where: {
          status: 'active',
          hasBackend: true,
        },
      });

      const loaded: Type<any>[] = [];

      if (modules.length === 0) {
        log('Nenhum modulo ativo encontrado.');
        return [];
      }

      log(`Encontrados ${modules.length} modulos ativos. Iniciando carregamento...`);

      for (const mod of modules) {
        try {
          const moduleDirName = mod.slug.toLowerCase();
          const moduleFileName = `${mod.slug.toLowerCase()}.module`;
          const moduleBasePath = path.resolve(__dirname, `../modules/${moduleDirName}/${moduleFileName}`);
          const resolvedModulePath = this.resolveModuleFile(moduleBasePath);

          if (!resolvedModulePath) {
            throw Object.assign(new Error(`Module file not found for ${moduleBasePath}`), {
              code: 'MODULE_NOT_FOUND',
            });
          }

          log(`Carregando: ${mod.slug} de ${resolvedModulePath}`);

          // Keep CommonJS resolution behavior in dist (extensionless -> .js)
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const imported = require(resolvedModulePath);

          const moduleClassName = `${this.capitalize(mod.slug)}Module`;
          const moduleClass = imported[moduleClassName];

          if (moduleClass) {
            loaded.push(moduleClass);
            log(`Modulo ${mod.slug} carregado com sucesso.`);
          } else {
            log(`Classe ${moduleClassName} nao encontrada em ${resolvedModulePath}`);
            const fallbackExport = Object.keys(imported).find((key) => key.endsWith('Module'));
            if (fallbackExport) {
              log(`Usando classe alternativa encontrada: ${fallbackExport}`);
              loaded.push(imported[fallbackExport]);
            }
          }
        } catch (err: any) {
          log(`Falha ao carregar modulo ${mod.slug}: ${err?.message ?? err}`);
          if (err?.code === 'MODULE_NOT_FOUND') {
            log(`Verifique se a pasta/arquivo existe em: src/modules/${mod.slug}/`);

            try {
              log(`Modulo ${mod.slug} possui arquivos ausentes. Desabilitando no banco...`);
              await prisma.module.update({
                where: { id: mod.id },
                data: { status: 'disabled' },
              });
              log(`Modulo ${mod.slug} foi marcado como disabled.`);
            } catch (dbErr: any) {
              log(`Nao foi possivel desabilitar o modulo ${mod.slug}: ${dbErr?.message ?? dbErr}`);
            }
          }
        }
      }

      log(`Carregamento finalizado. Modulos carregados: ${loaded.length}`);
      return loaded;
    } catch (error: any) {
      this.logger.error(`Erro fatal no loader de modulos: ${error?.message ?? error}`);
      return [];
    }
  }

  private static capitalize(str: string): string {
    if (!str) {
      return str;
    }

    const parts = str.split(/[_-]/g).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    }

    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private static resolveModuleFile(basePath: string): string | null {
    const candidates = [
      basePath,
      `${basePath}.js`,
      `${basePath}.ts`,
      path.join(basePath, 'index.js'),
      path.join(basePath, 'index.ts'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }
}
