"use client";

import React from 'react';

interface ModulePageClientProps {
    moduleSlug: string;
    slug: string[];
}

/**
 * Loader dinâmico de páginas de módulos (FALLBACK)
 *
 * ATENÇÃO: O Next.js deve priorizar pastas estáticas (ex: modules/sistema).
 * Este loader serve apenas como fallback para rotas não mapeadas fisicamente.
 *
 * CAMINHO DE BUSCA:
 * - apps/frontend/src/app/modules/{moduleSlug}/{route}/page.tsx
 */
export default function ModulePageClient({ moduleSlug, slug }: ModulePageClientProps) {
    // Rota é o caminho completo após /modules/{moduleSlug}/
    const route = slug?.join('/') || 'index';

    console.log('[ModulePage] Buscando rota (fallback):', { moduleSlug, route });

    const [Component, setComponent] = React.useState<React.ComponentType<unknown> | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);

    const loadModuleComponent = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Tenta carregar do diretório FRONTEND
            // Caminho relativo: ../../{moduleSlug}/{route}/page
            const importedModule = await import(
                /* @vite-ignore */
                `../../${moduleSlug}/${route}/page`
            );

            const ComponentToLoad = importedModule.default;

            if (!ComponentToLoad) {
                throw new Error('O arquivo page.tsx não exporta um componente default');
            }

            setComponent(() => ComponentToLoad);
            console.log('[ModulePage] Componente carregado:', `${moduleSlug}/${route}`);

        } catch (err: unknown) {
            console.error(`[ModulePage] Falha ao carregar ${moduleSlug}/${route}:`, err);

            const expectedPath = `apps/frontend/src/app/modules/${moduleSlug}/${route}/page.tsx`;

            let errorMessage = `Página não encontrada.\n\n` +
                `Caminho buscado:\n${expectedPath}\n\n` +
                `Verifique se o arquivo existe e se a URL contém o caminho completo (ex: /pages/dashboard).`;

            if (err instanceof Error && (err.message.includes('Cannot find module'))) {
                errorMessage = `Módulo ou página não encontrada (${moduleSlug}/${route}).\n` +
                    `O arquivo não foi encontrado no build do Frontend.\n\n` +
                    `Caminho esperado: ${expectedPath}`;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [moduleSlug, route]);

    React.useEffect(() => {
        loadModuleComponent();
    }, [loadModuleComponent]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Carregando...</p>
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
                        <strong>Estrutura Esperada:</strong>
                        <code className="block mt-2 bg-blue-100 px-3 py-2 rounded">
                            apps/frontend/src/app/modules/&#123;module&#125;/&#123;route&#125;/page.tsx
                        </code>
                    </p>
                </div>
            </div>
        );
    }

    return <Component />;
}
