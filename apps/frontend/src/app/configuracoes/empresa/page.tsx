"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Settings, Info } from "lucide-react";

export default function EmpresaConfigPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <div className="p-8 text-skin-text">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-skin-text">
            <Building2 className="h-8 w-8" />
            Configurações da Empresa
          </h1>
          <p className="text-skin-text-muted">
            Gerencie as configurações específicas da sua empresa
          </p>
        </div>

        {/* Card de Informações */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-skin-info" />
              <CardTitle>Em Desenvolvimento</CardTitle>
            </div>
            <CardDescription>
              Esta seção está sendo desenvolvida
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-skin-text-muted">
                As configurações da empresa incluirão:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-skin-text-muted">
                <li>Informações básicas da empresa</li>
                <li>Logo e identidade visual</li>
                <li>Configurações de notificações</li>
                <li>Preferências de interface</li>
                <li>Configurações de relatórios</li>
              </ul>
              <div className="mt-6 rounded-lg border border-skin-info/30 bg-skin-info/10 p-4">
                <p className="text-sm text-skin-info">
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
                <span className="rounded bg-skin-info/10 px-2 py-1 text-xs font-medium text-skin-info">
                  {user?.role}
                </span>
              </div>
              <div className="mt-4 rounded-lg border border-skin-success/30 bg-skin-success/10 p-3">
                <p className="text-sm text-skin-success">
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
