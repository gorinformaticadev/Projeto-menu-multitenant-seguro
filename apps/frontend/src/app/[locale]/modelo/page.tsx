import ModeloClient from "./ModeloClient";

// Required for static export with dynamic routes
export function generateStaticParams() {
  return [
    { locale: 'pt-BR' },
    { locale: 'en' },
    { locale: 'es' }
  ];
}

interface PageProps {
  params: {
    locale: string;
  };
}

export default function ModeloPage({ params }: PageProps) {
  return <ModeloClient locale={params.locale} />;
}