"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";
import { Loader2, Package } from "lucide-react";

import { ModuleErrorBoundary } from "@/components/ModuleErrorBoundary";

export default function ModeloPage() {
  const [data, setData] = useState<{ message: string; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const active = true;

  useEffect(() => {
    async function loadData() {
      try {
        const response = await api.get('/modelo');
        setData(response.data);
      } catch (err) {
        console.error(err);
        setError("Falha ao carregar dados do módulo.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <ModuleErrorBoundary moduleName="Modelo">
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div className="flex items-center justify-between w-full">
                <h1 className="text-2xl font-bold tracking-tight">Modelo Integrado - Geral</h1>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {active ? 'Módulo Ativo' : 'Módulo Inativo'}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                {error}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg border">
                  <h3 className="font-semibold text-lg mb-2">Dados do Backend</h3>
                  <p className="text-muted-foreground mb-1">Mensagem: <span className="text-foreground font-medium">{data?.message}</span></p>
                  <p className="text-xs text-muted-foreground">Timestamp: {data?.timestamp}</p>
                </div>

                <p>
                  Esta página está consumindo dados da rota <code>/modelo</code> definida no backend do módulo.
                </p>
                <p>
                  Além disso, este módulo injeta conteúdo no Dashboard e na lista de Usuários.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleErrorBoundary>
  );
}