"use client";

import React from 'react';

interface ModulePageClientProps {
    moduleSlug: string;
    slug: string[];
}

/**
 * Cache de módulos carregados dinamicamente
 * Webpack require.context inclui TODOS os arquivos que correspondem ao pattern no build
 * Isso permite carregar módulos sem hardcode - qualquer módulo na pasta modules será incluído
 */

// Função para criar o contexto de módulos dinamicamente
function getModuleContext() {
    // require.context inclui automaticamente TODOS os arquivos no build
    // Pattern: qualquer pasta dentro de modules, qualquer profundidade, arquivos page.tsx
    // Isso NÃO é hardcode - qualquer módulo adicionado à pasta será incluído automaticamente
    const context = require.context(
        '../../',  // Pasta base: modules/
        true,      // Recursivo: busca em subpastas
        /^\.\/[^/]+\/.*page\.tsx$/  // Pattern: ./nome_modulo/**/page.tsx
    );
    
    return context;
}

// Cache do contexto de módulos
let moduleContext: ReturnType<typeof getModuleContext> | null = null;

function loadModuleContext() {
    if (!moduleContext) {
        try {
            moduleContext = getModuleContext();
        } catch (error) {
            console.error('[ModulePage] Erro ao carregar contexto de módulos:', error);
        }
    }
    return moduleContext;
}

/**
 * Busca um componente de página no contexto de módulos
 */
function findPageComponent(moduleSlug: string, route: string): React.ComponentType | null {
    const context = loadModuleContext();
    if (!context) return null;

    // Caminhos possíveis para buscar
    const possiblePaths = [
        `./${moduleSlug}/${route}/page.tsx`,
        `./${moduleSlug}/pages/${route}/page.tsx`,
    ];

    // Se a rota já começa com 'pages/', adiciona variantes sem o prefixo
    if (route.startsWith('pages/')) {
        const routeWithoutPages = route.replace('pages/', '');
        possiblePaths.push(
            `./${moduleSlug}/${routeWithoutPages}/page.tsx`,
        );
    }

    const keys = context.keys();
    console.log('[ModulePage] Arquivos disponíveis para módulo:', keys.filter(k => k.includes(moduleSlug)));

    for (const path of possiblePaths) {
        if (keys.includes(path)) {
            console.log('[ModulePage] Encontrado:', path);
            const module = context(path);
            return module.default || module;
        }
    }

    // Busca alternativa: procurar por match parcial
    const routePattern = route.replace('pages/', '');
    
    for (const key of keys) {
        if (key.startsWith(`./${moduleSlug}/`) && key.includes(routePattern) && key.endsWith('/page.tsx')) {
            console.log('[ModulePage] Match parcial encontrado:', key);
            const module = context(key);
            return module.default || module;
        }
    }

    return null;
}

/**
 * Loader dinâmico de páginas de módulos
 *
 * TOTALMENTE DINÂMICO: Não há hardcode de módulos.
 * O webpack inclui automaticamente TODOS os arquivos page.tsx dentro de modules/
 * Quando um novo módulo é instalado, basta fazer rebuild do frontend.
 */
export default function ModulePageClient({ moduleSlug, slug }: ModulePageClientProps) {
    const route = slug?.join('/') || 'index';

    console.log('[ModulePage] Buscando rota:', { moduleSlug, route });

    const [Component, setComponent] = React.useState<React.ComponentType<unknown> | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);

    const loadModuleComponent = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Busca no contexto dinâmico do webpack
            const PageComponent = findPageComponent(moduleSlug, route);
            
            if (PageComponent) {
                setComponent(() => PageComponent);
                console.log('[ModulePage] Componente carregado:', `${moduleSlug}/${route}`);
                return;
            }

            throw new Error(`Página não encontrada: ${moduleSlug}/${route}`);

        } catch (err: unknown) {
            console.error(`[ModulePage] Falha ao carregar ${moduleSlug}/${route}:`, err);

            const expectedPath = `apps/frontend/src/app/modules/${moduleSlug}/${route}/page.tsx`;

            const errorMessage = `Módulo ou página não encontrada (${moduleSlug}/${route}).\n` +
                `O arquivo não foi encontrado no build do Frontend.\n\n` +
                `Caminho esperado: ${expectedPath}\n\n` +
                `Se o módulo foi recém-instalado, faça rebuild do frontend.`;

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
