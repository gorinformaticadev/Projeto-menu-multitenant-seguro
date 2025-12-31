/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const root = process.cwd();

const mappings = [
    // Backend Service (Fix UUID error)
    {
        src: 'ordem_servico/backend/services/produtos.service.ts',
        dest: 'apps/backend/src/modules/ordem_servico/services/produtos.service.ts'
    },
    // Backend Controller (Ensure latest)
    {
        src: 'ordem_servico/backend/controllers/produtos.controller.ts',
        dest: 'apps/backend/src/modules/ordem_servico/controllers/produtos.controller.ts'
    },
    // Backend Module (Ensure injection)
    {
        src: 'ordem_servico/backend/ordem_servico.module.ts',
        dest: 'apps/backend/src/modules/ordem_servico/ordem_servico.module.ts'
    },
    // Frontend Page - Target 1 (Pages structure)
    {
        src: 'ordem_servico/frontend/pages/produtos/page.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/pages/produtos/page.tsx'
    },
    // Frontend Page - Target 2 (Root structure - just in case)
    {
        src: 'ordem_servico/frontend/pages/produtos/page.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/produtos/page.tsx'
    },
    // Frontend Routes
    {
        src: 'ordem_servico/frontend/routes.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/routes.tsx'
    },
    // Frontend Menu
    {
        src: 'ordem_servico/frontend/menu.ts',
        dest: 'apps/frontend/src/app/modules/ordem_servico/menu.ts'
    }
];

console.log('🔄 Starting Final Sync...');

mappings.forEach(m => {
    const s = path.join(root, m.src);
    const d = path.join(root, m.dest);

    if (fs.existsSync(s)) {
        const dir = path.dirname(d);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        try {
            fs.copyFileSync(s, d);
            console.log(`✅ Updated: ${m.dest}`);
        } catch (e) {
            console.error(`❌ Copy Error: ${e.message}`);
        }
    } else {
        console.warn(`⚠️ Source not found (skipping): ${m.src}`);
    }
});

console.log('🏁 Sync Complete. PLEASE RESTART SERVERS.');
