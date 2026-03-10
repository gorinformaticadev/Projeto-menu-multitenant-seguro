"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, Info, Upload, Trash2 } from "lucide-react";
import { usePlatformConfigContext } from "@/contexts/PlatformConfigContext";
import { PlatformConfig } from "@/hooks/usePlatformConfig";
import { resolveTenantLogoSrc } from "@/lib/tenant-logo";

export default function PlatformConfigSection() {
  const { toast } = useToast();
  const { config: contextConfig, loading, refreshConfig } = usePlatformConfigContext();
  const [config, setConfig] = useState<PlatformConfig>({
    platformName: "",
    platformLogoUrl: null,
    platformEmail: "",
    platformPhone: "",
  });
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSubmitting, setLogoSubmitting] = useState(false);
  const [logoCacheBuster, setLogoCacheBuster] = useState<number>(() => Date.now());

  const platformLogoSrc = resolveTenantLogoSrc(config.platformLogoUrl, {
    cacheBuster: logoCacheBuster,
  });

  useEffect(() => {
    if (!loading && contextConfig) {
      setConfig(contextConfig);
      setLogoCacheBuster(Date.now());
    }
  }, [contextConfig, loading]);

  const handleInputChange = (field: keyof PlatformConfig, value: string) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo invalido",
        description: "Selecione uma imagem valida",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no maximo 5MB",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;

    try {
      setLogoSubmitting(true);
      const formData = new FormData();
      formData.append("logo", logoFile);

      await api.post("/api/platform-config/logo", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setLogoFile(null);
      setLogoPreview(null);
      setLogoCacheBuster(Date.now());
      await refreshConfig();

      toast({
        title: "Logo atualizada",
        description: "A logo principal da plataforma foi atualizada com sucesso",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao enviar logo",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLogoSubmitting(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!config.platformLogoUrl) return;

    try {
      setLogoSubmitting(true);
      await api.patch("/api/platform-config/logo/remove");
      setLogoFile(null);
      setLogoPreview(null);
      setLogoCacheBuster(Date.now());
      await refreshConfig();

      toast({
        title: "Logo removida",
        description: "A plataforma voltou para o fallback padrao",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao remover logo",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLogoSubmitting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put("/api/platform-config", {
        platformName: config.platformName,
        platformEmail: config.platformEmail,
        platformPhone: config.platformPhone,
      });
      await refreshConfig();

      toast({
        title: "Configuracoes salvas",
        description: "As configuracoes da plataforma foram atualizadas com sucesso",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao salvar configuracoes",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
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
            Configuracoes da Plataforma
          </CardTitle>
          <CardDescription>
            Carregando configuracoes da plataforma...
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
          Configuracoes da Plataforma
        </CardTitle>
        <CardDescription>
          Configure as informacoes basicas da plataforma exibidas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <h4 className="font-medium">Logo principal da plataforma</h4>
            <p className="text-xs text-muted-foreground">
              Esta imagem aparece no TopBar ao lado do nome da plataforma
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-xl border bg-muted">
              {logoPreview || platformLogoSrc ? (
                <Image
                  src={logoPreview || platformLogoSrc || ""}
                  alt="Logo da plataforma"
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="platform-logo-upload">Selecionar nova logo</Label>
              <Input
                id="platform-logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                disabled={logoSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, GIF e WEBP (maximo 5MB)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleUploadLogo}
              disabled={!logoFile || logoSubmitting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {logoSubmitting ? "Enviando..." : "Salvar Logo"}
            </Button>

            {config.platformLogoUrl && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemoveLogo}
                disabled={logoSubmitting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {logoSubmitting ? "Removendo..." : "Remover Logo"}
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Informacoes da Plataforma</p>
              <ul className="text-xs space-y-1">
                <li>Nome: exibido em emails, titulos e cabecalhos</li>
                <li>Email: campo informativo para contato</li>
                <li>Telefone: campo informativo para contato</li>
                <li>Logo: exibida como marca principal da plataforma</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="platform-name">
              Nome da Plataforma
            </Label>
            <Input
              id="platform-name"
              value={config.platformName}
              onChange={(e) => handleInputChange("platformName", e.target.value)}
              placeholder="Sistema Multitenant"
            />
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
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configuracoes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
