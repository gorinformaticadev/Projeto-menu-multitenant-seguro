'use client';

import { useEffect } from 'react';
import { moduleRegistry } from '@/lib/module-registry';
// Importação estática dos módulos locais
// @ts-ignore - O TS pode não reconhecer o alias imediatamente durante a migração
// import { SistemaModule } from '@modules/sistema';

export function ModuleLoader() {
    useEffect(() => {
        // Registra os módulos disponíveis no bundle
        // moduleRegistry.register(SistemaModule);

        // Futuro: Registrar outros módulos aqui
        // moduleRegistry.register(FinanceiroModule);

    }, []);

    return null;
}
