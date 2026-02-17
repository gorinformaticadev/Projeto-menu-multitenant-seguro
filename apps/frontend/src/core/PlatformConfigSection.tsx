"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, Info, RefreshCw } from "lucide-react";
import { usePlatformConfigContext } from "@/contexts/PlatformConfigContext";
import { PlatformConfig } from "@/hooks/usePlatformConfig";

export default function PlatformConfigSection() {
  const { toast } = useToast();
  // Usar o contexto para dados globais e função de recarga
  const { config: globalConfig, loading: globalLoading, refreshConfig } = usePlatformConfigContext();

  // Estado local para o formulário
  const [formData, setFormData] = useState<PlatformConfig>({
    platformName: "",
    platformEmail: "",
    platformPhone: "",
  });

  const [saving, setSaving] = useState(false);

  // Sincronizar estado local com configurações globais quando carregadas
  useEffect(() => {
    if (!globalLoading && globalConfig) {
      setFormData(globalConfig);
    }
  }, [globalConfig, globalLoading]);

  // Handle input changes
  const handleInputChange = (field: keyof PlatformConfig, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Save configuration
  const handleSave = async () => {
    try {
      setSaving(true);

      await api.put("/api/platform-config", formData);

      // Forçar atualização do contexto global (Isso atualiza o título no navegador)
      await refreshConfig();

      toast({
        title: "Configurações salvas",
        description: "As configurações da plataforma foram atualizadas com sucesso",
      });
    } catch (error: unknown) {
      const description = (error as any).response?.data?.message || (error instanceof Error ? error.message : "Erro desconhecido");
      toast({
        title: "Erro ao salvar configurações",
        description,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (globalLoading && !formData.platformName) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Configurações da Plataforma
          </CardTitle>
          <CardDescription>
            Carregando configurações da plataforma...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Carregando...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Configurações da Plataforma
        </CardTitle>
        <CardDescription>
          Configure as informações básicas da plataforma que serão exibidas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Informações importantes */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Informações da Plataforma</p>
              <ul className="text-xs space-y-1">
                <li>• <strong>Nome:</strong> Será exibido em emails, títulos e cabeçalhos</li>
                <li>• <strong>Email:</strong> Campo informativo para contato (não usado para envios)</li>
                <li>• <strong>Telefone:</strong> Campo informativo para contato</li>
                <li>• Essas informações ficam disponíveis em todo o sistema via constantes</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="platform-name">
              Nome da Plataforma *
            </Label>
            <Input
              id="platform-name"
              value={formData.platformName}
              onChange={(e) => handleInputChange("platformName", e.target.value)}
              placeholder="Sistema Multitenant"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nome que aparecerá em emails, títulos e outras partes do sistema
            </p>
          </div>

          <div>
            <Label htmlFor="platform-email">
              Email de Contato
            </Label>
            <Input
              id="platform-email"
              type="email"
              value={formData.platformEmail}
              onChange={(e) => handleInputChange("platformEmail", e.target.value)}
              placeholder="contato@sistema.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email informativo para contato (não é usado para envio de emails do sistema)
            </p>
          </div>

          <div>
            <Label htmlFor="platform-phone">
              Telefone de Contato
            </Label>
            <Input
              id="platform-phone"
              type="tel"
              value={formData.platformPhone}
              onChange={(e) => handleInputChange("platformPhone", e.target.value)}
              placeholder="(11) 99999-9999"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Telefone informativo para contato
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>

        {/* Preview das configurações */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Preview das Configurações
          </h4>
          <div className="text-sm space-y-1">
            <p><strong>Nome:</strong> {formData.platformName || "Sistema Multitenant"}</p>
            <p><strong>Email:</strong> {formData.platformEmail || "contato@sistema.com"}</p>
            <p><strong>Telefone:</strong> {formData.platformPhone || "(11) 99999-9999"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
