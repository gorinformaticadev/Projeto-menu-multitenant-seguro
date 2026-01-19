"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSecurityConfig } from "@/contexts/SecurityConfigContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, AlertTriangle } from "lucide-react";
import EmailConfigSection from "@/components/EmailConfigSection";


interface SecurityConfig {
  id: string;
  loginMaxAttempts: number;
  loginLockDurationMinutes: number;
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
  sessionTimeoutMinutes: number;
  updatedAt: string;
  updatedBy: string | null;
}

export default function SecurityConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshConfig } = useSecurityConfig();
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
      const cacheKey = 'security-config-full-cache';
      const cacheTTL = 5 * 60 * 1000; // 5 minutos

      // Verificar cache
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTTL) {
            setConfig(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Cache inválido, continua
        }
      }

      try {
        setLoading(true);
        const response = await api.get("/security-config");
        setConfig(response.data);

        // Cache o resultado
        localStorage.setItem(cacheKey, JSON.stringify({
          data: response.data,
          timestamp: Date.now()
        }));
      } catch (error: unknown) {
        toast({
          title: "Erro ao carregar configurações",
          description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
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

      // Enviar apenas os campos permitidos (sem id, updatedAt, updatedBy)
      const updateData = {
        loginMaxAttempts: config.loginMaxAttempts,
        loginLockDurationMinutes: config.loginLockDurationMinutes,
        loginWindowMinutes: config.loginWindowMinutes,
        globalMaxRequests: config.globalMaxRequests,
        globalWindowMinutes: config.globalWindowMinutes,
        passwordMinLength: config.passwordMinLength,
        passwordRequireUppercase: config.passwordRequireUppercase,
        passwordRequireLowercase: config.passwordRequireLowercase,
        passwordRequireNumbers: config.passwordRequireNumbers,
        passwordRequireSpecial: config.passwordRequireSpecial,
        accessTokenExpiresIn: config.accessTokenExpiresIn,
        refreshTokenExpiresIn: config.refreshTokenExpiresIn,
        twoFactorEnabled: config.twoFactorEnabled,
        twoFactorRequired: config.twoFactorRequired,
        sessionTimeoutMinutes: config.sessionTimeoutMinutes,
      };

      const response = await api.put("/security-config", updateData);

      // Atualizar cache local
      localStorage.setItem('security-config-full-cache', JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));

      // Atualizar configuração global no contexto
      await refreshConfig();

      toast({
        title: "Configurações salvas",
        description: "As configurações de segurança foram atualizadas com sucesso",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao salvar",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof SecurityConfig, value: unknown) => {
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
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



      {/* Controle de Login */}
      <Card>
        <CardHeader>
          <CardTitle>Controle de Tentativas de Login</CardTitle>
          <CardDescription>
            Configure o bloqueio automático de contas após múltiplas tentativas de login falhas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="loginMaxAttempts">
                Máximo de Tentativas de Login
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
                Número de tentativas antes de bloquear a conta (1-100)
              </p>
            </div>

            <div>
              <Label htmlFor="loginLockDurationMinutes">
                Duração do Bloqueio (minutos)
              </Label>
              <Input
                id="loginLockDurationMinutes"
                type="number"
                min="5"
                max="1440"
                value={config.loginLockDurationMinutes}
                onChange={(e) =>
                  updateConfig("loginLockDurationMinutes", parseInt(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tempo que a conta ficará bloqueada (5-1440 minutos / até 24h)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting Global */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting Global</CardTitle>
          <CardDescription>
            Controle o número de requisições permitidas para prevenir ataques DDoS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
                Número máximo de requisições globais (10-1000)
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
                Período para contagem de requisições globais (1-60 minutos)
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
                onCheckedChange={(checked: boolean) =>
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
                onCheckedChange={(checked: boolean) =>
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
                onCheckedChange={(checked: boolean) =>
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
                onCheckedChange={(checked: boolean) =>
                  updateConfig("passwordRequireSpecial", checked)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autenticação de Dois Fatores */}
      <Card>
        <CardHeader>
          <CardTitle>Autenticação de Dois Fatores (2FA)</CardTitle>
          <CardDescription>
            Configure se o 2FA está disponível para usuários e se deve ser obrigatório
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="twoFactorEnabled">
                  Habilitar 2FA Globalmente
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permite que usuários configurem autenticação de dois fatores em suas contas
                </p>
              </div>
              <Switch
                id="twoFactorEnabled"
                checked={config.twoFactorEnabled}
                onCheckedChange={(checked: boolean) =>
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
                  Todos os usuários devem configurar 2FA para acessar o sistema
                </p>
              </div>
              <Switch
                id="twoFactorRequired"
                checked={config.twoFactorRequired}
                disabled={!config.twoFactorEnabled}
                onCheckedChange={(checked: boolean) =>
                  updateConfig("twoFactorRequired", checked)
                }
              />
            </div>

            {!config.twoFactorEnabled && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-800">
                  <p className="font-medium mb-1">2FA Desabilitado</p>
                  <p>
                    Quando o 2FA estiver desabilitado, os usuários não poderão configurar
                    autenticação de dois fatores em suas contas.
                  </p>
                </div>
              </div>
            )}

            {config.twoFactorEnabled && config.twoFactorRequired && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">2FA Obrigatório</p>
                  <p>
                    Todos os usuários serão obrigados a configurar 2FA no próximo login.
                    Usuários existentes sem 2FA configurado serão redirecionados para configuração.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* JWT e Sessão */}
      <Card>
        <CardHeader>
          <CardTitle>Tokens e Sessão</CardTitle>
          <CardDescription>
            Configure o tempo de expiração de tokens e logout automático por inatividade
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
              <Label htmlFor="sessionTimeoutMinutes">
                Logout por Inatividade (minutos)
              </Label>
              <Input
                id="sessionTimeoutMinutes"
                type="number"
                min="5"
                max="1440"
                value={config.sessionTimeoutMinutes}
                onChange={(e) =>
                  updateConfig("sessionTimeoutMinutes", parseInt(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tempo de inatividade antes de deslogar automaticamente (5-1440 minutos / até 24h)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Email */}
      <EmailConfigSection />

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
