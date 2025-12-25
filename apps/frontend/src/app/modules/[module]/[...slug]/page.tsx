"use client";

import React from 'react';
import { useParams } from 'next/navigation';

interface ModulePageProps {
    params: {
        module: string;
        slug: string[];
    };
}

/**
 * Rota dinâmica para páginas de módulos
 * Resolve componentes DINAMICAMENTE baseado em convenção de caminhos
 * 
 * PRINCÍPIO: O banco define quais módulos existem, o código resolve onde estão
 */
export default function ModulePage() {
    const params = useParams();
    const moduleSlug = params.module as string;
    const slug = params.slug as string[];
    const route = slug?.join('/') || 'index';

    console.log('🔎 [ModulePage] Carregando página dinâmica:', { moduleSlug, route });

    // Estado para componente carregado
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

            // Convenção de caminho: @modules/{moduleSlug}/frontend/pages/{route}
            // Exemplo: @modules/sistema/frontend/pages/ajustes
            const componentPath = `@modules/${moduleSlug}/frontend/pages/${route}`;

            console.log('📦 [ModulePage] Tentando carregar:', componentPath);

            // Import dinâmico
            const module = await import(
                /* webpackIgnore: true */
                `../../../../../packages/modules/${moduleSlug}/frontend/pages/${route}`
            ).catch(async (err) => {
                // Fallback: tentar com .tsx
                console.log('⚠️ Tentando com extensão .tsx...');
                return await import(
                    /* webpackIgnore: true */
                    `../../../../../packages/modules/${moduleSlug}/frontend/pages/${route}.tsx`
                );
            }).catch(async (err) => {
                // Fallback: tentar index
                console.log('⚠️ Tentando index...');
                return await import(
                    /* webpackIgnore: true */
                    `../../../../../packages/modules/${moduleSlug}/frontend/pages/${route}/index`
                );
            });

            const ComponentToLoad = module.default || module;

            if (!ComponentToLoad) {
                throw new Error('Componente não exporta default');
            }

            setComponent(() => ComponentToLoad);
            console.log('✅ [ModulePage] Componente carregado com sucesso');

        } catch (err: any) {
            console.error(`❌ [ModulePage] Erro ao carregar ${moduleSlug}/${route}:`, err);
            setError(`Não foi possível carregar a página do módulo "${moduleSlug}"`);
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
            <div className="p-6">
                <h2 className="text-2xl font-bold mb-2">Módulo não encontrado</h2>
                <p className="text-muted-foreground mb-4">
                    {error || `O módulo "${moduleSlug}" não possui a página "${route}".`}
                </p>
                <p className="text-sm text-muted-foreground">
                    Caminho esperado: <code className="bg-muted px-2 py-1 rounded">
                        packages/modules/{moduleSlug}/frontend/pages/{route}
                    </code>
                </p>
            </div>
        );
    }

    return <Component />;
}