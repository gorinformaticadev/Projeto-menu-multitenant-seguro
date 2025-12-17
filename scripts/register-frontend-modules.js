#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.resolve(__dirname, '..', 'modules');
const FRONTEND_MODULES_DIR = path.resolve(__dirname, '..', 'frontend', 'src', 'modules');
const REGISTRY_FILE = path.join(FRONTEND_MODULES_DIR, 'registry.ts');

console.log('🔍 Escaneando módulos para registro de componentes...');

function scanModules() {
    if (!fs.existsSync(MODULES_DIR)) {
        console.log('📁 Nenhum módulo encontrado');
        return {};
    }

    const modules = {};
    const dirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true });

    for (const dir of dirs) {
        if (dir.isDirectory() && !dir.name.startsWith('.')) {
            const modulePath = path.join(MODULES_DIR, dir.name);
            const frontendPath = path.join(modulePath, 'frontend');

            if (fs.existsSync(frontendPath)) {
                modules[dir.name] = scanModuleFrontend(dir.name, frontendPath);
            }
        }
    }

    return modules;
}

function scanModuleFrontend(moduleSlug, frontendPath) {
    const pagesPath = path.join(frontendPath, 'pages');

    if (!fs.existsSync(pagesPath)) {
        return { pages: {} };
    }

    const pages = {};
    const scanDir = (dir, prefix = '') => {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(dir, item.name);
            const itemName = prefix + item.name;

            if (item.isDirectory()) {
                scanDir(itemPath, itemName + '/');
            } else if (item.name.endsWith('.tsx') || item.name.endsWith('.ts')) {
                const route = itemName
                    .replace(/\.tsx?$/, '')
                    .replace(/\/index$/, '')
                    .replace(/^/, '/');

                pages[route] = `./../../../modules/${moduleSlug}/frontend/pages/${itemName}`;
            }
        }
    };

    scanDir(pagesPath);

    return { pages };
}

function generateRegistry(modules) {
    let content = `/**
 * REGISTRY DE COMPONENTES - GERADO AUTOMATICAMENTE
 *
 * Este arquivo é gerado pelo script register-frontend-modules.js
 * NÃO EDITE MANUALMENTE
 *
 * Atualizado em: ${new Date().toISOString()}
 */

`;

    content += `// Imports dinâmicos para lazy loading
export const modulePages = {
`;

    for (const [moduleSlug, moduleData] of Object.entries(modules)) {
        content += `  '${moduleSlug}': {
`;

        for (const [route, filePath] of Object.entries(moduleData.pages)) {
            content += `    '${route}': () => import('${filePath}'),
`;
        }

        content += `  },
`;
    }

    content += `};

// Função helper para resolver componente
export async function resolveModuleComponent(moduleSlug: string, route: string) {
  const modulePages = modulePages[moduleSlug];
  if (!modulePages) {
    throw new Error(\`Módulo não encontrado: \${moduleSlug}\`);
  }

  const pageLoader = modulePages[route];
  if (!pageLoader) {
    throw new Error(\`Página não encontrada: \${moduleSlug}\${route}\`);
  }

  const module = await pageLoader();
  return module.default || module;
}
`;

    return content;
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function main() {
    try {
        const modules = scanModules();

        console.log('📦 Encontrados ' + Object.keys(modules).length + ' módulos com frontend');

        for (const [slug, data] of Object.entries(modules)) {
            console.log('  - ' + slug + ': ' + Object.keys(data.pages).length + ' páginas');
        }

        ensureDirectoryExists(FRONTEND_MODULES_DIR);

        const registryContent = generateRegistry(modules);
        fs.writeFileSync(REGISTRY_FILE, registryContent, 'utf-8');

        console.log('✅ Registry gerado: ' + REGISTRY_FILE);

    } catch (error) {
        console.error('❌ Erro ao gerar registry:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { scanModules, generateRegistry };