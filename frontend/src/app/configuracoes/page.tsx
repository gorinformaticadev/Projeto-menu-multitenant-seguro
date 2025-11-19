"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Shield, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Redirecionar SUPER_ADMIN para página de segurança
  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      router.push("/configuracoes/seguranca");
    }
  }, [user, router]);

  // Mostrar loading enquanto redireciona SUPER_ADMIN
  if (user?.role === "SUPER_ADMIN") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações do sistema
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card de Configurações Gerais */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>Configurações Gerais</CardTitle>
              </div>
              <CardDescription>
                Configurações básicas do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Funcionalidades de configuração geral serão implementadas aqui.
              </p>
            </CardContent>
          </Card>

          {/* Card de Segurança (apenas para visualização do ADMIN) */}
          <Card className="opacity-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Segurança</CardTitle>
              </div>
              <CardDescription>
                Configurações de segurança do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                Apenas SUPER_ADMIN pode acessar configurações de segurança.
              </p>
              <p className="text-xs text-muted-foreground">
                🔒 Acesso restrito
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
