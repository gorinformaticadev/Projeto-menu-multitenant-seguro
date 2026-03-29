"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BellRing,
  KeyRound,
  Save,
  ShieldAlert,
  Trash2,
  Send,
  FlaskConical,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ListChecks,
  Activity,
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  Monitor,
  Smartphone as PhoneIcon,
  Globe,
  Clock,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useRef } from "react";

interface WebPushConfigResponse {
  webPushPublicKey: string | null;
  webPushSubject: string;
  hasPrivateKey: boolean;
}

interface WebPushConfigForm {
  webPushPublicKey: string;
  webPushPrivateKey: string;
  webPushSubject: string;
  clearPrivateKey: boolean;
}

type TestMode = "self" | "system" | "module";
type TestSeverity = "info" | "success" | "warning" | "error";

interface TestPushForm {
  mode: TestMode;
  title: string;
  message: string;
  severity: TestSeverity;
  module: string;
  repeat: number;
  delayMs: number;
  extraDataJson: string;
}

interface TestPushResultItem {
  index: number;
  success: boolean;
  notificationId?: string;
  groupId?: string | null;
  scopeType?: string;
  scopeKey?: string;
  error?: string;
}

interface TestPushResponse {
  success: boolean;
  mode: string;
  repeatRequested: number;
  repeatSucceeded: number;
  repeatFailed: number;
  targetUserId: string;
  tenantId: string | null;
  generatedScopeSummary: string;
  results: TestPushResultItem[];
}

const DEFAULT_TEST_FORM: TestPushForm = {
  mode: "self",
  title: "Teste de Push",
  message: "Notificação de teste do painel administrativo.",
  severity: "info",
  module: "",
  repeat: 1,
  delayMs: 0,
  extraDataJson: "",
};

// --- Diagnostic Types ---

interface DeviceDiagnostic {
  https: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerState: string | null;
  notificationPermission: string;
  pushManagerAvailable: boolean;
  subscriptionExists: boolean;
  subscriptionEndpoint: string | null;
  subscriptionCreatedAt: string | null;
  userAgent: string;
}

interface BackendSubscription {
  id: string;
  endpoint: string;
  endpointFull: string;
  userAgent: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  tenantId: string | null;
}

interface DeliveryLogItem {
  notificationId: string;
  timestamp: string;
  userIds: string[];
  tag: string;
  totalSubscriptions: number;
  successCount: number;
  failCount: number;
  staleCount: number;
  details: {
    subscriptionId: string;
    endpoint: string;
    status: "success" | "fail" | "stale";
    statusCode?: number;
    error?: string;
  }[];
}

