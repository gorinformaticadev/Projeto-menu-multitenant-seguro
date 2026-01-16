import ModeloClient from "./ModeloClient";

interface PageProps {
  params: {
    locale: string;
  };
}

export default function ModeloPage({ params }: PageProps) {
  return <ModeloClient locale={params.locale} />;
}