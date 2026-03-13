"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ConfigBreadcrumb } from "@/components/ConfigBreadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type {
  SecuritySettingItem,
  SecuritySettingMutationResponse,
  SecuritySettingsReadResponse,
} from "@/app/configuracoes/seguranca/security-settings.types";
import {
  formatLastUpdated,
  formatVisibleValue,
  getApiErrorMessage,
  getApiErrorStatus,
  getOriginBadgeLabel,
  getOriginBadgeVariant,
  groupSecuritySettings,
} from "@/app/configuracoes/seguranca/security-settings.utils";
import {
  AlertTriangle,
  HelpCircle,
  Loader2,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";

type PendingAction = "update" | "restore";

type ConfirmationState =
  | {
      open: false;
      item: null;
      nextValue: null;
      action: null;
    }
  | {
      open: true;
      item: SecuritySettingItem;
      nextValue: boolean | null;
      action: "update" | "restore";
    };

type ErrorState = {
  title: string;
  description: string;
};

const EMPTY_CONFIRMATION: ConfirmationState = {
  open: false,
  item: null,
  nextValue: null,
  action: null,
};

function buildOptimisticSetting(item: SecuritySettingItem, nextValue: boolean): SecuritySettingItem {
  return {
    ...item,
    resolvedValue: item.valueHidden ? null : nextValue,
    resolvedSource: "database",
    hasDatabaseOverride: true,
  };
}

function getPageErrorState(error: unknown): ErrorState {
  const status = getApiErrorStatus(error);

  if (status === 401) {
    return {
      title: "Sessão expirada",
      description: "Faça login novamente para acessar as configurações de segurança.",
    };
  }

  if (status === 403) {
    return {
      title: "Acesso negado",
      description: "Apenas SUPER_ADMIN pode visualizar ou alterar estas configurações.",
    };
  }

  return {
    title: "Falha ao carregar configurações",
    description: getApiErrorMessage(error, "Não foi possível carregar as configurações dinâmicas."),
  };
}

function SettingRow({
  item,
  pendingAction,
  onToggle,
  onRestore,
}: {
  item: SecuritySettingItem;
  pendingAction?: PendingAction;
  onToggle: (item: SecuritySettingItem, nextValue: boolean) => void;
  onRestore: (item: SecuritySettingItem) => void;
}) {
  const isBoolean = item.type === "boolean";
  const isBusy = pendingAction !== undefined;
  const showLiveToggle = isBoolean && item.editableInPanel && !item.valueHidden;
  const showReadonlyToggle = isBoolean && !item.editableInPanel && !item.valueHidden;
  const lastUpdated = formatLastUpdated(item);

  return (
    <article
      data-testid={`security-setting-row-${item.key}`}
      className="rounded-2xl border border-border/70 bg-background/70 p-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Informações sobre ${item.label}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm leading-5">{item.description}</p>
              </TooltipContent>
            </Tooltip>

            <Badge
              data-testid={`security-setting-origin-${item.key}`}
              variant={getOriginBadgeVariant(item.resolvedSource)}
            >
              {getOriginBadgeLabel(item.resolvedSource)}
            </Badge>

            {!item.editableInPanel && (
              <Badge variant="outline" className="border-border/70 text-muted-foreground">
                Somente leitura
              </Badge>
            )}

            {item.valueHidden && (
              <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300">
                Valor protegido
              </Badge>
            )}

            {item.restartRequired && (
              <Badge variant="outline" className="border-yellow-500/30 text-yellow-700 dark:text-yellow-300">
                Requer reinício
              </Badge>
            )}

            {item.requiresConfirmation && (
              <Badge variant="outline" className="border-primary/30 text-primary">
                Exige confirmação
              </Badge>
            )}
          </div>

          {item.description ? (
            <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Valor atual: {formatVisibleValue(item)}</span>
            {lastUpdated ? <span>Última alteração: {lastUpdated}</span> : null}
          </div>
        </div>

        <div className="flex min-w-[220px] flex-col items-stretch gap-3 md:items-end">
          <div className="flex items-center justify-end gap-3">
            {showLiveToggle ? (
              <Switch
                aria-label={`Alternar ${item.label}`}
                checked={Boolean(item.resolvedValue)}
                disabled={isBusy}
                onCheckedChange={(checked) => onToggle(item, checked)}
              />
            ) : showReadonlyToggle ? (
              <Switch
                aria-label={`${item.label} somente leitura`}
                checked={Boolean(item.resolvedValue)}
                disabled
              />
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                {item.valueHidden ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                {item.editableInPanel ? "Sem controle visual" : "Somente leitura"}
              </div>
            )}

            {isBusy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>

          {item.hasDatabaseOverride ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => onRestore(item)}
              className="w-full md:w-auto"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar fallback
            </Button>
          ) : (
            <div className="text-right text-xs text-muted-foreground">Sem override em banco</div>
          )}
        </div>
      </div>
    </article>
  );
}

export function SecuritySettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SecuritySettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorState | null>(null);
  const [pendingByKey, setPendingByKey] = useState<Record<string, PendingAction | undefined>>({});
  const [confirmation, setConfirmation] = useState<ConfirmationState>(EMPTY_CONFIRMATION);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (authLoading) {
        return;
      }

      if (!user) {
        setLoading(false);
        setSettings([]);
        setError({
          title: "Autenticação necessária",
          description: "Faça login para acessar as configurações de segurança.",
        });
        return;
      }

      if (user.role !== "SUPER_ADMIN") {
        setLoading(false);
        setSettings([]);
        setError({
          title: "Acesso negado",
          description: "Apenas SUPER_ADMIN pode gerenciar estas configurações.",
        });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await api.get<SecuritySettingsReadResponse>("/system/settings/panel");
        if (cancelled) {
          return;
        }

        setSettings(response.data.data);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setError(getPageErrorState(caughtError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const replaceSetting = (nextSetting: SecuritySettingItem) => {
    setSettings((current) =>
      current.map((item) => (item.key === nextSetting.key ? nextSetting : item)),
    );
  };

  const setPending = (key: string, action?: PendingAction) => {
    setPendingByKey((current) => ({
      ...current,
      [key]: action,
    }));
  };

  const runUpdate = async (item: SecuritySettingItem, nextValue: boolean) => {
    const previous = item;
    const optimistic = buildOptimisticSetting(item, nextValue);

    replaceSetting(optimistic);
    setPending(item.key, "update");

    try {
      const response = await api.put<SecuritySettingMutationResponse>(
        `/system/settings/panel/${encodeURIComponent(item.key)}`,
        { value: nextValue },
      );

      replaceSetting(response.data.setting);
      toast({
        title: "Configuração atualizada",
        description: `${item.label} foi atualizada com sucesso.`,
      });
    } catch (caughtError) {
      replaceSetting(previous);
      toast({
        title: "Falha ao salvar",
        description: getApiErrorMessage(
          caughtError,
          `Não foi possível atualizar ${item.label}.`,
        ),
        variant: "destructive",
      });
    } finally {
      setPending(item.key, undefined);
    }
  };

  const runRestore = async (item: SecuritySettingItem) => {
    setPending(item.key, "restore");

    try {
      const response = await api.post<SecuritySettingMutationResponse>(
        `/system/settings/panel/${encodeURIComponent(item.key)}/restore-fallback`,
        {},
      );

      replaceSetting(response.data.setting);
      toast({
        title: "Fallback restaurado",
        description: `${item.label} voltou a usar ${getOriginBadgeLabel(response.data.setting.resolvedSource)}.`,
      });
    } catch (caughtError) {
      toast({
        title: "Falha ao restaurar fallback",
        description: getApiErrorMessage(
          caughtError,
          `Não foi possível restaurar o fallback de ${item.label}.`,
        ),
        variant: "destructive",
      });
    } finally {
      setPending(item.key, undefined);
    }
  };

  const handleToggle = (item: SecuritySettingItem, nextValue: boolean) => {
    if (!item.editableInPanel || item.valueHidden || item.type !== "boolean") {
      return;
    }

    if (item.requiresConfirmation) {
      setConfirmation({
        open: true,
        item,
        nextValue,
        action: "update",
      });
      return;
    }

    void runUpdate(item, nextValue);
  };

  const handleRestore = (item: SecuritySettingItem) => {
    if (!item.hasDatabaseOverride) {
      return;
    }

    if (item.requiresConfirmation) {
      setConfirmation({
        open: true,
        item,
        nextValue: null,
        action: "restore",
      });
      return;
    }

    void runRestore(item);
  };

  const handleConfirmation = async () => {
    if (!confirmation.open || !confirmation.item) {
      return;
    }

    const { action, item, nextValue } = confirmation;
    setConfirmation(EMPTY_CONFIRMATION);

    if (action === "update" && typeof nextValue === "boolean") {
      await runUpdate(item, nextValue);
      return;
    }

    if (action === "restore") {
      await runRestore(item);
    }
  };

  const groups = groupSecuritySettings(settings);

  if (authLoading || loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <ConfigBreadcrumb items={[{ label: "Segurança" }]} />
        <Card>
          <CardContent className="flex min-h-[240px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando configurações dinâmicas...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <ConfigBreadcrumb items={[{ label: "Segurança" }]} />
        <Card>
          <CardContent className="pt-6">
            <Alert variant={error.title === "Acesso negado" || error.title === "Autenticação necessária" ? "warning" : "destructive"}>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{error.title}</AlertTitle>
              <AlertDescription>{error.description}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <ConfigBreadcrumb items={[{ label: "Segurança" }]} />

        <section className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Shield className="h-4 w-4" />
                Configuração dinâmica
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
                Segurança operacional com origem rastreável
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Ajuste apenas as configurações liberadas pelo backend. Cada linha mostra a origem atual do valor,
                respeita leitura protegida e mantém fallback para ENV ou padrão quando o override é removido.
              </p>
            </div>

            <div className="grid min-w-0 gap-3 sm:min-w-[250px]">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Configurações carregadas
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">{settings.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  itens liberados para o painel nesta fase.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Origem ativa
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="default">Painel</Badge>
                  <Badge variant="secondary">ENV</Badge>
                  <Badge variant="outline">Padrão</Badge>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alterações por item</AlertTitle>
          <AlertDescription>
            Cada mudança é salva individualmente, com auditoria no backend e rollback visual em caso de falha.
          </AlertDescription>
        </Alert>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
              Nenhuma configuração dinâmica aprovada foi encontrada para esta tela.
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.category}>
              <CardHeader>
                <CardTitle>{group.label}</CardTitle>
                <CardDescription>
                  Ajustes dinâmicos agrupados por categoria, respeitando as permissões e restrições enviadas pelo backend.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.items.map((item) => (
                  <SettingRow
                    key={item.key}
                    item={item}
                    pendingAction={pendingByKey[item.key]}
                    onToggle={handleToggle}
                    onRestore={handleRestore}
                  />
                ))}
              </CardContent>
            </Card>
          ))
        )}

        <Dialog
          open={confirmation.open}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmation(EMPTY_CONFIRMATION);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar alteração</DialogTitle>
              <DialogDescription>
                {confirmation.item ? (
                  confirmation.action === "restore" ? (
                    <>
                      Confirma restaurar o fallback de <strong>{confirmation.item.label}</strong>? O sistema voltará a
                      usar <strong>ENV</strong> ou <strong>Padrão</strong>, conforme disponibilidade.
                    </>
                  ) : (
                    <>
                      Confirma alterar <strong>{confirmation.item.label}</strong>? Essa mudança pode impactar o
                      comportamento operacional do sistema.
                    </>
                  )
                ) : (
                  "Confirme a alteração antes de prosseguir."
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmation(EMPTY_CONFIRMATION)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleConfirmation()}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default SecuritySettingsPage;
