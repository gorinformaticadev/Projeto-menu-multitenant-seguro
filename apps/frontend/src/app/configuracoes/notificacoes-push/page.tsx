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
} from "lucide-react";

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
      </div>
    </ProtectedRoute>
  );
}
