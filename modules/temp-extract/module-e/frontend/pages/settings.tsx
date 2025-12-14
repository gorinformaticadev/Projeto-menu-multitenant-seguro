/**
 * PÁGINA DE CONFIGURAÇÕES DO MODULE EXEMPLO
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, RotateCcw, Info } from "lucide-react";

export default function ModuleExemploSettingsPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Configurações do Module Exemplo
          </h1>
          <p className="text-muted-foreground mt-2">
            Configurações do módulo de exemplo (mock).
          </p>
        </div>
        <Badge variant="outline">
          Página de Demonstração
        </Badge>
      </div>

      {/* Configurações Mock */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Configurações Gerais
            </CardTitle>
            <CardDescription>
              Configurações básicas do módulo (simulação)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Módulo</label>
              <div className="p-3 bg-muted rounded-md">
                <span className="text-sm">Module Exemplo</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Versão</label>
              <div className="p-3 bg-muted rounded-md">
                <span className="text-sm">1.0.0</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <div className="p-3 bg-muted rounded-md">
                <Badge variant="secondary" className="text-green-600">
                  Ativo e Funcionando
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações Disponíveis</CardTitle>
            <CardDescription>
              Operações que podem ser realizadas (mock)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" variant="default">
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações (Mock)
            </Button>
            
            <Button className="w-full" variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Padrões (Mock)
            </Button>
            
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                ⚠️ Esta é uma página de demonstração. As configurações são apenas para validação visual do sistema modular.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informações do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema Modular</CardTitle>
          <CardDescription>
            Detalhes sobre a integração com o core
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">✅</div>
              <div className="text-sm font-medium mt-2">Module Registry</div>
              <div className="text-xs text-muted-foreground">Registrado no core</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">✅</div>
              <div className="text-sm font-medium mt-2">Ativação por Empresa</div>
              <div className="text-xs text-muted-foreground">Sistema funcionando</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-purple-600">✅</div>
              <div className="text-sm font-medium mt-2">Integração Completa</div>
              <div className="text-xs text-muted-foreground">Todas as áreas ativas</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}