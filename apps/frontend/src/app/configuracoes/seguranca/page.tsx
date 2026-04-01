"use client";

import { type ReactNode, useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSecurityConfig } from "@/contexts/SecurityConfigContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, AlertTriangle, HelpCircle } from "lucide-react";
import EmailConfigSection from "@/components/EmailConfigSection";
import { DynamicSecuritySettingsSection } from "@/app/configuracoes/seguranca/DynamicSecuritySettingsSection";
import { cn } from "@/lib/utils";


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
  rateLimitDevEnabled: boolean;
  rateLimitProdEnabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

const uncheckedSwitchClassName =
  "data-[state=unchecked]:bg-skin-danger/80 disabled:opacity-100 disabled:data-[state=unchecked]:bg-skin-danger/80";

const dashboardCardBaseClassName =
  "rounded-[28px] border shadow-sm backdrop-blur-sm";

const dashboardCardToneClassName = {
  neutral:
    "border-skin-border/80 bg-skin-surface/85",
  info:
    "border-skin-info/30 bg-skin-surface/95",
  warn:
    "border-skin-warning/30 bg-skin-surface/95",
  success:
    "border-skin-success/30 bg-skin-surface/95",
  accent:
    "border-skin-secondary/40 bg-skin-surface/95",
  danger:
    "border-skin-danger/30 bg-skin-surface/95",
} as const;

function InfoButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-skin-text-muted transition-colors hover:bg-skin-surface-hover hover:text-skin-text"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs text-sm leading-6 text-skin-text-muted">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export default function SecurityConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshConfig } = useSecurityConfig();
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [legacyError, setLegacyError] = useState<string | null>(null);
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
        setLegacyError(null);
        const response = await api.get("/security-config");
        setConfig(response.data);
      } catch (error: unknown) {
        setConfig(null);
        setLegacyError(
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Erro desconhecido",
        );
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

    // Validar campos numéricos e faixas aceitas pelo backend
    const numericConstraints: Array<{
      field: keyof SecurityConfig;
      label: string;
      min: number;
      max: number;
    }> = [
      { field: "loginMaxAttempts", label: "Máximo de Tentativas de Login", min: 1, max: 100 },
      { field: "loginLockDurationMinutes", label: "Duração do Bloqueio", min: 5, max: 1440 },
      { field: "loginWindowMinutes", label: "Janela de Tentativas", min: 1, max: 60 },
      { field: "globalMaxRequests", label: "Requisições Globais por período", min: 10, max: 100000 },
      { field: "globalWindowMinutes", label: "Janela Global", min: 1, max: 60 },
      { field: "passwordMinLength", label: "Tamanho Mínimo da Senha", min: 6, max: 32 },
      { field: "sessionTimeoutMinutes", label: "Logout por Inatividade", min: 5, max: 1440 },
    ];

    for (const { field, label, min, max } of numericConstraints) {
      const rawValue = config[field];
      const numericValue = Number(rawValue);
      if (rawValue === "" || rawValue === null || rawValue === undefined || Number.isNaN(numericValue)) {
        toast({
          title: "Erro de validação",
          description: `Por favor, preencha corretamente o campo ${label}.`,
          variant: "destructive"
        });
        return;
      }

      if (numericValue < min || numericValue > max) {
        toast({
          title: "Erro de validação",
          description: `${label} deve estar entre ${min} e ${max}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setSaving(true);

      // Enviar apenas os campos permitidos (sem id, updatedAt, updatedBy)
      const updateData = {
        loginMaxAttempts: Number(config.loginMaxAttempts),
        loginLockDurationMinutes: Number(config.loginLockDurationMinutes),
        loginWindowMinutes: Number(config.loginWindowMinutes),
        globalMaxRequests: Number(config.globalMaxRequests),
        globalWindowMinutes: Number(config.globalWindowMinutes),
        passwordMinLength: Number(config.passwordMinLength),
        passwordRequireUppercase: config.passwordRequireUppercase,
        passwordRequireLowercase: config.passwordRequireLowercase,
        passwordRequireNumbers: config.passwordRequireNumbers,
        passwordRequireSpecial: config.passwordRequireSpecial,
        accessTokenExpiresIn: config.accessTokenExpiresIn,
        refreshTokenExpiresIn: config.refreshTokenExpiresIn,
        twoFactorEnabled: config.twoFactorEnabled,
        twoFactorRequired: config.twoFactorRequired,
        sessionTimeoutMinutes: Number(config.sessionTimeoutMinutes),
        rateLimitDevEnabled: config.rateLimitDevEnabled,
        rateLimitProdEnabled: config.rateLimitProdEnabled,
      };

      const response = await api.put("/security-config", updateData);
      setConfig(response.data);

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

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      {/* Header */}
      <div
        className={cn(
          dashboardCardBaseClassName,
          dashboardCardToneClassName.neutral,
          "flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-start lg:justify-between",
        )}
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Configurações de Segurança
            <InfoButton label="Ajuda da seção principal de configurações de segurança">
              <p>Gerencie as políticas de segurança do sistema em um painel centralizado.</p>
            </InfoButton>
          </h1>
        </div>
        {config ? (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        ) : null}
      </div>

      {/* Aviso */}
      <Card className={cn(dashboardCardBaseClassName, dashboardCardToneClassName.warn)}>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-skin-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-skin-warning ">
              <p className="font-medium mb-1">Atenção!</p>
              <p>
                Alterações nas configurações de segurança afetam todo o sistema.
                Certifique-se de entender o impacto antes de salvar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      {loading ? (
        <Card
          data-testid="legacy-security-section-loading"
          className={cn(dashboardCardBaseClassName, dashboardCardToneClassName.neutral)}
        >
          <CardContent className="flex min-h-[120px] items-center justify-center pt-6 text-sm text-skin-text-muted">
            Carregando configurações principais de segurança...
          </CardContent>
        </Card>
      ) : !config ? (
        <Card
          data-testid="legacy-security-section-error"
          className={cn(dashboardCardBaseClassName, dashboardCardToneClassName.danger)}
        >
          <CardHeader>
            <CardTitle className="text-skin-danger">Falha ao carregar configurações principais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-skin-text-muted">
            <p>As configurações antigas baseadas em /security-config não puderam ser carregadas.</p>
            <p>{legacyError ?? "Tente novamente em instantes."}</p>
          </CardContent>
        </Card>
      ) : (
        <>
      {false && (
      <Card className={cn(dashboardCardBaseClassName, dashboardCardToneClassName.info)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Controle de Tentativas de Login
            <InfoButton label="Ajuda da seção de controle de tentativas de login">
              <p>Configure o bloqueio automático de contas após múltiplas tentativas de login falhas.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-skin-border/70 bg-skin-surface/70 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-skin-text">Controle de Tentativas de Login</h3>
                <p className="text-xs text-skin-text-muted">
                  Defina quantas tentativas falhas sao aceitas e por quanto tempo a conta fica bloqueada.
                </p>
              </div>
              <InfoButton label="Ajuda da seÃ§Ã£o de controle de tentativas de login">
                <p>Configure o bloqueio automÃ¡tico de contas apÃ³s mÃºltiplas tentativas de login falhas.</p>
              </InfoButton>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Label htmlFor="loginMaxAttempts">MÃ¡ximo de Tentativas de Login</Label>
                  <InfoButton label="Ajuda do campo mÃ¡ximo de tentativas de login">
                    <p>NÃºmero de tentativas antes de bloquear a conta. Faixa recomendada: 1 a 100.</p>
                  </InfoButton>
                </div>
                <Input
                  id="loginMaxAttempts"
                  type="number"
                  min="1"
                  max="100"
                  value={config?.loginMaxAttempts ?? ""}
                  onChange={(e) =>
                    updateConfig("loginMaxAttempts", e.target.value === "" ? "" : parseInt(e.target.value))
                  }
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Label htmlFor="loginLockDurationMinutes">DuraÃ§Ã£o do Bloqueio (minutos)</Label>
                  <InfoButton label="Ajuda do campo duraÃ§Ã£o do bloqueio">
                    <p>Tempo que a conta ficarÃ¡ bloqueada apÃ³s atingir o limite de tentativas. Faixa: 5 a 1440 minutos.</p>
                  </InfoButton>
                </div>
                <Input
                  id="loginLockDurationMinutes"
                  type="number"
                  min="5"
                  max="1440"
                  value={config?.loginLockDurationMinutes ?? ""}
                  onChange={(e) =>
                    updateConfig("loginLockDurationMinutes", e.target.value === "" ? "" : parseInt(e.target.value))
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-skin-border/60 pt-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="loginMaxAttempts">Máximo de Tentativas de Login</Label>
                <InfoButton label="Ajuda do campo máximo de tentativas de login">
                  <p>Número de tentativas antes de bloquear a conta. Faixa recomendada: 1 a 100.</p>
                </InfoButton>
              </div>
              <Input
                id="loginMaxAttempts"
                type="number"
                min="1"
                max="100"
                value={config?.loginMaxAttempts ?? ""}
                onChange={(e) =>
                  updateConfig("loginMaxAttempts", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="loginLockDurationMinutes">Duração do Bloqueio (minutos)</Label>
                <InfoButton label="Ajuda do campo duração do bloqueio">
                  <p>Tempo que a conta ficará bloqueada após atingir o limite de tentativas. Faixa: 5 a 1440 minutos.</p>
                </InfoButton>
              </div>
              <Input
                id="loginLockDurationMinutes"
                type="number"
                min="5"
                max="1440"
                value={config?.loginLockDurationMinutes ?? ""}
                onChange={(e) =>
                  updateConfig("loginLockDurationMinutes", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Rate Limiting Global */}
      <Card
        data-testid="global-rate-limiting-card"
        className={cn(dashboardCardBaseClassName, dashboardCardToneClassName.info)}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Rate Limiting Global
              <InfoButton label="Ajuda da seção de rate limiting global">
                <p>Controle o número de requisições permitidas para prevenir ataques DDoS e uso abusivo.</p>
                <p>O limite atual é aplicado conforme o ambiente de execução.</p>
              </InfoButton>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-normal text-skin-text-muted">
                {process.env.NODE_ENV === 'production' ? 'Status (Produção)' : 'Status (Desenvolvimento)'}
              </span>
              <Switch
                className={uncheckedSwitchClassName}
                checked={process.env.NODE_ENV === 'production' ? config.rateLimitProdEnabled : config.rateLimitDevEnabled}
                onCheckedChange={(checked: boolean) =>
                  updateConfig(process.env.NODE_ENV === 'production' ? "rateLimitProdEnabled" : "rateLimitDevEnabled", checked)
                }
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-skin-border/70 bg-skin-surface/70 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-skin-text">Controle de Tentativas de Login</h3>
                <p className="text-xs text-skin-text-muted">
                  Defina quantas tentativas falhas sao aceitas e por quanto tempo a conta fica bloqueada.
                </p>
              </div>
              <InfoButton label="Ajuda da seÃ§Ã£o de controle de tentativas de login">
                <p>Configure o bloqueio automÃ¡tico de contas apÃ³s mÃºltiplas tentativas de login falhas.</p>
              </InfoButton>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Label htmlFor="loginMaxAttempts">MÃ¡ximo de Tentativas de Login</Label>
                  <InfoButton label="Ajuda do campo mÃ¡ximo de tentativas de login">
                    <p>NÃºmero de tentativas antes de bloquear a conta. Faixa recomendada: 1 a 100.</p>
                  </InfoButton>
                </div>
                <Input
                  id="loginMaxAttempts"
                  type="number"
                  min="1"
                  max="100"
                  value={config?.loginMaxAttempts ?? ""}
                  onChange={(e) =>
                    updateConfig("loginMaxAttempts", e.target.value === "" ? "" : parseInt(e.target.value))
                  }
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Label htmlFor="loginLockDurationMinutes">DuraÃ§Ã£o do Bloqueio (minutos)</Label>
                  <InfoButton label="Ajuda do campo duraÃ§Ã£o do bloqueio">
                    <p>Tempo que a conta ficarÃ¡ bloqueada apÃ³s atingir o limite de tentativas. Faixa: 5 a 1440 minutos.</p>
                  </InfoButton>
                </div>
                <Input
                  id="loginLockDurationMinutes"
                  type="number"
                  min="5"
                  max="1440"
                  value={config?.loginLockDurationMinutes ?? ""}
                  onChange={(e) =>
                    updateConfig("loginLockDurationMinutes", e.target.value === "" ? "" : parseInt(e.target.value))
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-skin-border/60 pt-4 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="globalMaxRequests">
                  Requisições Globais (por período)
                </Label>
                <InfoButton label="Ajuda do campo requisições globais por período">
                      <p className="font-semibold mb-1">? Como funciona o Rate Limiting Global:</p>
                      <p className="text-xs mb-2">
                        Limita o número total de requisições HTTP que qualquer usuário/IP pode fazer ao sistema durante a janela de tempo configurada.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Propósito:</strong> Proteção contra ataques DDoS e uso abusivo da API.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Recomendado:</strong> 60-100 para produção, 500-1000 para desenvolvimento.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Exemplo:</strong> Com 100 requisições em 1 minuto, um usuário pode fazer até 100 chamadas de API por minuto.
                      </p>
                      <p className="text-xs">
                        <strong>• Impacto:</strong> Após atingir o limite, requisições serão bloqueadas até o fim da janela.
                      </p>
                </InfoButton>
              </div>
              <Input
                id="globalMaxRequests"
                type="number"
                min="10"
                max="1000"
                value={config?.globalMaxRequests ?? ""}
                onChange={(e) =>
                  updateConfig("globalMaxRequests", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="globalWindowMinutes">
                  Janela Global (minutos)
                </Label>
                <InfoButton label="Ajuda do campo janela global em minutos">
                      <p className="font-semibold mb-1">? Como funciona a Janela de Tempo:</p>
                      <p className="text-xs mb-2">
                        Define o período de tempo (em minutos) usado para contar as requisições globais.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Propósito:</strong> Controlar a taxa de requisições ao longo do tempo.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Recomendado:</strong> 1 minuto para controle rápido, 5-15 minutos para controle mais flexível.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Exemplo:</strong> Com janela de 1 minuto, o contador é resetado a cada minuto.
                      </p>
                      <p className="text-xs">
                        <strong>• Impacto:</strong> Janelas menores = controle mais rígido, janelas maiores = mais flexível.
                      </p>
                </InfoButton>
              </div>
              <Input
                id="globalWindowMinutes"
                type="number"
                min="1"
                max="60"
                value={config?.globalWindowMinutes ?? ""}
                onChange={(e) =>
                  updateConfig("globalWindowMinutes", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Política de Senha */}
      <Card className={cn(dashboardCardBaseClassName, dashboardCardToneClassName.success)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Política de Senha
            <InfoButton label="Ajuda da seção de política de senha">
              <p>Defina os requisitos mínimos para senhas de usuários.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Label htmlFor="passwordMinLength">Tamanho Mínimo da Senha</Label>
              <InfoButton label="Ajuda do campo tamanho mínimo da senha">
                <p>Número mínimo de caracteres aceito para senha. Faixa suportada: 6 a 32.</p>
              </InfoButton>
            </div>
            <Input
              id="passwordMinLength"
              type="number"
              min="6"
              max="32"
              value={config?.passwordMinLength ?? ""}
              onChange={(e) =>
                updateConfig("passwordMinLength", e.target.value === "" ? "" : parseInt(e.target.value))
              }
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="passwordRequireUppercase">Exigir Letra Maiúscula</Label>
                <InfoButton label="Ajuda do campo exigir letra maiúscula">
                  <p>Quando habilitado, a senha deve conter pelo menos uma letra maiúscula.</p>
                </InfoButton>
              </div>
              <Switch
                id="passwordRequireUppercase"
                className={uncheckedSwitchClassName}
                checked={config.passwordRequireUppercase}
                onCheckedChange={(checked: boolean) =>
                  updateConfig("passwordRequireUppercase", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="passwordRequireLowercase">Exigir Letra Minúscula</Label>
                <InfoButton label="Ajuda do campo exigir letra minúscula">
                  <p>Quando habilitado, a senha deve conter pelo menos uma letra minúscula.</p>
                </InfoButton>
              </div>
              <Switch
                id="passwordRequireLowercase"
                className={uncheckedSwitchClassName}
                checked={config.passwordRequireLowercase}
                onCheckedChange={(checked: boolean) =>
                  updateConfig("passwordRequireLowercase", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="passwordRequireNumbers">Exigir Números</Label>
                <InfoButton label="Ajuda do campo exigir números">
                  <p>Quando habilitado, a senha deve conter pelo menos um número.</p>
                </InfoButton>
              </div>
              <Switch
                id="passwordRequireNumbers"
                className={uncheckedSwitchClassName}
                checked={config.passwordRequireNumbers}
                onCheckedChange={(checked: boolean) =>
                  updateConfig("passwordRequireNumbers", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="passwordRequireSpecial">Exigir Caractere Especial</Label>
                <InfoButton label="Ajuda do campo exigir caractere especial">
                  <p>Quando habilitado, a senha deve conter pelo menos um caractere especial, como !@#$%.</p>
                </InfoButton>
              </div>
              <Switch
                id="passwordRequireSpecial"
                className={uncheckedSwitchClassName}
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
      <Card className={cn(dashboardCardBaseClassName, dashboardCardToneClassName.info)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Autenticação de Dois Fatores (2FA)
            <InfoButton label="Ajuda da seção de autenticação de dois fatores">
              <p>Configure se o 2FA está disponível para usuários e se deve ser obrigatório.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="twoFactorEnabled">Habilitar 2FA Globalmente</Label>
                <InfoButton label="Ajuda do campo habilitar 2FA globalmente">
                  <p>Permite que usuários configurem autenticação de dois fatores em suas contas.</p>
                </InfoButton>
              </div>
              <Switch
                id="twoFactorEnabled"
                className={uncheckedSwitchClassName}
                checked={config.twoFactorEnabled}
                onCheckedChange={(checked: boolean) =>
                  updateConfig("twoFactorEnabled", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="twoFactorRequired">Tornar 2FA Obrigatório</Label>
                <InfoButton label="Ajuda do campo tornar 2FA obrigatório">
                  <p>Quando habilitado, todos os usuários devem configurar 2FA para acessar o sistema.</p>
                </InfoButton>
              </div>
              <Switch
                id="twoFactorRequired"
                checked={config.twoFactorRequired}
                disabled={!config.twoFactorEnabled}
                className={uncheckedSwitchClassName}
                onCheckedChange={(checked: boolean) =>
                  updateConfig("twoFactorRequired", checked)
                }
              />
            </div>

            {!config.twoFactorEnabled && (
              <div className="flex items-start gap-2 rounded-lg border border-skin-warning/30 bg-skin-warning/10 p-3  ">
                <AlertTriangle className="h-4 w-4 text-skin-warning flex-shrink-0 mt-0.5" />
                <div className="text-xs text-skin-warning ">
                  <p className="font-medium mb-1">2FA Desabilitado</p>
                  <p>
                    Quando o 2FA estiver desabilitado, os usuários não poderão configurar
                    autenticação de dois fatores em suas contas.
                  </p>
                </div>
              </div>
            )}

            {config.twoFactorEnabled && config.twoFactorRequired && (
              <div className="flex items-start gap-2 rounded-lg border border-skin-info/30 bg-skin-info/10 p-3  ">
                <Shield className="h-4 w-4 text-skin-info flex-shrink-0 mt-0.5" />
                <div className="text-xs text-skin-info dark:text-skin-info">
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
      <Card className={cn(dashboardCardBaseClassName, dashboardCardToneClassName.accent)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Tokens e Sessão
            <InfoButton label="Ajuda da seção de tokens e sessão">
              <p>Configure o tempo de expiração de tokens e o logout automático por inatividade.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="accessTokenExpiresIn">Expiração do Access Token</Label>
                <InfoButton label="Ajuda do campo expiração do access token">
                  <p>Formato aceito: 15m, 1h, 1d.</p>
                </InfoButton>
              </div>
              <Input
                id="accessTokenExpiresIn"
                type="text"
                placeholder="15m, 1h, 1d"
                value={config?.accessTokenExpiresIn ?? ""}
                onChange={(e) =>
                  updateConfig("accessTokenExpiresIn", e.target.value)
                }
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="refreshTokenExpiresIn">Expiração do Refresh Token</Label>
                <InfoButton label="Ajuda do campo expiração do refresh token">
                  <p>Formato aceito: 7d, 30d.</p>
                </InfoButton>
              </div>
              <Input
                id="refreshTokenExpiresIn"
                type="text"
                placeholder="7d, 30d"
                value={config?.refreshTokenExpiresIn ?? ""}
                onChange={(e) =>
                  updateConfig("refreshTokenExpiresIn", e.target.value)
                }
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="sessionTimeoutMinutes">Logout por Inatividade (minutos)</Label>
                <InfoButton label="Ajuda do campo logout por inatividade">
                  <p>Tempo de inatividade antes de deslogar automaticamente. Faixa: 5 a 1440 minutos.</p>
                </InfoButton>
              </div>
              <Input
                id="sessionTimeoutMinutes"
                type="number"
                min="5"
                max="1440"
                value={config?.sessionTimeoutMinutes ?? ""}
                onChange={(e) =>
                  updateConfig("sessionTimeoutMinutes", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {/* Configurações Dinâmicas */}
      <DynamicSecuritySettingsSection />

      {/* Configurações de Email */}
      <EmailConfigSection />

      {/* Botão de Salvar */}
      {config ? (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Todas as Alterações"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
