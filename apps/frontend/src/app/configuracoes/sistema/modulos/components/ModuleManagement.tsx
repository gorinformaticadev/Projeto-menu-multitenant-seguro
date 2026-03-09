"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ElementType,
} from "react";
import {
  Database,
  Info,
  Loader2,
  MoreHorizontal,
  Package,
  PanelRight,
  Power,
  PowerOff,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getAllowedModuleActions,
  getDisabledTooltip,
  getLifecycleStepBadgeClass,
  getStatusBadgeConfig,
  getStatusGuidance,
  type AllowedModuleActions,
  type InstalledModule,
  type ModuleLifecycleStepStatus,
} from "@/lib/module-utils";
import { cn } from "@/lib/utils";

interface ModuleInstallerCapabilities {
  environment: string;
  overrideEnabled: boolean;
  mutableModuleOpsAllowed: boolean;
  reason: "development" | "explicit_override" | "blocked";
  message: string;
}

type ModuleLifecycleStepKey =
  | "files"
  | "database"
  | "dependencies"
  | "build"
  | "approval"
  | "activation";

interface LifecycleChip {
  key: ModuleLifecycleStepKey;
  label: string;
  status: ModuleLifecycleStepStatus;
}

interface ModuleActionConfig {
  key: "prepare" | "activate" | "deactivate" | "reload" | "uninstall";
  label: string;
  icon: ElementType;
  onClick: () => Promise<void> | void;
  disabled: boolean;
  description: string;
  variant?: "default" | "outline" | "secondary" | "destructive";
  className?: string;
  loading?: boolean;
}

const lifecycleStepLabels: Record<ModuleLifecycleStepKey, string> = {
  files: "Arquivos",
  database: "Banco",
  dependencies: "Dependencias",
  build: "Build",
  approval: "Aprovacao",
  activation: "Ativacao",
};

const lifecycleStepStatusLabels: Record<ModuleLifecycleStepStatus, string> = {
  ready: "OK",
  pending: "Pendente",
  blocked: "Bloqueado",
  error: "Erro",
};

function getCompactLifecycleChips(module: InstalledModule): LifecycleChip[] {
  if (!module.lifecycle) {
    return [];
  }

  const coreSteps: ModuleLifecycleStepKey[] = ["files", "database", "dependencies"];
  const optionalSteps: ModuleLifecycleStepKey[] = ["build", "approval", "activation"];
  const visibleKeys = new Set<ModuleLifecycleStepKey>(coreSteps);

  optionalSteps.forEach((stepKey) => {
    const step = module.lifecycle?.steps[stepKey];
    if (!step) {
      return;
    }

    if (stepKey === "build") {
      if (
        module.lifecycle?.frontendValidationLevel !== "not_required" ||
        step.status !== "ready"
      ) {
        visibleKeys.add(stepKey);
      }
      return;
    }

    if (step.status !== "ready") {
      visibleKeys.add(stepKey);
    }
  });

  return Array.from(visibleKeys).map((key) => ({
    key,
    label: lifecycleStepLabels[key],
    status: module.lifecycle!.steps[key].status,
  }));
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Nao informado";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR");
}

function getLifecycleSummaryText(module: InstalledModule) {
  if (!module.lifecycle) {
    return null;
  }

  if (module.lifecycle.blockers.length > 0) {
    return module.lifecycle.blockers[0];
  }

  if (module.lifecycle.current === "active") {
    return "Modulo operacional e disponivel para ativacao por tenant.";
  }

  if (module.lifecycle.current === "db_ready") {
    return "Banco preparado. O proximo passo e a ativacao global.";
  }

  if (module.lifecycle.current === "files_installed") {
    return "Arquivos instalados. Falta preparar o banco do modulo.";
  }

  if (module.lifecycle.current === "error") {
    return "Existe ao menos um bloqueio tecnico que impede o uso do modulo.";
  }

  return null;
}

