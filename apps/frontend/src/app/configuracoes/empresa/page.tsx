"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Settings, Info } from "lucide-react";

export default function EmpresaConfigPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <div className="p-8 text-slate-950 dark:text-slate-50">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-950 dark:text-slate-50">
            <Building2 className="h-8 w-8" />
            Configurações da Empresa
          </h1>
          <p className="text-muted-foreground dark:text-slate-300">
            Gerencie as configurações específicas da sua empresa
          </p>
        </div>

        {/* Card de Informações */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              <CardTitle>Em Desenvolvimento</CardTitle>
            </div>
            <CardDescription>
              Esta seção está sendo desenvolvida
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                As configurações da empresa incluirão:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Informações básicas da empresa</li>
                <li>Logo e identidade visual</li>
                <li>Configurações de notificações</li>
                <li>Preferências de interface</li>
                <li>Configurações de relatórios</li>
              </ul>
              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/70 dark:bg-blue-950/30">
                <p className="text-sm text-blue-800 dark:text-blue-100">
                  <strong>Nota:</strong> Esta funcionalidade será implementada em breve. 
                  Por enquanto, você pode acessar outras áreas do sistema através do menu principal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Acesso Atual */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Seu Acesso Atual</CardTitle>
            </div>
            <CardDescription>
              Informações sobre suas permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Usuário:</span>
                <span className="text-sm">{user?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Nível de Acesso:</span>
                <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
                  {user?.role}
                </span>
              </div>
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/70 dark:bg-green-950/30">
                <p className="text-sm text-green-800 dark:text-green-100">
                  ✓ Você tem permissão para gerenciar configurações da empresa
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
