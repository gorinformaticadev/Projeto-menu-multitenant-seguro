import DynamicModulePageClient from "./DynamicModulePageClient";

interface PageProps {
  params: Promise<{
    slug: string[];
  }>;
}

export default async function DynamicModulePage({ params }: PageProps) {
  const resolvedParams = await params;
  return <DynamicModulePageClient slug={resolvedParams.slug} />;
}