export function ModuleManagement() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [modules, setModules] = useState<InstalledModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [selectedModule, setSelectedModule] = useState<InstalledModule | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [detailsTab, setDetailsTab] = useState("overview");
  const [moduleDetailsLoading, setModuleDetailsLoading] = useState(false);
  const [updatingDatabase, setUpdatingDatabase] = useState<string | null>(null);
  const [dbUpdateStatus, setDbUpdateStatus] = useState("");
  const [reloadingConfig, setReloadingConfig] = useState<string | null>(null);
  const [installerCapabilities, setInstallerCapabilities] =
    useState<ModuleInstallerCapabilities | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(true);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [openActionMenuFor, setOpenActionMenuFor] = useState<string | null>(null);

  const moduleUploadEnabled = installerCapabilities?.mutableModuleOpsAllowed ?? false;

  const fetchModuleDetails = useCallback(async (moduleSlug: string) => {
    const response = await api.get(`/configuracoes/sistema/modulos/${moduleSlug}/status`);
    return response.data.module as InstalledModule;
  }, []);

  const loadInstalledModules = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const response = await api.get("/configuracoes/sistema/modulos");
        setModules(response.data || []);
      } catch (error: unknown) {
        toast({
          title: "Erro ao carregar modulos",
          description:
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Ocorreu um erro no servidor",
          variant: "destructive",
        });
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [toast],
  );

  const refreshSelectedModuleDetails = useCallback(
    async (moduleSlug: string) => {
      if (!showInfoDialog || selectedModule?.slug !== moduleSlug) {
        return;
      }

      try {
        const updatedModule = await fetchModuleDetails(moduleSlug);
        setSelectedModule(updatedModule);
      } catch {
        setShowInfoDialog(false);
      }
    },
    [fetchModuleDetails, selectedModule?.slug, showInfoDialog],
  );

  const refreshModuleData = useCallback(
    async (moduleSlug?: string) => {
      await loadInstalledModules({ silent: true });
      if (moduleSlug) {
        await refreshSelectedModuleDetails(moduleSlug);
      }
    },
    [loadInstalledModules, refreshSelectedModuleDetails],
  );

  const loadInstallerCapabilities = useCallback(async () => {
    try {
      setLoadingCapabilities(true);
      const response = await api.get("/configuracoes/sistema/modulos/capabilities");
      setInstallerCapabilities(response.data);
    } catch {
      setInstallerCapabilities({
        environment: "unknown",
        overrideEnabled: false,
        mutableModuleOpsAllowed: false,
        reason: "blocked",
        message:
          "Nao foi possivel validar no backend se o instalador interno esta liberado para alteracoes de modulos.",
      });
    } finally {
      setLoadingCapabilities(false);
    }
  }, []);

  useEffect(() => {
    void loadInstalledModules();
    void loadInstallerCapabilities();
  }, [loadInstalledModules, loadInstallerCapabilities]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.endsWith(".zip")) {
      toast({
        title: "Arquivo invalido",
        description: "Apenas arquivos ZIP sao aceitos",
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no maximo 50MB",
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    toast({
      title: "Arquivo selecionado",
      description: `Arquivo "${file.name}" pronto para upload`,
    });
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return "0 Bytes";
    }

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const uploadModule = async () => {
    if (!moduleUploadEnabled) {
      toast({
        title: "Operacao bloqueada",
        description:
          installerCapabilities?.message ||
          "Operacoes mutaveis de modulos estao bloqueadas neste ambiente.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.post("/configuracoes/sistema/modulos/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast({
        title: "Sucesso!",
        description: response.data.message || "Modulo instalado com sucesso",
      });

      await loadInstalledModules({ silent: true });
      setActiveTab("installed");
      clearSelectedFile();
    } catch (error: unknown) {
      toast({
        title: "Erro no upload",
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Erro ao fazer upload do modulo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const openRemoveDialog = (module: InstalledModule) => {
    setOpenActionMenuFor(null);
    setShowInfoDialog(false);
    setSelectedModule(module);
    setConfirmationInput("");
    setShowRemoveDialog(true);
  };

  const handleRemoveModule = async () => {
    if (!moduleUploadEnabled) {
      toast({
        title: "Operacao bloqueada",
        description:
          installerCapabilities?.message ||
          "Operacoes mutaveis de modulos estao bloqueadas neste ambiente.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedModule) {
      return;
    }

    if (confirmationInput !== selectedModule.slug) {
      toast({
        title: "Confirmacao incorreta",
        description: "Digite o slug exato do modulo para confirmar.",
        variant: "destructive",
      });
      return;
    }

    try {
      await api.delete(`/configuracoes/sistema/modulos/${selectedModule.slug}/uninstall`, {
        data: {
          confirmationName: confirmationInput,
          dataRemovalOption: "full",
        },
      });

      toast({
        title: "Modulo removido",
        description: "Modulo removido com sucesso",
      });

      setShowRemoveDialog(false);
      setShowInfoDialog(false);
      setSelectedModule(null);
      setConfirmationInput("");
      await loadInstalledModules({ silent: true });
    } catch (error: unknown) {
      const errorMessage =
        (error as { response?: { data?: { message?: string }; status?: number } })?.response?.data
          ?.message || "Ocorreu um erro no servidor";
      const status = (error as { response?: { status?: number } })?.response?.status;

      if (errorMessage === "MÃ³dulo nÃ£o encontrado" || status === 404) {
        toast({
          title: "Modulo nao encontrado",
          description: "O modulo ja foi removido ou nao existe. Atualizando lista...",
        });
        setShowRemoveDialog(false);
        setShowInfoDialog(false);
        setSelectedModule(null);
        setConfirmationInput("");
        await loadInstalledModules({ silent: true });
        return;
      }

      toast({
        title: "Erro ao remover modulo",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const openInfoDialog = async (module: InstalledModule) => {
    try {
      setOpenActionMenuFor(null);
      setDetailsTab("overview");
      setSelectedModule(module);
      setShowInfoDialog(true);
      setModuleDetailsLoading(true);

      const moduleDetails = await fetchModuleDetails(module.slug);
      setSelectedModule(moduleDetails);
    } catch (error: unknown) {
      setShowInfoDialog(false);
      toast({
        title: "Erro ao carregar informacoes",
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setModuleDetailsLoading(false);
    }
  };

  const prepareModuleDatabase = async (moduleName: string) => {
    setUpdatingDatabase(moduleName);
    setDbUpdateStatus("Validando modulo...");

    try {
      setDbUpdateStatus("Preparando banco...");
      const response = await api.post(
        `/configuracoes/sistema/modulos/${moduleName}/prepare-database`,
      );

      toast({
        title: "Banco preparado!",
        description:
          response.data.message ||
          "Migracoes e seeds pendentes foram executados com sucesso.",
        className: "bg-green-50 border-green-200 text-green-800",
      });

      await refreshModuleData(moduleName);
    } catch (error: unknown) {
      toast({
        title: "Erro ao preparar banco de dados",
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setUpdatingDatabase(null);
      setDbUpdateStatus("");
    }
  };

  const activateModule = async (moduleName: string) => {
    try {
      const response = await api.post(`/configuracoes/sistema/modulos/${moduleName}/activate`);

      toast({
        title: "Modulo ativado!",
        description: response.data.message || "Modulo ativado com sucesso",
      });

      await refreshModuleData(moduleName);
    } catch (error: unknown) {
      toast({
        title: "Erro ao ativar modulo",
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
  };

  const deactivateModule = async (moduleName: string) => {
    try {
      const response = await api.post(`/configuracoes/sistema/modulos/${moduleName}/deactivate`);

      toast({
        title: "Modulo desativado!",
        description: response.data.message || "Modulo desativado com sucesso",
      });

      await refreshModuleData(moduleName);
    } catch (error: unknown) {
      toast({
        title: "Erro ao desativar modulo",
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
  };

  const reloadModuleConfig = async (moduleName: string) => {
    if (!moduleUploadEnabled) {
      toast({
        title: "Operacao bloqueada",
        description:
          installerCapabilities?.message ||
          "Operacoes mutaveis de modulos estao bloqueadas neste ambiente.",
        variant: "destructive",
      });
      return;
    }

    setReloadingConfig(moduleName);

    try {
      await api.post(`/configuracoes/sistema/modulos/${moduleName}/reload-config`);

      toast({
        title: "Configuracao recarregada!",
        description: `Menus e configuracoes do modulo ${moduleName} foram atualizados.`,
      });

      await refreshModuleData(moduleName);
    } catch (error: unknown) {
      toast({
        title: "Erro ao recarregar configuracao",
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Ocorreu um erro ao recarregar a configuracao",
        variant: "destructive",
      });
    } finally {
      setReloadingConfig(null);
    }
  };

  const getPrimaryAction = useCallback(
    (module: InstalledModule, allowedActions: AllowedModuleActions): ModuleActionConfig | null => {
      if (updatingDatabase === module.slug) {
        return {
          key: "prepare",
          label: dbUpdateStatus || "Preparando...",
          icon: Loader2,
          onClick: () => undefined,
          disabled: true,
          description: "Preparacao do banco em andamento.",
          variant: "secondary",
          loading: true,
        };
      }

      if (allowedActions.updateDatabase) {
        return {
          key: "prepare",
          label: "Preparar banco",
          icon: Database,
          onClick: () => prepareModuleDatabase(module.slug),
          disabled: false,
          description: "Executa a preparacao oficial do banco do modulo.",
          variant: "secondary",
        };
      }

      if (allowedActions.activate) {
        return {
          key: "activate",
          label: "Ativar",
          icon: Power,
          onClick: () => activateModule(module.slug),
          disabled: false,
          description: "Ativa o modulo globalmente no sistema.",
          variant: "default",
          className: "bg-green-600 hover:bg-green-700",
        };
      }

      if (allowedActions.deactivate) {
        return {
          key: "deactivate",
          label: "Desativar",
          icon: PowerOff,
          onClick: () => deactivateModule(module.slug),
          disabled: false,
          description: "Desativa o modulo sem remover seus dados.",
          variant: "outline",
        };
      }

      return null;
    },
    [activateModule, dbUpdateStatus, deactivateModule, prepareModuleDatabase, updatingDatabase],
  );

  const getSecondaryActions = useCallback(
    (module: InstalledModule, allowedActions: AllowedModuleActions): ModuleActionConfig[] => {
      const primaryAction = getPrimaryAction(module, allowedActions);

      const actions: ModuleActionConfig[] = [
        {
          key: "reload",
          label: reloadingConfig === module.slug ? "Recarregando..." : "Recarregar configuracao",
          icon: reloadingConfig === module.slug ? Loader2 : RefreshCw,
          onClick: () => reloadModuleConfig(module.slug),
          disabled: reloadingConfig === module.slug || loadingCapabilities || !moduleUploadEnabled,
          description: moduleUploadEnabled
            ? "Sincroniza menus e configuracoes a partir do module.json atual."
            : installerCapabilities?.message ||
              "Operacoes mutaveis de modulos estao bloqueadas neste ambiente.",
          variant: "outline",
          loading: reloadingConfig === module.slug,
        },
        {
          key: "prepare",
          label:
            updatingDatabase === module.slug ? dbUpdateStatus || "Preparando..." : "Preparar banco",
          icon: updatingDatabase === module.slug ? Loader2 : Database,
          onClick: () => prepareModuleDatabase(module.slug),
          disabled: !allowedActions.updateDatabase || updatingDatabase === module.slug,
          description: allowedActions.updateDatabase
            ? "Executa a preparacao oficial do banco do modulo."
            : getDisabledTooltip("updateDatabase", module),
          variant: "outline",
          loading: updatingDatabase === module.slug,
        },
        {
          key: "activate",
          label: "Ativar",
          icon: Power,
          onClick: () => activateModule(module.slug),
          disabled: !allowedActions.activate,
          description: allowedActions.activate
            ? "Ativa o modulo globalmente."
            : getDisabledTooltip("activate", module),
          variant: "outline",
        },
        {
          key: "deactivate",
          label: "Desativar",
          icon: PowerOff,
          onClick: () => deactivateModule(module.slug),
          disabled: !allowedActions.deactivate,
          description: allowedActions.deactivate
            ? "Desativa o modulo sem remover seus dados."
            : getDisabledTooltip("deactivate", module),
          variant: "outline",
        },
        {
          key: "uninstall",
          label: "Desinstalar",
          icon: Trash2,
          onClick: () => openRemoveDialog(module),
          disabled: !allowedActions.uninstall || loadingCapabilities || !moduleUploadEnabled,
          description:
            allowedActions.uninstall && moduleUploadEnabled
              ? "Remove os arquivos e o registro do modulo."
              : !moduleUploadEnabled
                ? installerCapabilities?.message ||
                  "Operacoes mutaveis de modulos estao bloqueadas neste ambiente."
                : getDisabledTooltip("uninstall", module),
          variant: "destructive",
        },
      ];

      return actions.filter((action) => action.key !== primaryAction?.key);
    },
    [
      activateModule,
      dbUpdateStatus,
      deactivateModule,
      getPrimaryAction,
      installerCapabilities?.message,
      loadingCapabilities,
      moduleUploadEnabled,
      openRemoveDialog,
      prepareModuleDatabase,
      reloadModuleConfig,
      reloadingConfig,
      updatingDatabase,
    ],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Instalar Modulos</TabsTrigger>
          <TabsTrigger value="installed">Modulos Instalados</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Instalacao de Modulos
              </CardTitle>
              <CardDescription>
                Faca upload de modulos em formato ZIP para instalar globalmente no sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!loadingCapabilities && installerCapabilities && !moduleUploadEnabled && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">Instalador interno em modo restrito</p>
                  <p className="mt-1">
                    Ambiente atual: <strong>{installerCapabilities.environment}</strong>.{" "}
                    {installerCapabilities.message}
                  </p>
                </div>
              )}

              {!selectedFile ? (
                <div className="rounded-2xl border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                  <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold">Selecione um arquivo ZIP</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Arraste e solte ou clique para selecionar um modulo (.zip, max. 50MB)
                  </p>
                  <Button
                    className="mt-5"
                    onClick={handleFileSelect}
                    disabled={uploading || loadingCapabilities || !moduleUploadEnabled}
                  >
                    Selecionar arquivo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-green-100 p-2">
                          <Package className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-green-800">Arquivo selecionado</h3>
                          <p className="text-sm text-green-700">Pronto para instalacao</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelectedFile}
                        className="text-green-600 hover:text-green-700"
                      >
                        x
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-green-800 sm:grid-cols-2">
                      <p>
                        <span className="font-medium">Nome:</span> {selectedFile.name}
                      </p>
                      <p>
                        <span className="font-medium">Tamanho:</span> {formatFileSize(selectedFile.size)}
                      </p>
                      <p>
                        <span className="font-medium">Tipo:</span>{" "}
                        {selectedFile.type || "application/zip"}
                      </p>
                      <p>
                        <span className="font-medium">Modificado em:</span>{" "}
                        {new Date(selectedFile.lastModified).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={uploadModule}
                      disabled={uploading || loadingCapabilities || !moduleUploadEnabled}
                      className="sm:flex-1"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Instalando modulo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Instalar modulo
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={clearSelectedFile}
                      disabled={uploading || loadingCapabilities || !moduleUploadEnabled}
                    >
                      Cancelar
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              <div className="mt-6 rounded-2xl bg-muted/50 p-4">
                <h4 className="mb-3 flex items-center gap-2 font-medium">
                  <Info className="h-4 w-4" />
                  Estrutura do modulo
                </h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    - <code className="rounded bg-muted px-1">module.json</code> - configuracao do
                    modulo
                  </p>
                  <p>
                    - <code className="rounded bg-muted px-1">migrations/</code> - scripts SQL
                    opcionais
                  </p>
                  <p>
                    - <code className="rounded bg-muted px-1">package.json</code> - dependencias
                    opcionais
                  </p>
                  <p>- Demais arquivos do modulo, como componentes e assets.</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-medium text-blue-800">
                  <Settings className="h-4 w-4" />
                  Instalacao global
                </h4>
                <p className="text-sm text-blue-700">
                  Os modulos instalados aqui ficam disponiveis para todos os tenants do sistema.
                  Cada tenant pode ativa-los ou desativa-los individualmente em suas configuracoes.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="installed" className="mt-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Modulos Instalados no Sistema
              </CardTitle>
              <CardDescription>
                Visualize os modulos de forma compacta e abra os detalhes tecnicos apenas quando
                necessario.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {modules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-muted-foreground/25 px-6 py-12 text-center">
                  <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                  <p className="text-base font-medium">Nenhum modulo instalado no sistema</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use a aba de instalacao para adicionar novos modulos.
                  </p>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-3">
                    {modules.map((module) => {
                      const allowedActions = getAllowedModuleActions(module);
                      const badgeConfig = getStatusBadgeConfig(module.status);
                      const compactChips = getCompactLifecycleChips(module);
                      const primaryAction = getPrimaryAction(module, allowedActions);
                      const secondaryActions = getSecondaryActions(module, allowedActions);
                      const lifecycleSummary = getLifecycleSummaryText(module);

                      return (
                        <Card
                          key={module.slug}
                          className="border-border/70 bg-card/80 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-start gap-3">
                                  <div className="rounded-2xl border border-border/60 bg-muted/50 p-2.5">
                                    <Package className="h-5 w-5 text-foreground/75" />
                                  </div>

                                  <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="truncate text-base font-semibold sm:text-lg">
                                        {module.name}
                                      </h3>
                                      <Badge className={cn("border", badgeConfig.color)}>
                                        {badgeConfig.label}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        v{module.version}
                                      </Badge>
                                    </div>

                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                      {module.description}
                                    </p>
                                  </div>
                                </div>

                                {compactChips.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {compactChips.map((chip) => (
                                      <Badge
                                        key={chip.key}
                                        variant="outline"
                                        className={cn(
                                          "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                          getLifecycleStepBadgeClass(chip.status),
                                        )}
                                      >
                                        {chip.label} {lifecycleStepStatusLabels[chip.status]}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span>Slug: {module.slug}</span>
                                  {module.stats && <span>{module.stats.tenants} tenant(s)</span>}
                                  {module.stats && <span>{module.stats.migrations} migration(s)</span>}
                                  {module.stats && <span>{module.stats.menus} menu(s)</span>}
                                  <span>{module.hasBackend ? "Backend" : "Sem backend"}</span>
                                  <span>{module.hasFrontend ? "Frontend" : "Sem frontend"}</span>
                                </div>

                                {lifecycleSummary && (
                                  <p className="text-xs text-muted-foreground">{lifecycleSummary}</p>
                                )}
                              </div>

                              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap xl:w-auto xl:justify-end">
                                <Button
                                  variant="outline"
                                  className="w-full sm:w-auto"
                                  onClick={() => openInfoDialog(module)}
                                >
                                  <PanelRight className="mr-2 h-4 w-4" />
                                  Detalhes
                                </Button>

                                {primaryAction && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant={primaryAction.variant}
                                        className={cn("w-full sm:w-auto", primaryAction.className)}
                                        onClick={() => void primaryAction.onClick()}
                                        disabled={primaryAction.disabled}
                                      >
                                        <primaryAction.icon
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            primaryAction.loading && "animate-spin",
                                          )}
                                        />
                                        {primaryAction.label}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{primaryAction.description}</TooltipContent>
                                  </Tooltip>
                                )}

                                <Popover
                                  open={openActionMenuFor === module.slug}
                                  onOpenChange={(open) =>
                                    setOpenActionMenuFor(open ? module.slug : null)
                                  }
                                >
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="icon" className="shrink-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Mais acoes</span>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    align="end"
                                    className="w-72 rounded-2xl border border-border/70 p-2"
                                  >
                                    <div className="space-y-1">
                                      <div className="px-2 py-1.5">
                                        <p className="text-sm font-medium">Acoes do modulo</p>
                                        <p className="text-xs text-muted-foreground">
                                          Operacoes disponiveis para {module.name}
                                        </p>
                                      </div>

                                      {secondaryActions.map((action) => (
                                        <Tooltip key={action.key}>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              className="h-auto w-full justify-start rounded-xl px-3 py-2 text-left"
                                              disabled={action.disabled}
                                              onClick={() => {
                                                setOpenActionMenuFor(null);
                                                void action.onClick();
                                              }}
                                            >
                                              <action.icon
                                                className={cn(
                                                  "mr-3 h-4 w-4 shrink-0",
                                                  action.loading && "animate-spin",
                                                  action.variant === "destructive" &&
                                                    "text-destructive",
                                                )}
                                              />
                                              <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium">
                                                  {action.label}
                                                </span>
                                                <span className="block text-xs text-muted-foreground">
                                                  {action.description}
                                                </span>
                                              </span>
                                            </Button>
                                          </TooltipTrigger>
                                          {action.disabled && (
                                            <TooltipContent>{action.description}</TooltipContent>
                                          )}
                                        </Tooltip>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={showInfoDialog}
        onOpenChange={(open) => {
          setShowInfoDialog(open);
          if (!open) {
            setModuleDetailsLoading(false);
          }
        }}
      >
        <DialogContent className="left-0 top-0 h-dvh max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 sm:left-auto sm:right-0 sm:w-[min(760px,100vw)] sm:border-l sm:border-border/70">
          <div className="flex h-full flex-col bg-background">
            <DialogHeader className="border-b px-6 py-5 text-left">
              <div className="pr-8">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <Package className="h-5 w-5 text-foreground/70" />
                  {selectedModule?.name || "Detalhes do modulo"}
                  {selectedModule && (
                    <>
                      <Badge
                        className={cn(
                          "border",
                          getStatusBadgeConfig(selectedModule.status).color,
                        )}
                      >
                        {getStatusBadgeConfig(selectedModule.status).label}
                      </Badge>
                      <Badge variant="outline">v{selectedModule.version}</Badge>
                    </>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-2">
                  {selectedModule?.description ||
                    "Informacoes tecnicas e operacionais do modulo selecionado."}
                </DialogDescription>
              </div>
            </DialogHeader>

            {moduleDetailsLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedModule ? (
              <Tabs
                value={detailsTab}
                onValueChange={setDetailsTab}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="border-b px-4 py-3 sm:px-6">
                  <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
                    <TabsTrigger value="overview" className="rounded-lg">
                      Visao geral
                    </TabsTrigger>
                    <TabsTrigger value="technical" className="rounded-lg">
                      Status tecnico
                    </TabsTrigger>
                    <TabsTrigger value="operations" className="rounded-lg">
                      Operacoes
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                  <TabsContent value="overview" className="mt-0 space-y-4">
                    <Card className="border-border/70">
                      <CardContent className="space-y-4 p-4">
                        <div>
                          <p className="text-sm font-medium">
                            {getStatusGuidance(selectedModule.status).title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {getStatusGuidance(selectedModule.status).message}
                          </p>
                          <p className="mt-2 text-xs text-primary">
                            {getStatusGuidance(selectedModule.status).suggestion}
                          </p>
                        </div>

                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div className="rounded-xl border bg-muted/30 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Instalado em
                            </p>
                            <p className="mt-1 font-medium">
                              {formatDateTime(selectedModule.installedAt)}
                            </p>
                          </div>
                          <div className="rounded-xl border bg-muted/30 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Ativado em
                            </p>
                            <p className="mt-1 font-medium">
                              {formatDateTime(selectedModule.activatedAt)}
                            </p>
                          </div>
                        </div>

                        {selectedModule.stats && (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border bg-muted/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Tenants
                              </p>
                              <p className="mt-1 text-xl font-semibold">
                                {selectedModule.stats.tenants}
                              </p>
                            </div>
                            <div className="rounded-xl border bg-muted/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Migrations
                              </p>
                              <p className="mt-1 text-xl font-semibold">
                                {selectedModule.stats.migrations}
                              </p>
                            </div>
                            <div className="rounded-xl border bg-muted/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Menus
                              </p>
                              <p className="mt-1 text-xl font-semibold">
                                {selectedModule.stats.menus}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                          <p className="text-sm text-blue-800">
                            Este modulo esta instalado globalmente. A habilitacao por tenant
                            continua sendo feita nas configuracoes da empresa.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="technical" className="mt-0 space-y-4">
                    <Card className="border-border/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Status do lifecycle</CardTitle>
                        <CardDescription>
                          Leitura rapida das etapas tecnicas exigidas para o modulo.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {selectedModule.lifecycle ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {(
                                Object.keys(selectedModule.lifecycle.steps) as ModuleLifecycleStepKey[]
                              ).map((stepKey) => {
                                const step = selectedModule.lifecycle!.steps[stepKey];
                                return (
                                  <Badge
                                    key={stepKey}
                                    variant="outline"
                                    className={cn(
                                      "rounded-full px-3 py-1 text-xs font-medium",
                                      getLifecycleStepBadgeClass(step.status),
                                    )}
                                  >
                                    {lifecycleStepLabels[stepKey]}{" "}
                                    {lifecycleStepStatusLabels[step.status]}
                                  </Badge>
                                );
                              })}
                            </div>

                            <div className="grid gap-3">
                              {(
                                Object.keys(selectedModule.lifecycle.steps) as ModuleLifecycleStepKey[]
                              ).map((stepKey) => {
                                const step = selectedModule.lifecycle!.steps[stepKey];
                                return (
                                  <div
                                    key={stepKey}
                                    className={cn(
                                      "rounded-2xl border px-4 py-3",
                                      getLifecycleStepBadgeClass(step.status),
                                    )}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="font-medium">{lifecycleStepLabels[stepKey]}</p>
                                      <Badge variant="outline" className="bg-white/70">
                                        {lifecycleStepStatusLabels[step.status]}
                                      </Badge>
                                    </div>
                                    <p className="mt-2 text-sm">{step.detail}</p>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                              <div className="rounded-xl border bg-muted/30 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Backend
                                </p>
                                <p className="mt-1 font-medium">
                                  {selectedModule.hasBackend ? "Disponivel" : "Nao encontrado"}
                                </p>
                              </div>
                              <div className="rounded-xl border bg-muted/30 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Frontend
                                </p>
                                <p className="mt-1 font-medium">
                                  {selectedModule.hasFrontend ? "Disponivel" : "Nao encontrado"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {selectedModule.lifecycle.frontendValidationLevel ===
                                  "not_required"
                                    ? "Modulo sem frontend."
                                    : selectedModule.lifecycle.frontendValidationLevel ===
                                        "permissive"
                                      ? "Validacao parcial. O backend nao conseguiu comprovar o build atual."
                                      : "Validacao estrutural realizada no filesystem do frontend."}
                                </p>
                              </div>
                            </div>

                            {selectedModule.lifecycle.blockers.length > 0 && (
                              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-sm font-medium text-amber-900">
                                  Bloqueios detectados
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                                  {selectedModule.lifecycle.blockers.map((blocker) => (
                                    <li key={blocker}>- {blocker}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                            O backend ainda nao retornou detalhes tecnicos do lifecycle para este
                            modulo.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="operations" className="mt-0">
                    <div className="grid gap-3">
                      {(() => {
                        const allowedActions = getAllowedModuleActions(selectedModule);
                        const detailActions = [
                          getPrimaryAction(selectedModule, allowedActions),
                          ...getSecondaryActions(selectedModule, allowedActions),
                        ].filter(Boolean) as ModuleActionConfig[];

                        return detailActions.map((action) => (
                          <Card key={action.key} className="border-border/70">
                            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="rounded-xl border bg-muted/30 p-2">
                                  <action.icon
                                    className={cn(
                                      "h-4 w-4",
                                      action.loading && "animate-spin",
                                      action.variant === "destructive" && "text-destructive",
                                    )}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium">{action.label}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {action.description}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant={action.variant}
                                className={cn("w-full sm:w-auto", action.className)}
                                disabled={action.disabled}
                                onClick={() => void action.onClick()}
                              >
                                <action.icon
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    action.loading && "animate-spin",
                                  )}
                                />
                                {action.label}
                              </Button>
                            </CardContent>
                          </Card>
                        ));
                      })()}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                Nenhum modulo selecionado.
              </div>
            )}

            <DialogFooter className="border-t px-4 py-3 sm:px-6">
              <Button variant="outline" onClick={() => setShowInfoDialog(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-destructive">Desinstalar modulo</DialogTitle>
            <DialogDescription>
              Esta acao remove permanentemente o modulo do sistema.
            </DialogDescription>
          </DialogHeader>

          {selectedModule && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="mb-2 text-sm font-medium text-destructive">Atencao</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>- Todos os arquivos do modulo serao removidos do sistema.</li>
                  <li>- O modulo sera desativado para todos os tenants.</li>
                  <li>- Esta acao nao pode ser desfeita.</li>
                </ul>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                <p>
                  <strong>Modulo:</strong> {selectedModule.name}
                </p>
                <p className="mt-1">
                  <strong>Slug:</strong>{" "}
                  <code className="rounded border bg-background px-1.5 py-0.5">
                    {selectedModule.slug}
                  </code>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Digite o slug <strong>{selectedModule.slug}</strong> para confirmar:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(event) => setConfirmationInput(event.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-destructive/40"
                  placeholder={`Digite ${selectedModule.slug}`}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveModule}
              disabled={selectedModule ? confirmationInput !== selectedModule.slug : true}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Confirmar desinstalacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
