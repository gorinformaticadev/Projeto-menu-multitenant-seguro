/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const root = process.cwd();

const mappings = [
    // Backend Service (Fix UUID error)
    {
        src: 'module-os/backend/services/produtos.service.ts',
        dest: 'apps/backend/src/modules/ordem_servico/services/produtos.service.ts'
    },
    // Backend Controller (Ensure latest)
    {
        src: 'module-os/backend/controllers/produtos.controller.ts',
        dest: 'apps/backend/src/modules/ordem_servico/controllers/produtos.controller.ts'
    },
    // Backend Module (Ensure injection)
    {
        src: 'module-os/backend/ordem_servico.module.ts',
        dest: 'apps/backend/src/modules/ordem_servico/ordem_servico.module.ts'
    },
    // Frontend Pages
    {
        src: 'module-os/frontend/pages/produtos/page.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/pages/produtos/page.tsx'
    },
    {
        src: 'module-os/frontend/pages/clientes/page.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/pages/clientes/page.tsx'
    },
    {
        src: 'module-os/frontend/pages/dashboard/page.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/pages/dashboard/page.tsx'
    },
    {
        src: 'module-os/frontend/pages/ordens/page.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/pages/ordens/page.tsx'
    },
    {
        src: 'module-os/frontend/pages/ordens/new/page.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/pages/ordens/new/page.tsx'
    },
    {
        src: 'module-os/frontend/pages/configuracoes/page.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/pages/configuracoes/page.tsx'
    },
    // Frontend Routes
    {
        src: 'module-os/frontend/routes.tsx',
        dest: 'apps/frontend/src/app/modules/ordem_servico/routes.tsx'
    },
    // Frontend Menu
    {
        src: 'module-os/frontend/menu.ts',
        dest: 'apps/frontend/src/app/modules/ordem_servico/menu.ts'
    },
    // Backend Logic
    {
        src: 'module-os/backend/services/ordens.service.ts',
        dest: 'apps/backend/src/modules/ordem_servico/services/ordens.service.ts'
    },
    // DTOs and Types
    {
        src: 'module-os/backend/dto/ordem-servico.dto.ts',
        dest: 'apps/backend/src/modules/ordem_servico/dto/ordem-servico.dto.ts'
    },
    {
        src: 'module-os/frontend/types/ordem-servico.types.ts',
        dest: 'apps/frontend/src/app/modules/ordem_servico/types/ordem-servico.types.ts'
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
