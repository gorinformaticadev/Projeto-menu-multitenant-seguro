"use client";

import { type ReactNode, useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
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
      title: "Sessao expirada",
      description: "Faca login novamente para acessar as configuracoes dinamicas.",
    };
  }

  if (status === 403) {
    return {
      title: "Acesso negado",
      description: "Apenas SUPER_ADMIN pode visualizar ou alterar estas configuracoes dinamicas.",
    };
  }

  return {
    title: "Falha ao carregar configuracoes dinamicas",
    description: getApiErrorMessage(error, "Nao foi possivel carregar as configuracoes dinamicas."),
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
    <article data-testid={`security-setting-row-${item.key}`} className="rounded-xl border p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
            <InfoButton label={`Informacoes sobre ${item.label}`}>
              <p>{item.description}</p>
            </InfoButton>

            <Badge data-testid={`security-setting-origin-${item.key}`} variant={getOriginBadgeVariant(item.resolvedSource)}>
              {getOriginBadgeLabel(item.resolvedSource)}
            </Badge>

            {!item.editableInPanel ? <Badge variant="outline">Somente leitura</Badge> : null}
            {item.valueHidden ? <Badge variant="outline">Valor protegido</Badge> : null}
            {item.restartRequired ? <Badge variant="outline">Requer reinicio</Badge> : null}
            {item.requiresConfirmation ? <Badge variant="outline">Exige confirmacao</Badge> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Valor atual: {formatVisibleValue(item)}</span>
            {lastUpdated ? <span>Ultima alteracao: {lastUpdated}</span> : null}
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
                className={disabledUncheckedSwitchClassName}
              />
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
                {item.valueHidden ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                {item.editableInPanel ? "Sem controle visual" : "Somente leitura"}
              </div>
            )}
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>

          {item.hasDatabaseOverride ? (
            <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => onRestore(item)}>
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

export function DynamicSecuritySettingsSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SecuritySettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorState | null>(null);
  const [pendingByKey, setPendingByKey] = useState<Record<string, PendingAction | undefined>>({});
  const [confirmation, setConfirmation] = useState<ConfirmationState>(EMPTY_CONFIRMATION);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<SecuritySettingsReadResponse>("/system/settings/panel");
        if (!cancelled) {
          setSettings(response.data.data);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(getPageErrorState(caughtError));
        }
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
  }, []);

  const replaceSetting = (nextSetting: SecuritySettingItem) => {
    setSettings((current) => current.map((item) => (item.key === nextSetting.key ? nextSetting : item)));
  };

  const setPending = (key: string, action?: PendingAction) => {
    setPendingByKey((current) => ({ ...current, [key]: action }));
  };

  const runUpdate = async (item: SecuritySettingItem, nextValue: boolean) => {
    const previous = item;
    replaceSetting(buildOptimisticSetting(item, nextValue));
    setPending(item.key, "update");

    try {
      const response = await api.put<SecuritySettingMutationResponse>(`/system/settings/panel/${encodeURIComponent(item.key)}`, {
        value: nextValue,
      });
      replaceSetting(response.data.setting);
      toast({ title: "Configuracao atualizada", description: `${item.label} foi atualizada com sucesso.` });
    } catch (caughtError) {
      replaceSetting(previous);
      toast({
        title: "Falha ao salvar",
        description: getApiErrorMessage(caughtError, `Nao foi possivel atualizar ${item.label}.`),
        variant: "destructive",
      });
    } finally {
      setPending(item.key, undefined);
    }
  };

  const runRestore = async (item: SecuritySettingItem) => {
    setPending(item.key, "restore");

    try {
      const response = await api.post<SecuritySettingMutationResponse>(`/system/settings/panel/${encodeURIComponent(item.key)}/restore-fallback`, {});
      replaceSetting(response.data.setting);
      toast({
        title: "Fallback restaurado",
        description: `${item.label} voltou a usar ${getOriginBadgeLabel(response.data.setting.resolvedSource)}.`,
      });
    } catch (caughtError) {
      toast({
        title: "Falha ao restaurar fallback",
        description: getApiErrorMessage(caughtError, `Nao foi possivel restaurar o fallback de ${item.label}.`),
        variant: "destructive",
      });
    } finally {
      setPending(item.key, undefined);
    }
  };

  const handleToggle = (item: SecuritySettingItem, nextValue: boolean) => {
    if (!item.editableInPanel || item.valueHidden || item.type !== "boolean") return;
    if (item.requiresConfirmation) {
      setConfirmation({ open: true, item, nextValue, action: "update" });
      return;
    }
    void runUpdate(item, nextValue);
  };

  const handleRestore = (item: SecuritySettingItem) => {
    if (!item.hasDatabaseOverride) return;
    if (item.requiresConfirmation) {
      setConfirmation({ open: true, item, nextValue: null, action: "restore" });
      return;
    }
    void runRestore(item);
  };

  const handleConfirmation = async () => {
    if (!confirmation.open || !confirmation.item) return;
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

  return (
    <>
      <Card data-testid="dynamic-security-settings-section">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Configuracoes Dinamicas de Seguranca</CardTitle>
            <InfoButton label="Informacoes sobre Configuracoes Dinamicas de Seguranca">
              <p>Esta secao complementa as configuracoes tradicionais acima com toggles administraveis por painel.</p>
            </InfoButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium text-foreground">Alteracoes por item</span>
            <InfoButton label="Informacoes sobre Alteracoes por item">
              <p>Cada mudanca e salva individualmente, com auditoria no backend e restore para ENV ou Padrao quando necessario.</p>
            </InfoButton>
          </div>

          {loading ? (
            <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando configuracoes dinamicas...
            </div>
          ) : error ? (
            <Alert variant={error.title === "Acesso negado" || error.title === "Sessao expirada" ? "warning" : "destructive"}>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{error.title}</AlertTitle>
              <AlertDescription>{error.description}</AlertDescription>
            </Alert>
          ) : groups.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
              Nenhuma configuracao dinamica aprovada foi encontrada para esta tela.
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.category} className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{group.label}</h3>
                  <InfoButton label={`Informacoes sobre ${group.label}`}>
                    <p>Ajustes dinamicos agrupados por categoria, respeitando as restricoes enviadas pelo backend.</p>
                  </InfoButton>
                </div>

                <div className="space-y-4">
                  {group.items.map((item) => (
                    <SettingRow
                      key={item.key}
                      item={item}
                      pendingAction={pendingByKey[item.key]}
                      onToggle={handleToggle}
                      onRestore={handleRestore}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmation.open} onOpenChange={(open) => !open && setConfirmation(EMPTY_CONFIRMATION)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteracao</DialogTitle>
            <DialogDescription>
              {confirmation.item ? (
                confirmation.action === "restore" ? (
                  <>
                    Confirma restaurar o fallback de <strong>{confirmation.item.label}</strong>? O sistema voltara a usar <strong>ENV</strong> ou <strong>Padrao</strong>, conforme disponibilidade.
                  </>
                ) : (
                  <>
                    Confirma alterar <strong>{confirmation.item.label}</strong>? Essa mudanca pode impactar o comportamento operacional do sistema.
                  </>
                )
              ) : (
                "Confirme a alteracao antes de prosseguir."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(EMPTY_CONFIRMATION)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleConfirmation()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
