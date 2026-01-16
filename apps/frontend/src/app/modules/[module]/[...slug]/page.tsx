import ModulePageClient from "./ModulePageClient";

// Required for static export with dynamic routes
export function generateStaticParams() {
    return [];
}

interface PageProps {
    params: {
        module: string;
        slug: string[];
    };
}

export default function ModulePage({ params }: PageProps) {
    return <ModulePageClient moduleSlug={params.module} slug={params.slug} />;
}