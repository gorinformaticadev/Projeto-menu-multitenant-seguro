"use client";

import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";

import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ModeloClientProps {
  locale: string;
}

export default function ModeloClient({ locale }: ModeloClientProps) {
  const [data, setData] = useState<{ message: string; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const response = await api.get("/modelo");
        setData(response.data);
      } catch (err) {
        console.error(err);
        setError("Falha ao carregar dados do modulo.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-skin-primary/10 p-2">
              <Package className="h-6 w-6 text-skin-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Modulo modelo integrado</CardTitle>
              <CardDescription>
                Demonstracao de integracao completa (Frontend + Backend + Slots)
              </CardDescription>
              <p className="mt-1 text-sm text-skin-text-muted">Locale: {locale}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-skin-primary" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-skin-danger/10 p-4 text-skin-danger">{error}</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-skin-background-elevated p-4">
                <h3 className="mb-2 text-lg font-semibold">Dados do backend</h3>
                <p className="mb-1 text-skin-text-muted">
                  Mensagem: <span className="font-medium text-skin-text">{data?.message}</span>
                </p>
                <p className="text-xs text-skin-text-muted">Timestamp: {data?.timestamp}</p>
              </div>

              <p>
                Esta pagina consome dados da rota <code>/modelo</code> definida no backend do modulo.
              </p>
              <p>Esse modulo tambem injeta conteudo no dashboard e na lista de usuarios.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
