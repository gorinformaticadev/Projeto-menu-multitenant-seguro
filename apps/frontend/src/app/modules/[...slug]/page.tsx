import DynamicModulePageClient from "./DynamicModulePageClient";

// Required for static export with dynamic routes
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: {
    slug: string[];
  };
}

export default function DynamicModulePage({ params }: PageProps) {
  return <DynamicModulePageClient slug={params.slug} />;
}