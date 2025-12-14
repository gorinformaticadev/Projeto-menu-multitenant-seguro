/**
 * PÁGINA PRINCIPAL DO MODULE EXEMPLO
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Package, Settings, Users } from "lucide-react";

export default function ModuleExemploPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Module Exemplo</h1>
          <p className="text-muted-foreground mt-2">
            Este é o módulo de exemplo funcionando corretamente.
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          Ativo
        </Badge>
      </div>

      {/* Cards informativos */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Módulo</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Funcionando</div>
            <p className="text-xs text-muted-foreground">
              Módulo carregado com sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integração</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">Core</div>
            <p className="text-xs text-muted-foreground">
              Integrado ao sistema principal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acesso</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">Autorizado</div>
            <p className="text-xs text-muted-foreground">
              Usuário tem permissão de acesso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo principal */}
      <Card>
        <CardHeader>
          <CardTitle>Funcionalidades do Módulo</CardTitle>
          <CardDescription>
            Demonstração das capacidades do sistema modular
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">✅ Menu Lateral</h4>
              <p className="text-sm text-muted-foreground">
                Item "Module Exemplo" adicionado automaticamente ao menu lateral
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">✅ Dashboard Widget</h4>
              <p className="text-sm text-muted-foreground">
                Widget do módulo aparece no dashboard principal
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">✅ Notificações</h4>
              <p className="text-sm text-muted-foreground">
                Sistema de notificações integrado ao core
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">✅ Menu do Usuário</h4>
              <p className="text-sm text-muted-foreground">
                Acesso rápido disponível no menu do usuário
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}