"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSecurityConfig } from "@/contexts/SecurityConfigContext";
import api from "@/lib/api";
import { Shield, QrCode, Lock, Unlock, AlertCircle } from "lucide-react";
import Image from "next/image";

interface TwoFactorSetupProps {
  isEnabled: boolean;
  onStatusChange: (enabled: boolean) => Promise<void> | void;
  mode?: "settings" | "enrollment";
}

export function TwoFactorSetup({
  isEnabled,
  onStatusChange,
  mode = "settings",
}: TwoFactorSetupProps) {
  const { toast } = useToast();
  const { config: securityConfig, loading: loadingConfig } = useSecurityConfig();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);

  const twoFactorGloballyEnabled = securityConfig?.twoFactorEnabled ?? false;
  const isEnrollmentMode = mode === "enrollment";
  const generateEndpoint = isEnrollmentMode ? "/auth/2fa/enrollment/generate" : "/auth/2fa/generate";
  const enableEndpoint = isEnrollmentMode ? "/auth/2fa/enrollment/enable" : "/auth/2fa/enable";

  const resolveErrorMessage = (error: unknown, fallback: string) => {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      error.response &&
      typeof error.response === "object" &&
      "data" in error.response &&
      error.response.data &&
      typeof error.response.data === "object" &&
      "message" in error.response.data
    ) {
      const errorData = error.response.data as { message?: string };
      if (typeof errorData.message === "string" && errorData.message.trim()) {
        return errorData.message;
      }
    }

    return fallback;
  };

  async function handleGenerate() {
    try {
      setLoading(true);
      const response = await api.get(generateEndpoint);
      setQrCode(response.data.qrCode);
      setSecret(response.data.secret);
      setShowSetup(true);
    } catch (error: unknown) {
      toast({
        title: "Erro ao gerar QR Code",
        description: resolveErrorMessage(error, "Erro desconhecido"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable() {
    if (verificationCode.length !== 6) {
      toast({
        title: "Codigo invalido",
        description: "O codigo deve ter 6 digitos",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await api.post(enableEndpoint, {
        token: verificationCode,
        ...(isEnrollmentMode ? { trustDevice } : {}),
      });

      toast({
        title: isEnrollmentMode ? "2FA configurado!" : "2FA ativado!",
        description: isEnrollmentMode
          ? "Cadastro do segundo fator concluido com sucesso"
          : "Autenticacao de dois fatores ativada com sucesso",
      });

      setShowSetup(false);
      setQrCode(null);
      setSecret(null);
      setVerificationCode("");
      setTrustDevice(false);

      try {
        await onStatusChange(true);
      } catch {
        // noop
      }
    } catch (error: unknown) {
      toast({
        title: isEnrollmentMode ? "Erro ao concluir 2FA" : "Erro ao ativar 2FA",
        description: resolveErrorMessage(
          error,
          isEnrollmentMode
            ? "Nao foi possivel concluir o cadastro do 2FA"
            : "Codigo invalido",
        ),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (verificationCode.length !== 6) {
      toast({
        title: "Codigo invalido",
        description: "O codigo deve ter 6 digitos",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Tem certeza que deseja desativar a autenticacao de dois fatores?")) {
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/2fa/disable", { token: verificationCode });
      toast({
        title: "2FA desativado",
        description: "Autenticacao de dois fatores desativada",
      });
      setVerificationCode("");
      try {
        await onStatusChange(false);
      } catch {
        // noop
      }
    } catch (error: unknown) {
      toast({
        title: "Erro ao desativar 2FA",
        description: resolveErrorMessage(error, "Codigo invalido"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (loadingConfig) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {isEnrollmentMode ? "Configurar Autenticacao de Dois Fatores" : "Autenticacao de Dois Fatores (2FA)"}
        </CardTitle>
        <CardDescription>
          {isEnrollmentMode
            ? "Sua conta exige 2FA. Conclua a configuracao para finalizar o login."
            : "Adicione uma camada extra de seguranca a sua conta"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!twoFactorGloballyEnabled && !isEnrollmentMode && (
          <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">2FA Desabilitado pelo Administrador</p>
              <p>
                A autenticacao de dois fatores esta temporariamente desabilitada nas configuracoes do sistema.
              </p>
            </div>
          </div>
        )}

        {!isEnrollmentMode && (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              {isEnabled ? (
                <Lock className="h-5 w-5 text-green-600" />
              ) : (
                <Unlock className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium">{isEnabled ? "2FA Ativado" : "2FA Desativado"}</p>
                <p className="text-sm text-muted-foreground">
                  {isEnabled
                    ? "Sua conta esta protegida com 2FA"
                    : twoFactorGloballyEnabled
                      ? "Ative o 2FA para maior seguranca"
                      : "2FA desabilitado pelo administrador"}
                </p>
              </div>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                isEnabled
                  ? "bg-green-100 text-green-800"
                  : twoFactorGloballyEnabled
                    ? "bg-gray-100 text-gray-800"
                    : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {isEnabled ? "Ativo" : twoFactorGloballyEnabled ? "Inativo" : "Bloqueado"}
            </div>
          </div>
        )}

        {(twoFactorGloballyEnabled || isEnrollmentMode) ? (
          <>
            {!isEnabled && !showSetup && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Como funciona?</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Clique em {isEnrollmentMode ? "&quot;Iniciar configuracao&quot;" : "&quot;Ativar 2FA&quot;"}</li>
                      <li>Escaneie o QR Code com Google Authenticator</li>
                      <li>Digite o codigo de 6 digitos para confirmar</li>
                      <li>Pronto! Sua conta estara mais segura</li>
                    </ol>
                  </div>
                </div>
                <Button onClick={handleGenerate} disabled={loading} className="w-full">
                  <QrCode className="h-4 w-4 mr-2" />
                  {loading
                    ? "Gerando..."
                    : isEnrollmentMode
                      ? "Iniciar configuracao"
                      : "Ativar 2FA"}
                </Button>
              </div>
            )}

            {!isEnabled && showSetup && qrCode && (
              <div className="space-y-4">
                <div className="text-center space-y-4">
                  <p className="text-sm font-medium">
                    1. Escaneie este QR Code no Google Authenticator
                  </p>
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-lg border">
                      <Image src={qrCode} alt="QR Code 2FA" width={200} height={200} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Ou digite manualmente o codigo:</p>
                    <code className="bg-muted px-2 py-1 rounded">{secret}</code>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">2. Digite o codigo de 6 digitos</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>

                {isEnrollmentMode && (
                  <div className="flex items-center gap-2 rounded-md border p-3">
                    <Checkbox
                      id="trust-device-enrollment"
                      checked={trustDevice}
                      onCheckedChange={(checked) => setTrustDevice(checked === true)}
                      disabled={loading}
                    />
                    <Label htmlFor="trust-device-enrollment" className="cursor-pointer text-sm">
                      Confiar neste dispositivo por 30 dias
                    </Label>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSetup(false);
                      setQrCode(null);
                      setSecret(null);
                      setVerificationCode("");
                      setTrustDevice(false);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleEnable}
                    disabled={loading || verificationCode.length !== 6}
                    className="flex-1"
                  >
                    {loading
                      ? isEnrollmentMode
                        ? "Concluindo..."
                        : "Ativando..."
                      : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}

            {isEnabled && !isEnrollmentMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="disable-code">Digite o codigo do seu app para desativar</Label>
                  <Input
                    id="disable-code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDisable}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full"
                >
                  {loading ? "Desativando..." : "Desativar 2FA"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              A funcionalidade de 2FA esta desabilitada pelo administrador do sistema.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
