"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, Info } from "lucide-react";
import { usePlatformConfigContext } from "@/contexts/PlatformConfigContext";
import { PlatformConfig } from "@/hooks/usePlatformConfig";

export default function PlatformConfigSection() {
  const { toast } = useToast();
  const { config: contextConfig, loading, refreshConfig } = usePlatformConfigContext();
  const [config, setConfig] = useState<PlatformConfig>({
    platformName: "",
    platformEmail: "",
    platformPhone: "",
  });
  const [saving, setSaving] = useState(false);

  // Sync with context config
  useEffect(() => {
    if (!loading && contextConfig) {
      setConfig(contextConfig);
    }
  }, [contextConfig, loading]);

  // Handle input changes
  const handleInputChange = (field: keyof PlatformConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Save configuration
  const handleSave = async () => {
    try {
      setSaving(true);
      
      await api.put("/platform-config", config);
      
      // Atualizar contexto para refletir mudanças imediatamente
      await refreshConfig();
      
      toast({
        title: "Configurações salvas",
        description: "As configurações da plataforma foram atualizadas com sucesso",
      });
      
    } catch (error: any) {
      toast({
        title: "Erro ao salvar configurações",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
            <div className="text-muted-foreground">Carregando...</div>
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
              value={config.platformName}
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
              value={config.platformEmail}
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
              value={config.platformPhone}
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
            <p><strong>Nome:</strong> {config.platformName || "Sistema Multitenant"}</p>
            <p><strong>Email:</strong> {config.platformEmail || "contato@sistema.com"}</p>
            <p><strong>Telefone:</strong> {config.platformPhone || "(11) 99999-9999"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}