export default function PushNotificationsConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPrivateKey, setHasPrivateKey] = useState(false);
  const [form, setForm] = useState<WebPushConfigForm>({
    webPushPublicKey: "",
    webPushPrivateKey: "",
    webPushSubject: "mailto:suporte@example.com",
    clearPrivateKey: false,
  });

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      window.location.href = "/dashboard";
    }
  }, [user]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await api.get<WebPushConfigResponse>("/security-config/web-push");
        const data = response.data;

        setForm((prev) => ({
          ...prev,
          webPushPublicKey: data.webPushPublicKey || "",
          webPushSubject: data.webPushSubject || "mailto:suporte@example.com",
        }));
        setHasPrivateKey(!!data.hasPrivateKey);
      } catch (error: unknown) {
        toast({
          title: "Erro ao carregar configuração de push",
          description:
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Não foi possível buscar a configuração de Web Push.",
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

  const updateForm = (field: keyof WebPushConfigForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const webPushSubject = form.webPushSubject.trim();
    if (webPushSubject && !webPushSubject.startsWith("mailto:")) {
      toast({
        title: "Assunto inválido",
        description: 'O campo "WEB_PUSH_SUBJECT" deve iniciar com "mailto:".',
        variant: "destructive",
      });
      return;
    }

    const payload: Record<string, unknown> = {
      webPushPublicKey: form.webPushPublicKey.trim() || null,
      webPushSubject: webPushSubject || "mailto:suporte@example.com",
      clearPrivateKey: form.clearPrivateKey,
    };

    if (form.webPushPrivateKey.trim()) {
      payload.webPushPrivateKey = form.webPushPrivateKey.trim();
    }

    try {
      setSaving(true);
      const response = await api.put<WebPushConfigResponse>("/security-config/web-push", payload);
      const data = response.data;

      setHasPrivateKey(!!data.hasPrivateKey);
      setForm((prev) => ({
        ...prev,
        webPushPublicKey: data.webPushPublicKey || "",
        webPushSubject: data.webPushSubject || "mailto:suporte@example.com",
        webPushPrivateKey: "",
        clearPrivateKey: false,
      }));

      toast({
        title: "Configuração salva",
        description: "As configurações de Web Push foram atualizadas com sucesso.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao salvar",
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Não foi possível salvar a configuração de Web Push.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // --- Test Push Panel ---
  const [testForm, setTestForm] = useState<TestPushForm>({ ...DEFAULT_TEST_FORM });
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<TestPushResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const updateTestForm = <K extends keyof TestPushForm>(field: K, value: TestPushForm[K]) => {
    setTestForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateTestForm = (): string | null => {
    if (!testForm.title.trim()) return "Título é obrigatório.";
    if (!testForm.message.trim()) return "Mensagem é obrigatória.";
    if (testForm.mode === "module" && !testForm.module.trim()) return "Módulo é obrigatório no modo 'Por módulo'.";
    if (testForm.repeat < 1 || testForm.repeat > 10) return "Quantidade deve estar entre 1 e 10.";
    if (testForm.delayMs < 0 || testForm.delayMs > 2000) return "Delay deve estar entre 0 e 2000 ms.";
    if (testForm.extraDataJson.trim()) {
      try {
        JSON.parse(testForm.extraDataJson);
      } catch {
        return "Payload extra não é um JSON válido.";
      }
    }
    return null;
  };

  const handleSendTest = async () => {
    const validationError = validateTestForm();
    if (validationError) {
      setTestError(validationError);
      setTestResult(null);
      return;
    }

    setTestError(null);
    setTestResult(null);
    setTestSending(true);

    try {
      const payload: Record<string, unknown> = {
        mode: testForm.mode,
        title: testForm.title.trim(),
        message: testForm.message.trim(),
        severity: testForm.severity,
        repeat: testForm.repeat,
        delayMs: testForm.delayMs,
      };

      if (testForm.mode === "module" && testForm.module.trim()) {
        payload.module = testForm.module.trim();
      }

      if (testForm.extraDataJson.trim()) {
        payload.extraData = JSON.parse(testForm.extraDataJson);
      }

      const response = await api.post<TestPushResponse>("/notifications/test-push", payload);
      setTestResult(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setTestError(
        axiosErr?.response?.data?.message || "Falha ao enviar teste de push."
      );
    } finally {
      setTestSending(false);
    }
  };

  // --- Diagnostic Panel ---
  const [deviceStatus, setDeviceStatus] = useState<DeviceDiagnostic | null>(null);
  const [subscriptions, setSubscriptions] = useState<BackendSubscription[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryLogItem[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagAction, setDiagAction] = useState<string | null>(null);
  const swMessageRef = useRef<{ resolve: (v: unknown) => void } | null>(null);

  const collectDeviceStatus = useCallback(async (): Promise<DeviceDiagnostic> => {
    const swSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
    let swRegistered = false;
    let swState: string | null = null;
    let hasSubscription = false;
    let subEndpoint: string | null = null;
    let subCreatedAt: string | null = null;

    if (swSupported) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        swRegistered = !!reg;
        swState = reg?.active?.state || null;

        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          hasSubscription = !!sub;
          if (sub) {
            subEndpoint = sub.endpoint.length > 50
              ? `${sub.endpoint.slice(0, 25)}...${sub.endpoint.slice(-20)}`
              : sub.endpoint;
          }
        }
      } catch {
        // ignore
      }
    }

    return {
      https: typeof window !== "undefined" && window.location.protocol === "https:",
      serviceWorkerSupported: swSupported,
      serviceWorkerRegistered: swRegistered,
      serviceWorkerState: swState,
      notificationPermission:
        typeof window !== "undefined" && "Notification" in window
          ? window.Notification.permission
          : "unsupported",
      pushManagerAvailable: swSupported,
      subscriptionExists: hasSubscription,
      subscriptionEndpoint: subEndpoint,
      subscriptionCreatedAt: subCreatedAt,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    };
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    try {
      const [device, subsRes, delivRes] = await Promise.all([
        collectDeviceStatus(),
        api.get<BackendSubscription[]>("/notifications/push/subscriptions/me").then((r) => r.data).catch(() => []),
        api.get<DeliveryLogItem[]>("/notifications/push/last-deliveries").then((r) => r.data).catch(() => []),
      ]);
      setDeviceStatus(device);
      setSubscriptions(subsRes);
      setDeliveries(delivRes);
    } catch {
      // partial failure is fine
    } finally {
      setDiagLoading(false);
    }
  }, [collectDeviceStatus]);

  const handleForceRegisterSW = useCallback(async () => {
    setDiagAction("register");
    try {
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js");
        toast({ title: "Service Worker registrado com sucesso" });
      }
    } catch (err) {
      toast({ title: "Erro ao registrar SW", description: String(err), variant: "destructive" });
    } finally {
      setDiagAction(null);
      await refreshDiagnostics();
    }
  }, [toast, refreshDiagnostics]);

  const handleRecreateSubscription = useCallback(async () => {
    setDiagAction("resubscribe");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in navigator)) {
        toast({ title: "Push não suportado neste navegador", variant: "destructive" });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const oldSub = await reg.pushManager.getSubscription();
      if (oldSub) {
        try {
          const data = oldSub.toJSON() as { endpoint?: string };
          if (data?.endpoint) {
            await api.post("/notifications/push/unsubscribe", { endpoint: data.endpoint });
          }
        } catch { /* ignore */ }
        await oldSub.unsubscribe();
      }
      const pubKeyRes = await api.get("/notifications/push/public-key");
      const publicKey = pubKeyRes.data?.publicKey;
      if (!publicKey) {
        toast({ title: "Chave pública VAPID não disponível", variant: "destructive" });
        return;
      }
      const urlBase64ToArrayBuffer = (b64: string): ArrayBuffer => {
        const padding = "=".repeat((4 - (b64.length % 4)) % 4);
        const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = window.atob(base64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
        return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
      };
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });
      const toJSON = newSub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (toJSON?.endpoint && toJSON?.keys?.p256dh && toJSON?.keys?.auth) {
        await api.post("/notifications/push/subscribe", {
          endpoint: toJSON.endpoint,
          keys: { p256dh: toJSON.keys.p256dh, auth: toJSON.keys.auth },
        });
      }
      toast({ title: "Inscrição de push recriada com sucesso" });
    } catch (err) {
      toast({ title: "Erro ao recriar inscrição", description: String(err), variant: "destructive" });
    } finally {
      setDiagAction(null);
      await refreshDiagnostics();
    }
  }, [toast, refreshDiagnostics]);

  const handleLocalTestNotification = useCallback(async () => {
    setDiagAction("localtest");
    try {
      if (!("serviceWorker" in navigator)) {
        toast({ title: "Service Worker não suportado", variant: "destructive" });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) {
        toast({ title: "Service Worker não está ativo", variant: "destructive" });
        return;
      }

      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        swMessageRef.current = { resolve: resolve as (v: unknown) => void };
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          if (event.data?.type === "TEST_NOTIFICATION_RESULT") {
            resolve({ success: event.data.success, error: event.data.error });
          }
        };
        reg.active!.postMessage(
          { type: "TEST_NOTIFICATION", title: "Teste local", body: "Notificação de teste (sem push)", url: "/notifications" },
          [channel.port2],
        );
        // Timeout fallback
        setTimeout(() => resolve({ success: false, error: "Timeout" }), 5000);
      });

      if (result.success) {
        toast({ title: "Notificação local exibida com sucesso" });
      } else {
        toast({ title: "Falha na notificação local", description: result.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro no teste local", description: String(err), variant: "destructive" });
    } finally {
      setDiagAction(null);
    }
  }, [toast]);

  const handleClearAndRestart = useCallback(async () => {
    setDiagAction("clear");
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            try {
              const data = sub.toJSON() as { endpoint?: string };
              if (data?.endpoint) {
                await api.post("/notifications/push/unsubscribe", { endpoint: data.endpoint });
              }
            } catch { /* */ }
            await sub.unsubscribe();
          }
          await reg.unregister();
        }
      }
      window.location.reload();
    } catch (err) {
      toast({ title: "Erro ao limpar", description: String(err), variant: "destructive" });
      setDiagAction(null);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      void refreshDiagnostics();
    }
  }, [user, refreshDiagnostics]);

  if (user?.role !== "SUPER_ADMIN") {
    return null;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">Carregando configuração de Web Push...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BellRing className="h-6 w-6" />
              Notificações Push (PWA/Windows)
            </h1>
            <p className="mt-2 text-skin-text-muted">
              Configure as chaves VAPID para notificações em background.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>

        <Card className="border-skin-info/30 bg-skin-info/10">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <ListChecks className="mt-0.5 h-5 w-5 flex-shrink-0 text-skin-info" />
              <div className="text-sm text-skin-text">
                <p className="font-semibold mb-1">Pré-requisitos para notificações push</p>
                <p className="mb-3 text-skin-text-muted">
                  Para que as notificações push funcionem corretamente, é necessário que as configurações de
                  segurança exigidas estejam habilitadas no sistema. Também é necessário que o
                  navegador/dispositivo já esteja inscrito em push e com permissão de notificações concedida.
                </p>
                <Link
                  href="/configuracoes/seguranca"
                  className="inline-flex items-center gap-1 text-skin-info hover:underline text-sm font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ir para Configurações de Segurança
                </Link>
                <ul className="mt-3 space-y-1 text-xs text-skin-text-muted">
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-skin-text-muted" />
                    HTTPS ativo
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-skin-text-muted" />
                    Configurações de segurança habilitadas
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-skin-text-muted" />
                    Permissão de notificações concedida no navegador
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-skin-text-muted" />
                    Navegador/dispositivo inscrito em push
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-skin-text-muted" />
                    No Android, validar inscrição do dispositivo e service worker ativo
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-skin-warning/30 bg-skin-warning/10">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-skin-warning" />
              <div className="text-sm text-skin-warning">
                <p className="font-semibold mb-1">Atenção com a chave privada</p>
                <p>
                  A chave privada é sensível e fica armazenada de forma protegida no backend.
                  O valor atual nunca é exibido novamente nesta tela.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Configuração VAPID
            </CardTitle>
            <CardDescription>
              Gere as chaves com <code>npx web-push generate-vapid-keys o pnpm exec web-push generate-vapid-keys
              </code> e salve abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="webPushPublicKey">WEB_PUSH_PUBLIC_KEY</Label>
              <Textarea
                id="webPushPublicKey"
                rows={3}
                value={form.webPushPublicKey}
                onChange={(e) => updateForm("webPushPublicKey", e.target.value)}
                placeholder="BExemploDeChavePublica..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webPushPrivateKey">WEB_PUSH_PRIVATE_KEY</Label>
              <Input
                id="webPushPrivateKey"
                type="password"
                value={form.webPushPrivateKey}
                onChange={(e) => {
                  updateForm("webPushPrivateKey", e.target.value);
                  if (e.target.value.length > 0) {
                    updateForm("clearPrivateKey", false);
                  }
                }}
                placeholder={hasPrivateKey ? "Nova chave (deixe em branco para manter)" : "Informe a chave privada"}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-skin-text-muted">
                  Status atual: {hasPrivateKey ? "chave privada configurada" : "nenhuma chave privada salva"}.
                </p>
                {hasPrivateKey && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateForm("clearPrivateKey", !form.clearPrivateKey)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {form.clearPrivateKey ? "Remoção marcada" : "Remover chave"}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webPushSubject">WEB_PUSH_SUBJECT</Label>
              <Input
                id="webPushSubject"
                type="text"
                value={form.webPushSubject}
                onChange={(e) => updateForm("webPushSubject", e.target.value)}
                placeholder="mailto:suporte@example.com"
              />
              <p className="text-xs text-skin-text-muted">
                Use um e-mail de contato no formato <code>mailto:contato@dominio.com</code>.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Todas as Alterações"}
          </Button>
        </div>

        {/* ---- Test Push Panel ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Teste de Notificações Push
            </CardTitle>
            <CardDescription>
              Dispare notificações reais para validar envio push, subscription ativa e agrupamento.
              Este recurso usa o fluxo real do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-skin-border bg-skin-background-elevated p-3 text-xs text-skin-text-muted">
              Para receber o push, este navegador precisa já estar inscrito (subscription registrada) e com permissão de notificação concedida.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Modo de teste</Label>
                <select
                  className="h-9 w-full rounded-md border border-skin-input-border bg-skin-input-background px-2 text-sm text-skin-text"
                  value={testForm.mode}
                  onChange={(e) => updateTestForm("mode", e.target.value as TestMode)}
                >
                  <option value="self">Para mim</option>
                  <option value="system">Sistema (system:general)</option>
                  <option value="module">Por módulo</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Severidade</Label>
                <select
                  className="h-9 w-full rounded-md border border-skin-input-border bg-skin-input-background px-2 text-sm text-skin-text"
                  value={testForm.severity}
                  onChange={(e) => updateTestForm("severity", e.target.value as TestSeverity)}
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>

            {testForm.mode === "module" && (
              <div className="space-y-2">
                <Label htmlFor="testModule">Módulo (slug)</Label>
                <Input
                  id="testModule"
                  value={testForm.module}
                  onChange={(e) => updateTestForm("module", e.target.value)}
                  placeholder="ex: ordem_servico, financeiro"
                />
                <p className="text-xs text-skin-text-muted">
                  A notificação será agrupada em <code>module:{testForm.module || "<slug>"}</code>.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="testTitle">Título</Label>
                <Input
                  id="testTitle"
                  value={testForm.title}
                  onChange={(e) => updateTestForm("title", e.target.value)}
                  placeholder="Título da notificação"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testMessage">Mensagem</Label>
                <Input
                  id="testMessage"
                  value={testForm.message}
                  onChange={(e) => updateTestForm("message", e.target.value)}
                  placeholder="Corpo da notificação"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="testRepeat">Quantidade (1–10)</Label>
                <Input
                  id="testRepeat"
                  type="number"
                  min={1}
                  max={10}
                  value={testForm.repeat}
                  onChange={(e) => updateTestForm("repeat", Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testDelay">Delay entre envios (ms, 0–2000)</Label>
                <Input
                  id="testDelay"
                  type="number"
                  min={0}
                  max={2000}
                  value={testForm.delayMs}
                  onChange={(e) => updateTestForm("delayMs", Math.max(0, Math.min(2000, Number(e.target.value) || 0)))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testExtra">Payload extra (JSON opcional)</Label>
              <Textarea
                id="testExtra"
                rows={2}
                value={testForm.extraDataJson}
                onChange={(e) => updateTestForm("extraDataJson", e.target.value)}
                placeholder='{"key": "value"}'
              />
            </div>

            {testError && (
              <div className="rounded-lg border border-skin-danger/30 bg-skin-danger/10 p-3 text-sm text-skin-danger flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleSendTest} disabled={testSending}>
                {testSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {testSending
                  ? "Enviando..."
                  : testForm.repeat > 1
                    ? `Enviar sequência (${testForm.repeat})`
                    : "Enviar teste"}
              </Button>
            </div>

            {testResult && (
              <div className="rounded-lg border border-skin-border bg-skin-surface p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-skin-success" />
                  ) : (
                    <XCircle className="h-5 w-5 text-skin-danger" />
                  )}
                  <span className="font-medium text-sm">
                    {testResult.success ? "Teste enviado com sucesso" : "Teste falhou"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-skin-text-muted">
                  <div><span className="font-medium">Modo:</span> {testResult.mode}</div>
                  <div><span className="font-medium">Scope:</span> {testResult.generatedScopeSummary}</div>
                  <div><span className="font-medium">Solicitados:</span> {testResult.repeatRequested}</div>
                  <div><span className="font-medium">Enviados:</span> {testResult.repeatSucceeded}</div>
                  <div><span className="font-medium">Falharam:</span> {testResult.repeatFailed}</div>
                  <div><span className="font-medium">Usuário:</span> {testResult.targetUserId}</div>
                </div>

                {testResult.results.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-skin-text-muted">Detalhes por envio:</p>
                    {testResult.results.map((r) => (
                      <div
                        key={r.index}
                        className={`text-xs px-2 py-1 rounded ${
                          r.success
                            ? "bg-skin-success/10 text-skin-success"
                            : "bg-skin-danger/10 text-skin-danger"
                        }`}
                      >
                        #{r.index + 1}: {r.success ? "OK" : `Erro — ${r.error || "desconhecido"}`}
                        {r.notificationId && ` (id: ${r.notificationId.slice(0, 8)}...)`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Diagnóstico do Dispositivo ---- */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Diagnóstico de Push (Dispositivo Atual)
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshDiagnostics()}
                disabled={diagLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${diagLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
            <CardDescription>
              Verifique o status do dispositivo atual para identificar falhas de push.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deviceStatus ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: "HTTPS", ok: deviceStatus.https, desc: deviceStatus.https ? "Ativo" : "Inativo — push requer HTTPS" },
                    { label: "Service Worker suportado", ok: deviceStatus.serviceWorkerSupported, desc: deviceStatus.serviceWorkerSupported ? "Sim" : "Não" },
                    { label: "Service Worker registrado", ok: deviceStatus.serviceWorkerRegistered, desc: deviceStatus.serviceWorkerState ? `Estado: ${deviceStatus.serviceWorkerState}` : "Não registrado" },
                    { label: "Permissão de notificação", ok: deviceStatus.notificationPermission === "granted", desc: deviceStatus.notificationPermission },
                    { label: "PushManager disponível", ok: deviceStatus.pushManagerAvailable, desc: deviceStatus.pushManagerAvailable ? "Sim" : "Não" },
                    { label: "Subscription ativa", ok: deviceStatus.subscriptionExists, desc: deviceStatus.subscriptionEndpoint || "Nenhuma subscription encontrada" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                        item.ok
                          ? "border-skin-success/30 bg-skin-success/5"
                          : "border-skin-danger/30 bg-skin-danger/5"
                      }`}
                    >
                      {item.ok ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-skin-success flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 mt-0.5 text-skin-danger flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-skin-text-muted">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-skin-border bg-skin-background-elevated p-3 text-xs text-skin-text-muted">
                  <span className="font-medium">User-Agent:</span>{" "}
                  <code className="break-all">{deviceStatus.userAgent}</code>
                </div>
              </>
            ) : (
              <p className="text-sm text-skin-text-muted">Carregando diagnóstico...</p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => void handleForceRegisterSW()} disabled={!!diagAction}>
                <Wrench className="h-3.5 w-3.5 mr-1" />
                Forçar registro do SW
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleRecreateSubscription()} disabled={!!diagAction}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${diagAction === "resubscribe" ? "animate-spin" : ""}`} />
                Recriar inscrição de push
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleLocalTestNotification()} disabled={!!diagAction}>
                <BellRing className="h-3.5 w-3.5 mr-1" />
                Testar exibição local
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleClearAndRestart()} disabled={!!diagAction}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpar e reiniciar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ---- Subscriptions do Usuário ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Subscriptions Registradas ({subscriptions.length})
            </CardTitle>
            <CardDescription>
              Dispositivos inscritos em push para este usuário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <div className="rounded-lg border border-skin-warning/30 bg-skin-warning/10 p-4 text-sm text-skin-warning flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Nenhuma subscription encontrada. Este dispositivo pode não estar inscrito em push.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {subscriptions.map((sub) => {
                  const isAndroid = (sub.userAgent || "").toLowerCase().includes("android");
                  const isMobile = isAndroid || (sub.userAgent || "").toLowerCase().includes("mobile");
                  return (
                    <div key={sub.id} className="rounded-lg border border-skin-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isMobile ? (
                            <PhoneIcon className="h-4 w-4 text-skin-text-muted" />
                          ) : (
                            <Monitor className="h-4 w-4 text-skin-text-muted" />
                          )}
                          <span className="font-mono text-xs">{sub.endpoint}</span>
                        </div>
                        <span className="text-xs text-skin-success flex items-center gap-1">
                          <Wifi className="h-3 w-3" /> Ativo
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-skin-text-muted">
                        <span>UA: {(sub.userAgent || "—").slice(0, 80)}</span>
                        {sub.createdAt && <span>Criado: {new Date(sub.createdAt).toLocaleString()}</span>}
                        {sub.lastUsedAt && <span>Último uso: {new Date(sub.lastUsedAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Últimos Envios de Push ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Últimos Envios de Push
            </CardTitle>
            <CardDescription>
              Histórico dos envios mais recentes (em memória, reiniciado ao reiniciar o servidor).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deliveries.length === 0 ? (
              <p className="text-sm text-skin-text-muted">Nenhum envio de push registrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {deliveries.slice(0, 10).map((d, i) => (
                  <div key={`${d.notificationId}-${i}`} className="rounded-lg border border-skin-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-skin-text-muted" />
                        <span className="font-mono text-xs">{d.notificationId.slice(0, 12)}...</span>
                        <span className="text-xs text-skin-text-muted">({d.tag})</span>
                      </div>
                      <span className="text-xs text-skin-text-muted">
                        {new Date(d.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span className="text-skin-text-muted">Total: {d.totalSubscriptions}</span>
                      <span className="text-skin-success">OK: {d.successCount}</span>
                      {d.failCount > 0 && <span className="text-skin-danger">Falha: {d.failCount}</span>}
                      {d.staleCount > 0 && <span className="text-skin-warning">Stale: {d.staleCount}</span>}
                    </div>
                    {d.details.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {d.details.map((det, j) => (
                          <div
                            key={`${det.subscriptionId}-${j}`}
                            className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                              det.status === "success"
                                ? "bg-skin-success/10 text-skin-success"
                                : det.status === "stale"
                                  ? "bg-skin-warning/10 text-skin-warning"
                                  : "bg-skin-danger/10 text-skin-danger"
                            }`}
                          >
                            {det.status === "success" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : det.status === "stale" ? (
                              <WifiOff className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            <span className="font-mono">{det.endpoint}</span>
                            {det.statusCode && <span>({det.statusCode})</span>}
                            {det.error && <span>— {det.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
