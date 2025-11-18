"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, AlertTriangle } from "lucide-react";

interface SecurityConfig {
  id: string;
  loginMaxAttempts: number;
  loginWindowMinutes: number;
  globalMaxRequests: number;
  globalWindowMinutes: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecial: boolean;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  sessionTimeout: number;
  updatedAt: string;
  updatedBy: string | null;
}

export default function SecurityConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Redirecionar se não for SUPER_ADMIN
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      window.location.href = "/dashboard";
    }
  }, [user]);

  // Carregar configurações
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await api.get("/security-config");
        setConfig(response.data);
      } catch (error: any) {
        toast({
          title: "Erro ao carregar configurações",
          description: error.response?.data?.message || "Erro desconhecido",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === "SUPER_ADMIN") {
      fetchConfig();
    }
  }, [user, toast]);

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      await api.put("/security-config", config);
      toast({
        title: "Configurações salvas",
        description: "As configurações de segurança foram atualizadas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof SecurityConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (user?.role !== "SUPER_ADMIN") {
    return null;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">Carregando configurações...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          Erro ao carregar configurações
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Configurações de Segurança
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie as políticas de segurança do sistema
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      {/* Aviso */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Atenção!</p>
                <p>
                  Alterações nas configurações de segurança afetam todo o sistema.
                  Certifique-se de entender o impacto antes de salvar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limiting</CardTitle>
            <CardDescription>
              Controle o número de requisições permitidas para prevenir ataques de força bruta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="loginMaxAttempts">
                  Tentativas de Login (por período)
                </Label>
                <Input
                  id="loginMaxAttempts"
                  type="number"
                  min="1"
                  max="100"
                  value={config.loginMaxAttempts}
                  onChange={(e) =>
                    updateConfig("loginMaxAttempts", parseInt(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Número máximo de tentativas de login permitidas
                </p>
              </div>

              <div>
                <Label htmlFor="loginWindowMinutes">
                  Janela de Tempo (minutos)
                </Label>
                <Input
                  id="loginWindowMinutes"
                  type="number"
                  min="1"
                  max="60"
                  value={config.loginWindowMinutes}
                  onChange={(e) =>
                    updateConfig("loginWindowMinutes", parseInt(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Período de tempo para contagem de tentativas
                </p>
              </div>

              <div>
                <Label htmlFor="globalMaxRequests">
                  Requisições Globais (por período)
                </Label>
                <Input
                  id="globalMaxRequests"
                  type="number"
                  min="10"
                  max="1000"
                  value={config.globalMaxRequests}
                  onChange={(e) =>
                    updateConfig("globalMaxRequests", parseInt(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Número máximo de requisições globais
                </p>
              </div>

              <div>
                <Label htmlFor="globalWindowMinutes">
                  Janela Global (minutos)
                </Label>
                <Input
                  id="globalWindowMinutes"
                  type="number"
                  min="1"
                  max="60"
                  value={config.globalWindowMinutes}
                  onChange={(e) =>
                    updateConfig("globalWindowMinutes", parseInt(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Período para contagem de requisições globais
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Política de Senha */}
        <Card>
          <CardHeader>
            <CardTitle>Política de Senha</CardTitle>
            <CardDescription>
              Defina os requisitos mínimos para senhas de usuários
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="passwordMinLength">
                Tamanho Mínimo da Senha
              </Label>
              <Input
                id="passwordMinLength"
                type="number"
                min="6"
                max="32"
                value={config.passwordMinLength}
                onChange={(e) =>
                  updateConfig("passwordMinLength", parseInt(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Número mínimo de caracteres (6-32)
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="passwordRequireUppercase">
                    Exigir Letra Maiúscula
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Senha deve conter pelo menos uma letra maiúscula
                  </p>
                </div>
                <Switch
                  id="passwordRequireUppercase"
                  checked={config.passwordRequireUppercase}
                  onCheckedChange={(checked) =>
                    updateConfig("passwordRequireUppercase", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="passwordRequireLowercase">
                    Exigir Letra Minúscula
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Senha deve conter pelo menos uma letra minúscula
                  </p>
                </div>
                <Switch
                  id="passwordRequireLowercase"
                  checked={config.passwordRequireLowercase}
                  onCheckedChange={(checked) =>
                    updateConfig("passwordRequireLowercase", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="passwordRequireNumbers">
                    Exigir Números
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Senha deve conter pelo menos um número
                  </p>
                </div>
                <Switch
                  id="passwordRequireNumbers"
                  checked={config.passwordRequireNumbers}
                  onCheckedChange={(checked) =>
                    updateConfig("passwordRequireNumbers", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="passwordRequireSpecial">
                    Exigir Caractere Especial
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Senha deve conter pelo menos um caractere especial (!@#$%...)
                  </p>
                </div>
                <Switch
                  id="passwordRequireSpecial"
                  checked={config.passwordRequireSpecial}
                  onCheckedChange={(checked) =>
                    updateConfig("passwordRequireSpecial", checked)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* JWT e Sessão */}
        <Card>
          <CardHeader>
            <CardTitle>Tokens e Sessão</CardTitle>
            <CardDescription>
              Configure o tempo de expiração de tokens e sessões
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="accessTokenExpiresIn">
                  Expiração do Access Token
                </Label>
                <Input
                  id="accessTokenExpiresIn"
                  type="text"
                  placeholder="15m, 1h, 1d"
                  value={config.accessTokenExpiresIn}
                  onChange={(e) =>
                    updateConfig("accessTokenExpiresIn", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: 15m (minutos), 1h (horas), 1d (dias)
                </p>
              </div>

              <div>
                <Label htmlFor="refreshTokenExpiresIn">
                  Expiração do Refresh Token
                </Label>
                <Input
                  id="refreshTokenExpiresIn"
                  type="text"
                  placeholder="7d, 30d"
                  value={config.refreshTokenExpiresIn}
                  onChange={(e) =>
                    updateConfig("refreshTokenExpiresIn", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: 7d (dias), 30d (dias)
                </p>
              </div>

              <div>
                <Label htmlFor="sessionTimeout">
                  Timeout de Sessão (minutos)
                </Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  min="5"
                  max="120"
                  value={config.sessionTimeout}
                  onChange={(e) =>
                    updateConfig("sessionTimeout", parseInt(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tempo de inatividade antes de deslogar (5-120 minutos)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Autenticação 2FA */}
        <Card>
          <CardHeader>
            <CardTitle>Autenticação de Dois Fatores (2FA)</CardTitle>
            <CardDescription>
              Configure a autenticação de dois fatores para maior segurança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="twoFactorEnabled">
                  Habilitar 2FA
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permite que usuários ativem autenticação de dois fatores
                </p>
              </div>
              <Switch
                id="twoFactorEnabled"
                checked={config.twoFactorEnabled}
                onCheckedChange={(checked) =>
                  updateConfig("twoFactorEnabled", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="twoFactorRequired">
                  Tornar 2FA Obrigatório
                </Label>
                <p className="text-xs text-muted-foreground">
                  Todos os usuários devem usar autenticação de dois fatores
                </p>
              </div>
              <Switch
                id="twoFactorRequired"
                checked={config.twoFactorRequired}
                onCheckedChange={(checked) =>
                  updateConfig("twoFactorRequired", checked)
                }
                disabled={!config.twoFactorEnabled}
              />
            </div>
          </CardContent>
        </Card>

      {/* Botão de Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Todas as Alterações"}
        </Button>
      </div>
    </div>
  );
}
