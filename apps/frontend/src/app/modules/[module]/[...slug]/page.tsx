import ModulePageClient from "./ModulePageClient";

interface PageProps {
    params: Promise<{
        module: string;
        slug: string[];
    }>;
}

export default async function ModulePage({ params }: PageProps) {
    const resolvedParams = await params;
    return <ModulePageClient moduleSlug={resolvedParams.module} slug={resolvedParams.slug} />;
}