import DynamicModulePageClient from "./DynamicModulePageClient";

interface PageProps {
  params: {
    slug: string[];
  };
}

export default function DynamicModulePage({ params }: PageProps) {
  return <DynamicModulePageClient slug={params.slug} />;
}