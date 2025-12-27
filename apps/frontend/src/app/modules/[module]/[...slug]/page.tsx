"use client";

import React from 'react';
import { useParams } from 'next/navigation';

/**
 * Loader dinâmico de páginas de módulos
 * 
 * CONVENÇÃO OFICIAL OBRIGATÓRIA:
 * - URL: /modules/{moduleSlug}/{route-slug}
 * - Estrutura: apps/backend/src/modules/{moduleSlug}/frontend/pages/{route-slug}/page.tsx
 * 
 * EXEMPLO:
 * - URL: /modules/sistema/model-notification
 * - Arquivo: apps/backend/src/modules/sistema/frontend/pages/model-notification/page.tsx
 * 
 * PRINCÍPIOS:
 * - Sem conversões mágicas (camelCase ↔ kebab-case)
 * - Sem fallbacks múltiplos
 * - Sem tentativas de adivinhar nomes
 * - Import direto do caminho esperado
 */
export default function ModulePage() {
    const params = useParams();
    const moduleSlug = params.module as string;
    const slug = params.slug as string[];

    // Rota é o caminho completo após /modules/{moduleSlug}/
    // Ex: ['model-notification'] -> 'model-notification'
    // Ex: ['relatorios', 'vendas'] -> 'relatorios/vendas'
    const route = slug?.join('/') || 'index';

    console.log('🔎 [ModulePage] Parâmetros:', { moduleSlug, slug, route });

    const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        loadModuleComponent();
    }, [moduleSlug, route]);

    async function loadModuleComponent() {
        try {
            setLoading(true);
            setError(null);

            // Caminho esperado: apps/backend/src/modules/{moduleSlug}/frontend/pages/{route}/page.tsx
            // Usando alias @modules configurado no tsconfig.json
            // Caminho relativo calculado para sair de apps/frontend/src/app/modules/[module]/[...slug]
            // até apps/backend/src/modules
            // Níveis: [...slug] -> [module] -> modules -> app -> src -> frontend -> apps -> root -> apps -> backend -> src -> modules
            // Mas o import dinâmico do Webpack resolve relativo ao arquivo fonte
            // Caminho: ../../../../../../backend/src/modules/${moduleSlug}/frontend/pages/${route}/page

            // Tenta carregar usando import relativo para garantir que o Webpack encontre a árvore de arquivos
            // mesmo que o alias @modules falhe se não houver módulos com frontend
            const module = await import(
                /* @vite-ignore */
                `../../../../../../backend/src/modules/${moduleSlug}/frontend/pages/${route}/page`
            );

            const ComponentToLoad = module.default;

            if (!ComponentToLoad) {
                throw new Error('O arquivo page.tsx não exporta um componente default');
            }

            setComponent(() => ComponentToLoad);
            console.log('✅ [ModulePage] Componente carregado com sucesso');

        } catch (err: any) {
            console.error(`❌ [ModulePage] Erro ao carregar ${moduleSlug}/${route}:`, err);

            const expectedPath = `apps/backend/src/modules/${moduleSlug}/frontend/pages/${route}/page.tsx`;
            let errorMessage = `Página não encontrada.\n\n` +
                `Caminho esperado:\n${expectedPath}\n\n` +
                `Verifique se:\n` +
                `1. O diretório existe: apps/backend/src/modules/${moduleSlug}/frontend/pages/${route}/\n` +
                `2. O arquivo page.tsx existe dentro do diretório\n` +
                `3. O arquivo exporta: export default function Page() { ... }`;

            // Tratamento específico para módulo ou página não encontrada
            if (err.message && (err.message.includes('Cannot find module') || err.code === 'MODULE_NOT_FOUND')) {
                errorMessage = `Módulo ou página não encontrada (${moduleSlug}/${route}).\n` +
                    `O sistema tentou carregar dinamicamente o arquivo, mas ele não existe ou não foi incluído no build.\n\n` +
                    `Caminho: ${expectedPath}`;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Carregando módulo...</p>
                </div>
            </div>
        );
    }

    if (error || !Component) {
        return (
            <div className="p-6 max-w-3xl">
                <h2 className="text-2xl font-bold mb-4 text-destructive">Página não encontrada</h2>
                <div className="bg-muted p-4 rounded-lg mb-4 font-mono text-sm">
                    <pre className="whitespace-pre-wrap">{error}</pre>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong>Módulo:</strong> <code className="bg-muted px-2 py-1 rounded">{moduleSlug}</code></p>
                    <p><strong>Rota:</strong> <code className="bg-muted px-2 py-1 rounded">{route}</code></p>
                </div>
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-blue-900 text-sm">
                        <strong>📘 Convenção:</strong> Todas as páginas de módulos devem seguir a estrutura:
                        <code className="block mt-2 bg-blue-100 px-3 py-2 rounded">
                            packages/modules/&#123;moduleSlug&#125;/frontend/pages/&#123;route&#125;/page.tsx
                        </code>
                    </p>
                </div>
            </div>
        );
    }

    return <Component />;
}