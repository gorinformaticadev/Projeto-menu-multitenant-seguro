import ModulePageClient from "./ModulePageClient";

interface PageProps {
    params: {
        module: string;
        slug: string[];
    };
}

export default function ModulePage({ params }: PageProps) {
    return <ModulePageClient moduleSlug={params.module} slug={params.slug} />;
}