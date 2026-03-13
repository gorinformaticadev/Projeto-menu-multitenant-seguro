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
  backupRateLimitPerHour: number;
  restoreRateLimitPerHour: number;
  updateRateLimitPerHour: number;
  rateLimitDevEnabled: boolean;
  rateLimitProdEnabled: boolean;
  rateLimitDevRequests: number;
  rateLimitProdRequests: number;
  rateLimitDevWindow: number;
  rateLimitProdWindow: number;
  updatedAt: string;
  updatedBy: string | null;
}

const disabledUncheckedSwitchClassName =
  "disabled:opacity-100 data-[state=unchecked]:bg-destructive/80 disabled:data-[state=unchecked]:bg-destructive/80";

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
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs text-sm leading-6 text-muted-foreground">
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
        } catch {
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

    // Validar campos numéricos
    const numericFields: (keyof SecurityConfig)[] = [
      'loginMaxAttempts',
      'loginLockDurationMinutes',
      'globalMaxRequests',
      'globalWindowMinutes',
      'passwordMinLength',
      'sessionTimeoutMinutes',
      'backupRateLimitPerHour',
      'restoreRateLimitPerHour',
      'updateRateLimitPerHour'
    ];

    for (const field of numericFields) {
      const val = config[field];
      if (val === "" || val === null || val === undefined || isNaN(Number(val))) {
        toast({
          title: "Erro de validação",
          description: `Por favor, preencha corretamente o campo ${field}`,
          variant: "destructive"
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
        backupRateLimitPerHour: Number(config.backupRateLimitPerHour),
        restoreRateLimitPerHour: Number(config.restoreRateLimitPerHour),
        updateRateLimitPerHour: Number(config.updateRateLimitPerHour),
        rateLimitDevEnabled: config.rateLimitDevEnabled,
        rateLimitProdEnabled: config.rateLimitProdEnabled,
        rateLimitDevRequests: Number(config.rateLimitDevRequests),
        rateLimitProdRequests: Number(config.rateLimitProdRequests),
        rateLimitDevWindow: Number(config.rateLimitDevWindow),
        rateLimitProdWindow: Number(config.rateLimitProdWindow),
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
            <InfoButton label="Informações sobre Configurações de Segurança">
              <p>Gerencie as políticas de segurança do sistema em um painel centralizado.</p>
            </InfoButton>
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      {/* Aviso */}
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/70 dark:bg-yellow-950/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-100">
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
          <CardTitle className="flex items-center gap-2">
            Controle de Tentativas de Login
            <InfoButton label="Informações sobre Controle de Tentativas de Login">
              <p>Configure o bloqueio automático de contas após múltiplas tentativas de login falhas.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="loginMaxAttempts">Máximo de Tentativas de Login</Label>
                <InfoButton label="Informações sobre Máximo de Tentativas de Login">
                  <p>Número de tentativas antes de bloquear a conta. Faixa recomendada: 1 a 100.</p>
                </InfoButton>
              </div>
              <Input
                id="loginMaxAttempts"
                type="number"
                min="1"
                max="100"
                value={config.loginMaxAttempts}
                onChange={(e) =>
                  updateConfig("loginMaxAttempts", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="loginLockDurationMinutes">Duração do Bloqueio (minutos)</Label>
                <InfoButton label="Informações sobre Duração do Bloqueio">
                  <p>Tempo que a conta ficará bloqueada após atingir o limite de tentativas. Faixa: 5 a 1440 minutos.</p>
                </InfoButton>
              </div>
              <Input
                id="loginLockDurationMinutes"
                type="number"
                min="5"
                max="1440"
                value={config.loginLockDurationMinutes}
                onChange={(e) =>
                  updateConfig("loginLockDurationMinutes", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting Global */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Rate Limiting Global
              <InfoButton label="Informações sobre Rate Limiting Global">
                <p>Controle o número de requisições permitidas para prevenir ataques DDoS e uso abusivo.</p>
                <p>O limite atual é aplicado conforme o ambiente de execução.</p>
              </InfoButton>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-normal text-muted-foreground">
                {process.env.NODE_ENV === 'production' ? 'Status (Produção)' : 'Status (Desenvolvimento)'}
              </span>
              <Switch
                checked={process.env.NODE_ENV === 'production' ? config.rateLimitProdEnabled : config.rateLimitDevEnabled}
                onCheckedChange={(checked: boolean) =>
                  updateConfig(process.env.NODE_ENV === 'production' ? "rateLimitProdEnabled" : "rateLimitDevEnabled", checked)
                }
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="globalMaxRequests">
                  Requisições Globais (por período)
                </Label>
                <InfoButton label="Informações sobre Requisições Globais">
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
                value={config.globalMaxRequests}
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
                <InfoButton label="Informações sobre Janela Global">
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
                value={config.globalWindowMinutes}
                onChange={(e) =>
                  updateConfig("globalWindowMinutes", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting de Endpoints Críticos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Rate Limiting de Endpoints Críticos
            <InfoButton label="Informações sobre Rate Limiting de Endpoints Críticos">
              <p>Configure limites específicos para operações sensíveis do sistema.</p>
              <p>Essas configurações controlam backup, restore e atualizações. Valores muito altos podem permitir abuso; valores muito baixos podem bloquear operações legítimas.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="backupRateLimitPerHour">
                  Backup (por hora)
                </Label>
                <InfoButton label="Informações sobre Backup por hora">
                      <p className="font-semibold mb-1">? Como funciona o Rate Limiting de Backup:</p>
                      <p className="text-xs mb-2">
                        Limita o número de backups completos do banco de dados que podem ser criados por hora.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Propósito:</strong> Evitar sobrecarga do servidor e uso excessivo de disco.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Recomendado:</strong> 5-10 para produção, 15-20 para desenvolvimento.
                      </p>
                      <p className="text-xs">
                        <strong>• Impacto:</strong> Após atingir o limite, novos backups serão bloqueados por 1 hora.
                      </p>
                </InfoButton>
              </div>
              <Input
                id="backupRateLimitPerHour"
                type="number"
                min="1"
                max="20"
                value={config.backupRateLimitPerHour}
                onChange={(e) =>
                  updateConfig("backupRateLimitPerHour", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="restoreRateLimitPerHour">
                  Restore (por hora)
                </Label>
                <InfoButton label="Informações sobre Restore por hora">
                      <p className="font-semibold mb-1">? Como funciona o Rate Limiting de Restore:</p>
                      <p className="text-xs mb-2">
                        Limita o número de restaurações completas do banco de dados que podem ser executadas por hora.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Propósito:</strong> Operação crítica que substitui TODOS os dados do sistema.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Recomendado:</strong> 2-3 para produção, 5-10 para desenvolvimento.
                      </p>
                      <p className="text-xs">
                        <strong>• Impacto:</strong> Após atingir o limite, novos restores serão bloqueados por 1 hora.
                      </p>
                </InfoButton>
              </div>
              <Input
                id="restoreRateLimitPerHour"
                type="number"
                min="1"
                max="10"
                value={config.restoreRateLimitPerHour}
                onChange={(e) =>
                  updateConfig("restoreRateLimitPerHour", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="updateRateLimitPerHour">
                  Atualizações (por hora)
                </Label>
                <InfoButton label="Informações sobre Atualizações por hora">
                      <p className="font-semibold mb-1">? Como funciona o Rate Limiting de Atualizações:</p>
                      <p className="text-xs mb-2">
                        Limita o número de atualizações automáticas do sistema (via Git) que podem ser executadas por hora.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Propósito:</strong> Operação sensível que atualiza código, dependencias e banco de dados.
                      </p>
                      <p className="text-xs mb-1">
                        <strong>• Recomendado:</strong> 1-2 para produção, 3-5 para desenvolvimento.
                      </p>
                      <p className="text-xs">
                        <strong>• Impacto:</strong> Após atingir o limite, novas atualizações serão bloqueadas por 1 hora.
                      </p>
                </InfoButton>
              </div>
              <Input
                id="updateRateLimitPerHour"
                type="number"
                min="1"
                max="5"
                value={config.updateRateLimitPerHour}
                onChange={(e) =>
                  updateConfig("updateRateLimitPerHour", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Política de Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Política de Senha
            <InfoButton label="Informações sobre Política de Senha">
              <p>Defina os requisitos mínimos para senhas de usuários.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Label htmlFor="passwordMinLength">Tamanho Mínimo da Senha</Label>
              <InfoButton label="Informações sobre Tamanho Mínimo da Senha">
                <p>Número mínimo de caracteres aceito para senha. Faixa suportada: 6 a 32.</p>
              </InfoButton>
            </div>
            <Input
              id="passwordMinLength"
              type="number"
              min="6"
              max="32"
              value={config.passwordMinLength}
              onChange={(e) =>
                updateConfig("passwordMinLength", e.target.value === "" ? "" : parseInt(e.target.value))
              }
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="passwordRequireUppercase">Exigir Letra Maiúscula</Label>
                <InfoButton label="Informações sobre Exigir Letra Maiúscula">
                  <p>Quando habilitado, a senha deve conter pelo menos uma letra maiúscula.</p>
                </InfoButton>
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
              <div className="flex items-center gap-2">
                <Label htmlFor="passwordRequireLowercase">Exigir Letra Minúscula</Label>
                <InfoButton label="Informações sobre Exigir Letra Minúscula">
                  <p>Quando habilitado, a senha deve conter pelo menos uma letra minúscula.</p>
                </InfoButton>
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
              <div className="flex items-center gap-2">
                <Label htmlFor="passwordRequireNumbers">Exigir Números</Label>
                <InfoButton label="Informações sobre Exigir Números">
                  <p>Quando habilitado, a senha deve conter pelo menos um número.</p>
                </InfoButton>
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
              <div className="flex items-center gap-2">
                <Label htmlFor="passwordRequireSpecial">Exigir Caractere Especial</Label>
                <InfoButton label="Informações sobre Exigir Caractere Especial">
                  <p>Quando habilitado, a senha deve conter pelo menos um caractere especial, como !@#$%.</p>
                </InfoButton>
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
          <CardTitle className="flex items-center gap-2">
            Autenticação de Dois Fatores (2FA)
            <InfoButton label="Informações sobre Autenticação de Dois Fatores">
              <p>Configure se o 2FA está disponível para usuários e se deve ser obrigatório.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="twoFactorEnabled">Habilitar 2FA Globalmente</Label>
                <InfoButton label="Informações sobre Habilitar 2FA Globalmente">
                  <p>Permite que usuários configurem autenticação de dois fatores em suas contas.</p>
                </InfoButton>
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
              <div className="flex items-center gap-2">
                <Label htmlFor="twoFactorRequired">Tornar 2FA Obrigatório</Label>
                <InfoButton label="Informações sobre Tornar 2FA Obrigatório">
                  <p>Quando habilitado, todos os usuários devem configurar 2FA para acessar o sistema.</p>
                </InfoButton>
              </div>
              <Switch
                id="twoFactorRequired"
                checked={config.twoFactorRequired}
                disabled={!config.twoFactorEnabled}
                className={disabledUncheckedSwitchClassName}
                onCheckedChange={(checked: boolean) =>
                  updateConfig("twoFactorRequired", checked)
                }
              />
            </div>

            {!config.twoFactorEnabled && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/70 dark:bg-yellow-950/30">
                <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-800 dark:text-yellow-100">
                  <p className="font-medium mb-1">2FA Desabilitado</p>
                  <p>
                    Quando o 2FA estiver desabilitado, os usuários não poderão configurar
                    autenticação de dois fatores em suas contas.
                  </p>
                </div>
              </div>
            )}

            {config.twoFactorEnabled && config.twoFactorRequired && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/70 dark:bg-blue-950/30">
                <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 dark:text-blue-100">
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
          <CardTitle className="flex items-center gap-2">
            Tokens e Sessão
            <InfoButton label="Informações sobre Tokens e Sessão">
              <p>Configure o tempo de expiração de tokens e o logout automático por inatividade.</p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="accessTokenExpiresIn">Expiração do Access Token</Label>
                <InfoButton label="Informações sobre Expiração do Access Token">
                  <p>Formato aceito: 15m, 1h, 1d.</p>
                </InfoButton>
              </div>
              <Input
                id="accessTokenExpiresIn"
                type="text"
                placeholder="15m, 1h, 1d"
                value={config.accessTokenExpiresIn}
                onChange={(e) =>
                  updateConfig("accessTokenExpiresIn", e.target.value)
                }
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="refreshTokenExpiresIn">Expiração do Refresh Token</Label>
                <InfoButton label="Informações sobre Expiração do Refresh Token">
                  <p>Formato aceito: 7d, 30d.</p>
                </InfoButton>
              </div>
              <Input
                id="refreshTokenExpiresIn"
                type="text"
                placeholder="7d, 30d"
                value={config.refreshTokenExpiresIn}
                onChange={(e) =>
                  updateConfig("refreshTokenExpiresIn", e.target.value)
                }
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor="sessionTimeoutMinutes">Logout por Inatividade (minutos)</Label>
                <InfoButton label="Informações sobre Logout por Inatividade">
                  <p>Tempo de inatividade antes de deslogar automaticamente. Faixa: 5 a 1440 minutos.</p>
                </InfoButton>
              </div>
              <Input
                id="sessionTimeoutMinutes"
                type="number"
                min="5"
                max="1440"
                value={config.sessionTimeoutMinutes}
                onChange={(e) =>
                  updateConfig("sessionTimeoutMinutes", e.target.value === "" ? "" : parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Email */}
      <EmailConfigSection />

      {/* Configurações Dinâmicas */}
      <DynamicSecuritySettingsSection />

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

