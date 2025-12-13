"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Shield, Building2, Package, Download, Info, CheckCircle, AlertTriangle } from "lucide-react";

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  const quickStats = [
    {
      title: "Nível de Acesso",
      value: user?.role || "N/A",
      description: user?.role === "SUPER_ADMIN" ? "Acesso completo" : "Acesso limitado",
      icon: Shield,
      color: user?.role === "SUPER_ADMIN" ? "text-green-600" : "text-blue-600",
    },
    {
      title: "Usuário Ativo",
      value: user?.name || "N/A",
      description: "Sessão ativa",
      icon: CheckCircle,
      color: "text-green-600",
    },
  ];

  const availableSections = [
    {
      title: "Configurações de Segurança",
      description: "Políticas de segurança, autenticação e controle de acesso",
      icon: Shield,
      available: user?.role === "SUPER_ADMIN",
    },
    {
      title: "Identidade da Plataforma",
      description: "Configure informações básicas da plataforma",
      icon: Building2,
      available: user?.role === "SUPER_ADMIN",
    },
    {
      title: "Gerenciamento de Módulos",
      description: "Instalar, remover e gerenciar módulos do sistema",
      icon: Package,
      available: user?.role === "SUPER_ADMIN",
    },
    {
      title: "Sistema de Updates",
      description: "Gerenciar atualizações automáticas via Git",
      icon: Download,
      available: user?.role === "SUPER_ADMIN",
    },
    {
      title: "Configurações da Empresa",
      description: "Informações e configurações específicas da empresa",
      icon: Building2,
      available: user?.role === "ADMIN",
    },
  ];

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Visão Geral das Configurações
          </h1>
          <p className="text-muted-foreground mt-2">
            Painel de controle das configurações do sistema
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {quickStats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <IconComponent className="h-4 w-4" />
                    {stat.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold mb-1">{stat.value}</div>
                  <p className={`text-sm ${stat.color}`}>{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Available Sections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Seções Disponíveis
            </CardTitle>
            <CardDescription>
              Configurações que você pode acessar com seu nível de permissão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableSections.map((section) => {
                const IconComponent = section.icon;
                return (
                  <div 
                    key={section.title}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      section.available 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <IconComponent className={`h-5 w-5 ${
                      section.available ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1">
                      <div className="font-medium">{section.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {section.description}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {section.available ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Como Usar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>• Use o menu lateral para navegar entre as diferentes seções de configuração</p>
              <p>• Seções marcadas com ✓ estão disponíveis para seu nível de acesso</p>
              <p>• SUPER_ADMIN tem acesso a todas as configurações do sistema</p>
              <p>• ADMIN tem acesso limitado às configurações da empresa</p>
            </div>
          </CardContent>
        </Card>

        {/* User Info */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Informações da Sessão</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Usuário: <span className="font-medium">{user?.name}</span></p>
            <p>Email: <span className="font-medium">{user?.email}</span></p>
            <p>Nível de acesso: <span className="font-medium">{user?.role}</span></p>
            {user?.role === "SUPER_ADMIN" && (
              <p className="text-green-600 mt-1">✓ Acesso completo a todas as configurações</p>
            )}
            {user?.role === "ADMIN" && (
              <p className="text-blue-600 mt-1">ℹ Acesso limitado às configurações da empresa</p>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
