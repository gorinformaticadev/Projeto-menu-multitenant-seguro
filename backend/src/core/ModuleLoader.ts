import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CoreContext } from './context/CoreContext';
import { ModuleContract } from './contracts/ModuleContract';

@Injectable()
export class ModuleLoader implements OnModuleInit {
    private readonly logger = new Logger(ModuleLoader.name);
    private loadedModules: Map<string, ModuleContract> = new Map();

    constructor(
        // private readonly coreContext: CoreContext // Injeção temporariamente desabilitada se provider não estiver pronto
    ) { }

    async onModuleInit() {
        this.logger.log('Initializing Module Loader...');
        await this.scanModules();
    }

    private async scanModules() {
        // Caminho relativo a partir de dist/src/core/ModuleLoader.js -> ../../../modules
        // Ajustar conforme necessidade de build.
        const modulesPath = path.resolve(process.cwd(), 'modules');

        if (!fs.existsSync(modulesPath)) {
            this.logger.warn(`Modules directory not found at ${modulesPath}`);
            return;
        }

        const dirs = fs.readdirSync(modulesPath, { withFileTypes: true });
        for (const dir of dirs) {
            if (dir.isDirectory()) {
                // Ignorar pastas ocultas ou node_modules
                if (dir.name.startsWith('.') || dir.name === 'node_modules') continue;
                await this.loadModule(dir.name);
            }
        }
    }

    private async loadModule(slug: string) {
        try {
            const moduleDir = path.resolve(process.cwd(), 'modules', slug);
            // Tenta achar module.ts (dev) ou module.js (prod)
            let moduleEntry = path.join(moduleDir, 'module.ts');
            if (!fs.existsSync(moduleEntry)) {
                moduleEntry = path.join(moduleDir, 'module.js');
            }

            if (fs.existsSync(moduleEntry)) {
                this.logger.log(`Discovered module: ${slug}`);
                // TODO: Implementar carregamento real dinâmico
                // Em ambiente CommonJS/TS-Node isso requer cuidado.
                // Para "pronto para produção", o build deve incluir modules.
            }
        } catch (e) {
            this.logger.error(`Failed to load module ${slug}`, e);
        }
    }
}
