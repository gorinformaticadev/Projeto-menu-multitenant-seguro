"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Shield, Download, Building2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  const configSections = [
    {
      title: "Configurações de Segurança",
      description: "Políticas de segurança, autenticação e controle de acesso",
      icon: Shield,
      href: "/configuracoes/seguranca",
      show: user?.role === "SUPER_ADMIN",
      restricted: false,
    },
    {
      title: "Sistema de Atualizações",
      description: "Gerenciar atualizações automáticas via Git",
      icon: Download,
      href: "/configuracoes/sistema/updates",
      show: user?.role === "SUPER_ADMIN",
      restricted: false,
    },
    {
      title: "Configurações da Empresa",
      description: "Informações e configurações específicas da empresa",
      icon: Building2,
      href: "/configuracoes/empresa",
      show: user?.role === "ADMIN",
      restricted: false,
    },
    {
      title: "Configurações Gerais",
      description: "Configurações básicas do sistema",
      icon: Settings,
      href: "#",
      show: true,
      restricted: true,
    },
  ];

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-skin-text-muted">
            Gerencie as configurações do sistema
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {configSections.map((section) => {
            if (!section.show) return null;

            const Icon = section.icon;
            const isRestricted = section.restricted;

            return (
              <Card 
                key={section.title}
                className={isRestricted ? "opacity-50" : "hover:shadow-md transition-shadow"}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                  <CardDescription>
                    {section.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isRestricted ? (
                    <div>
                      <p className="mb-4 text-sm text-skin-text-muted">
                        Funcionalidades em desenvolvimento.
                      </p>
                      <p className="text-xs text-skin-text-muted">
                        🚧 Em breve
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-skin-text-muted">
                        Clique para acessar
                      </p>
                      <Button asChild variant="outline" size="sm">
                        <Link href={section.href} className="flex items-center gap-2">
                          Acessar
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Informações do usuário */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-skin-text-muted" />
            <span className="text-sm font-medium">Informações de Acesso</span>
          </div>
          <div className="text-sm text-skin-text-muted">
            <p>Usuário: <span className="font-medium">{user?.name}</span></p>
            <p>Nível de acesso: <span className="font-medium">{user?.role}</span></p>
            {user?.role === "SUPER_ADMIN" && (
              <p className="mt-1 text-skin-success">✓ Acesso completo a todas as configurações</p>
            )}
            {user?.role === "ADMIN" && (
              <p className="mt-1 text-skin-info">ℹ Acesso limitado às configurações da empresa</p>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
