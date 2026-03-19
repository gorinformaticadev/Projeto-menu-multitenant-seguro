"use client";

import { Shield, Building2, Users, Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { use2FAStatus } from "@/hooks/use2FAStatus";
import { DashboardWidgets } from "./DashboardWidgets";

export default function DashboardPage() {
  const { user } = useAuth();
  const { status: twoFactorStatus, loading: twoFactorLoading } = use2FAStatus();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-skin-text-muted">Bem-vindo ao sistema, {user?.name}!</p>
      </div>

      {!twoFactorLoading && twoFactorStatus && !twoFactorStatus.enabled && twoFactorStatus.suggested && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-skin-warning/30 bg-skin-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-skin-warning" />
          <div>
            <h3 className="font-medium text-skin-warning">Recomendacao de Seguranca</h3>
            <p className="mt-1 text-sm text-skin-warning">
              Ative a Autenticacao de Dois Fatores (2FA) para aumentar a seguranca da sua conta.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-skin-warning/40 bg-skin-warning/15 text-skin-warning hover:bg-skin-warning/20"
              onClick={() => {
                window.location.href = "/perfil";
              }}
            >
              Configurar 2FA
            </Button>
          </div>
        </div>
      )}

      <DashboardWidgets />

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seu Perfil</CardTitle>
            <Shield className="h-4 w-4 text-skin-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.role}</div>
            <p className="text-xs text-skin-text-muted">Nivel de acesso</p>
          </CardContent>
        </Card>

        {user?.tenant && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresa</CardTitle>
              <Building2 className="h-4 w-4 text-skin-text-muted" />
            </CardHeader>
            <CardContent>
              <div className="truncate text-2xl font-bold">{user.tenant.nomeFantasia}</div>
              <p className="text-xs text-skin-text-muted">Seu tenant</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Users className="h-4 w-4 text-skin-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-skin-success">Ativo</div>
            <p className="text-xs text-skin-text-muted">Sistema operacional</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seguranca</CardTitle>
            <Settings className="h-4 w-4 text-skin-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-skin-info">Alta</div>
            <p className="text-xs text-skin-text-muted">Isolamento ativo</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
