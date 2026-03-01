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
import { BellRing, KeyRound, Save, ShieldAlert, Trash2 } from "lucide-react";

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
            <p className="text-muted-foreground mt-2">
              Configure as chaves VAPID para notificações em background.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <ShieldAlert className="h-5 w-5 text-yellow-700 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-900">
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
              Gere as chaves com <code>npx web-push generate-vapid-keys</code> e salve abaixo.
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
                <p className="text-xs text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
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
      </div>
    </ProtectedRoute>
  );
}
