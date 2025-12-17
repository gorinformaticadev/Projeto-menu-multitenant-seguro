import { notFound } from 'next/navigation';
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
export default async function ModulePage({ params }: ModulePageProps) {
    const { module, slug } = params;
    const route = '/' + (slug?.join('/') || '');

    try {
        // Resolve componente via registry
        const Component = await resolveModuleComponent(module, route);

        // Renderiza dinamicamente
        return <Component />;

    } catch (error) {
        console.error(`Erro ao carregar página de módulo ${module}${route}:`, error);

        // 404 se não existir
        notFound();
    }
}

/**
 * Geração de metadados dinâmicos
 */
export async function generateMetadata({ params }: ModulePageProps) {
    const { module, slug } = params;

    // Tentar obter metadados do componente
    try {
        const Component = await resolveModuleComponent(module, '/' + (slug?.join('/') || ''));

        // Se o componente exportar metadata, use
        if (Component.metadata) {
            return Component.metadata;
        }
    } catch (error) {
        // Ignora erro e usa padrão
    }

    return {
        title: `${module} - ${slug?.join('/') || 'Página'}`,
        description: `Página do módulo ${module}`
    };
}