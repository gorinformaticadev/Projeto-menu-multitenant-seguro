"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { resolveModuleComponent } from '@/modules/registry';

interface ModulePageProps {
    params: {
        module: string;
        slug: string[];
    };
}

/**
 * Rota dinâmica para páginas de módulos
 * Resolve componentes via registry.ts
 */
export default function ModulePage() {
    const params = useParams();
    const module = params.module as string;
    const slug = params.slug as string[];
    const route = '/' + (slug?.join('/') || '');

    console.log('🔎 [ModulePage] Parâmetros recebidos:', { module, slug, route });

    try {
        console.log('🔍 [ModulePage] Tentando resolver componente:', { module, route });
        
        // Resolve componente via registry (client-side)
        const ModulePages = require('@/modules/registry').modulePages;
        const modulePagesMap = ModulePages[module];
        
        if (!modulePagesMap) {
            console.error('❌ [ModulePage] Módulo não encontrado:', module);
            return (
                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-2">Módulo não encontrado</h2>
                    <p className="text-muted-foreground">O módulo <code>{module}</code> não foi registrado.</p>
                </div>
            );
        }
        
        const pageLoader = modulePagesMap[route];
        if (!pageLoader) {
            console.error('❌ [ModulePage] Página não encontrada:', route);
            return (
                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-2">Página não encontrada</h2>
                    <p className="text-muted-foreground">A rota <code>{route}</code> não existe no módulo {module}.</p>
                </div>
            );
        }
        
        // Lazy load do componente
        const Component = React.lazy(pageLoader);

        console.log('✅ [ModulePage] Componente resolvido com sucesso');
        
        // Renderiza dinamicamente com Suspense
        return (
            <React.Suspense fallback={<div className="p-6">Carregando...</div>}>
                <Component />
            </React.Suspense>
        );

    } catch (error) {
        console.error(`❌ [ModulePage] Erro ao carregar página de módulo ${module}${route}:`, error);

        return (
            <div className="p-6">
                <h2 className="text-2xl font-bold mb-2">Erro ao carregar página</h2>
                <p className="text-muted-foreground">Ocorreu um erro ao tentar carregar a página.</p>
            </div>
        );
    }
}