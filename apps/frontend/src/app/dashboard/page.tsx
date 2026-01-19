"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { use2FAStatus } from "@/hooks/use2FAStatus";
import { useModuleFeatures } from "@/hooks/useModuleFeatures";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Building2, Users, Settings, AlertTriangle } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleSlot } from "@/components/ModuleSlot";
import { ModuleRegistryWidgets } from "@/components/ModuleRegistryWidgets";

import { PlatformName } from "@/components/PlatformInfo";

// Helper para ícones dinâmicos
const getIconComponent = (iconName: string): React.ComponentType<any> => {
  return (LucideIcons as unknown as Record<string, React.ComponentType<any>>)[iconName] || LucideIcons.HelpCircle;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { status: twoFactorStatus, loading: twoFactorLoading } = use2FAStatus();
  const { features: moduleFeatures } = useModuleFeatures();

  return (
    <div className="p-8">
      {/* Slot Injetado no Topo */}
      <ModuleSlot position="dashboard_top" className="mb-6" />

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao <PlatformName />, {user?.name}!
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seu Perfil</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{user?.role}</div>
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
              <div className="text-xl font-bold truncate">
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
            <div className="text-xl font-bold text-green-600">Ativo</div>
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
            <div className="text-xl font-bold text-blue-600">Alta</div>
            <p className="text-xs text-muted-foreground">
              Isolamento ativo
            </p>
          </CardContent>
        </Card>

        {/* Widgets Dinâmicos dos Módulos (Sistema Antigo) */}
        {moduleFeatures.dashboardWidgets.map((widget, index) => {
          const Icon = getIconComponent(widget.icon);
          return (
            <Card key={`module-widget-${index}`} className="border-blue-200 bg-blue-50/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-900">{widget.title}</CardTitle>
                <Icon className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-sm text-blue-800 mb-2">{widget.description}</div>
                {widget.actionUrl && (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-blue-600 font-semibold text-xs"
                    onClick={() => window.location.href = widget.actionUrl as string}
                  >
                    {widget.actionLabel || 'Acessar'} &rarr;
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Widgets do Module Registry (Sistema Novo) */}
        <ModuleRegistryWidgets />
      </div>

    </div>
  );
}
