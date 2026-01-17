import ModeloClient from "./ModeloClient";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function ModeloPage({ params }: PageProps) {
  const { locale } = await params;
  return <ModeloClient locale={locale} />;
}