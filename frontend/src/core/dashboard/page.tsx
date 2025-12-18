"use client";

import { useAuth } from "@/contexts/AuthContext";
import { use2FAStatus } from "@/hooks/use2FAStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Building2, Users, Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardWidgets } from "./DashboardWidgets";

export default function DashboardPage() {
  const { user } = useAuth();
  const { status: twoFactorStatus, loading: twoFactorLoading } = use2FAStatus();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao sistema, {user?.name}!
        </p>
      </div>

      {/* Aviso de 2FA */}
      {!twoFactorLoading && twoFactorStatus && !twoFactorStatus.enabled && twoFactorStatus.suggested && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-yellow-800">Recomendação de Segurança</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Ative a Autenticação de Dois Fatores (2FA) para aumentar a segurança da sua conta.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              onClick={() => window.location.href = '/perfil'}
            >
              Configurar 2FA
            </Button>
          </div>
        </div>
      )}

      {/* Widgets dinâmicos do Module Registry */}
      <DashboardWidgets />

      {/* Cards de informações básicas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seu Perfil</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.role}</div>
            <p className="text-xs text-muted-foreground">
              Nível de acesso
            </p>
          </CardContent>
        </Card>

        {user?.tenant && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresa</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold truncate">
                {user.tenant.nomeFantasia}
              </div>
              <p className="text-xs text-muted-foreground">
                Seu tenant
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Ativo</div>
            <p className="text-xs text-muted-foreground">
              Sistema operacional
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Segurança</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">Alta</div>
            <p className="text-xs text-muted-foreground">
              Isolamento ativo
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
