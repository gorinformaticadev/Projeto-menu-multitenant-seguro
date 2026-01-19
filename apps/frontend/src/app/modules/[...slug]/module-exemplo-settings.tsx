/**
 * PROXY HÍBRIDO PARA PÁGINA DE CONFIGURAÇÕES DO MODULE EXEMPLO
 * 
 * Este componente oferece duas opções:
 * 1. Versão independente (carregada da pasta modules/)
 * 2. Versão integrada (com funcionalidades do sistema principal)
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Package,
  ToggleLeft,
  ToggleRight,
  Info,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

export default function ModuleExemploSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'independent' | 'integrated'>('integrated');
  const [loading, setLoading] = useState(false);

  // Carregar módulo independente
  const loadIndependentModule = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/modules/module-exemplo/frontend/pages/settings.js');
      if (!response.ok) {
        throw new Error('Módulo independente não encontrado');
      }

      const moduleCode = await response.text();

      // Executar o código do módulo JavaScript
      const moduleFunction = new Function('window', 'document', moduleCode);

      moduleFunction(window, document);

      // Obter e renderizar o componente
      const ModuleComponent = (window as unknown as { ModuleExemploSettingsPage: any }).ModuleExemploSettingsPage;

      if (containerRef.current && ModuleComponent) {
        const moduleInstance = ModuleComponent();
        const renderedElement = moduleInstance.render();

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderedElement);
      }

    } catch (error) {
      console.error('Erro ao carregar módulo independente:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar módulo independente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Alternar entre modos
  const toggleMode = () => {
    const newMode = mode === 'independent' ? 'integrated' : 'independent';
    setMode(newMode);

    if (newMode === 'independent') {
      loadIndependentModule();
    }
  };

  // Carregar módulo independente quando necessário
  useEffect(() => {
    if (mode === 'independent') {
      loadIndependentModule();
    }
  }, [mode, loadIndependentModule]);

  // Versão integrada (com funcionalidades do sistema principal)
  const renderIntegratedVersion = () => (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configurações do Module Exemplo</h1>
            <p className="text-gray-600">Versão integrada com funcionalidades avançadas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Versão Integrada
          </Badge>
          <Badge variant="outline">
            v1.0.0
          </Badge>
        </div>
      </div>

      {/* Toggle de Modo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Modo de Exibição
          </CardTitle>
          <CardDescription>
            Alterne entre a versão independente e integrada do módulo
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-sm">
                {mode === 'integrated' ? 'Versão Integrada' : 'Versão Independente'}
              </p>
              <p className="text-xs text-gray-600">
                {mode === 'integrated'
                  ? 'Com acesso a contextos, hooks e componentes do sistema principal'
                  : 'Módulo completamente independente, sem dependências externas'
                }
              </p>
            </div>
            <Button
              onClick={toggleMode}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              {mode === 'integrated' ? (
                <ToggleLeft className="h-4 w-4 mr-2" />
              ) : (
                <ToggleRight className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Carregando...' : 'Alternar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configurações Integradas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informações do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Informações do Sistema
            </CardTitle>
            <CardDescription>
              Dados obtidos do contexto de autenticação
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm text-gray-900 mb-2">Usuário Atual</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <p><strong>Nome:</strong> {user?.name || 'N/A'}</p>
                <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
                <p><strong>Role:</strong> {user?.role || 'N/A'}</p>
                {user?.tenant && (
                  <p><strong>Empresa:</strong> {user.tenant.nomeFantasia}</p>
                )}
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-sm text-blue-900 mb-2">Funcionalidades Integradas</h4>
              <div className="space-y-1 text-xs text-blue-700">
                <p>✅ Contexto de Autenticação</p>
                <p>✅ Sistema de Toast/Notificações</p>
                <p>✅ Componentes UI do Sistema</p>
                <p>✅ Hooks Personalizados</p>
                <p>✅ Serviços do Backend</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações Avançadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações Avançadas
            </CardTitle>
            <CardDescription>
              Funcionalidades disponíveis apenas na versão integrada
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              onClick={() => toast({
                title: "Configuração Salva!",
                description: "As configurações foram salvas com sucesso.",
              })}
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Salvar com Toast Integrado
            </Button>

            <Button
              onClick={() => toast({
                title: "Aviso do Sistema",
                description: "Esta é uma funcionalidade integrada.",
                variant: "destructive",
              })}
              variant="outline"
              className="w-full"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Testar Notificação de Erro
            </Button>

            <div className="p-3 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-green-900 mb-1">Sistema Híbrido</p>
                  <p className="text-green-700">
                    Esta versão combina o módulo independente com as funcionalidades
                    avançadas do sistema principal através de componentes proxy.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparação de Arquiteturas */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Comparação de Arquiteturas</CardTitle>
          <CardDescription>
            Entenda as diferenças entre as duas abordagens
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">🔗 Versão Integrada (Atual)</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Acesso completo ao contexto de autenticação</li>
                <li>• Sistema de notificações toast integrado</li>
                <li>• Componentes UI compartilhados (shadcn/ui)</li>
                <li>• Hooks personalizados do sistema</li>
                <li>• Serviços e APIs do backend</li>
                <li>• Funcionalidades avançadas</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-green-600">🏗️ Versão Independente</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Completamente independente</li>
                <li>• Sem dependências externas</li>
                <li>• Distribuível como arquivo ZIP</li>
                <li>• Carregamento dinâmico puro</li>
                <li>• Funciona isoladamente</li>
                <li>• Ideal para distribuição</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Renderizar baseado no modo
  if (mode === 'independent') {
    return (
      <div>
        {/* Botão para voltar à versão integrada */}
        <div className="fixed top-4 right-4 z-50">
          <Button
            onClick={toggleMode}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <ToggleLeft className="h-4 w-4 mr-2" />
            Versão Integrada
          </Button>
        </div>

        {/* Container para módulo independente */}
        <div ref={containerRef} className="min-h-screen">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Carregando módulo independente...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return renderIntegratedVersion();
}