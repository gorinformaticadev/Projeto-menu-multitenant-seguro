"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSecurityConfig } from "@/contexts/SecurityConfigContext";
import api from "@/lib/api";
import { Shield, QrCode, Lock, Unlock, AlertCircle } from "lucide-react";
import Image from "next/image";

interface TwoFactorSetupProps {
  isEnabled: boolean;
  onStatusChange: () => void;
}

export function TwoFactorSetup({ isEnabled, onStatusChange }: TwoFactorSetupProps) {
  const { toast } = useToast();
  const { config: securityConfig, loading: loadingConfig } = useSecurityConfig();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const twoFactorGloballyEnabled = securityConfig?.twoFactorEnabled ?? false;

  async function handleGenerate() {
    try {
      setLoading(true);
      const response = await api.get("/auth/2fa/generate");
      setQrCode(response.data.qrCode);
      setSecret(response.data.secret);
      setShowSetup(true);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar QR Code",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable() {
    if (verificationCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "O código deve ter 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/2fa/enable", { token: verificationCode });
      toast({
        title: "2FA ativado!",
        description: "Autenticação de dois fatores ativada com sucesso",
      });
      setShowSetup(false);
      setQrCode(null);
      setSecret(null);
      setVerificationCode("");
      onStatusChange();
    } catch (error: any) {
      toast({
        title: "Erro ao ativar 2FA",
        description: error.response?.data?.message || "Código inválido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (verificationCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "O código deve ter 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Tem certeza que deseja desativar a autenticação de dois fatores?")) {
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/2fa/disable", { token: verificationCode });
      toast({
        title: "2FA desativado",
        description: "Autenticação de dois fatores desativada",
      });
      setVerificationCode("");
      onStatusChange();
    } catch (error: any) {
      toast({
        title: "Erro ao desativar 2FA",
        description: error.response?.data?.message || "Código inválido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Não exibir se ainda carregando
  if (loadingConfig) {
    return null; // Ou um skeleton loader
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Autenticação de Dois Fatores (2FA)
        </CardTitle>
        <CardDescription>
          Adicione uma camada extra de segurança à sua conta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aviso se 2FA estiver desabilitado globalmente */}
        {!twoFactorGloballyEnabled && (
          <div className="flex items-start gap-2 rounded-lg border border-skin-warning/30 bg-skin-warning/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-skin-warning" />
            <div className="text-sm text-skin-warning">
              <p className="font-medium mb-1">2FA Desabilitado pelo Administrador</p>
              <p>A autenticação de dois fatores está temporariamente desabilitada nas configurações do sistema. Entre em contato com o administrador para habilitar esta funcionalidade.</p>
            </div>
          </div>
        )}
        {/* Status */}
        <div className="flex items-center justify-between rounded-lg bg-skin-background-elevated p-4">
          <div className="flex items-center gap-3">
            {isEnabled ? (
              <Lock className="h-5 w-5 text-skin-success" />
            ) : (
              <Unlock className="h-5 w-5 text-skin-text-muted" />
            )}
            <div>
              <p className="font-medium">
                {isEnabled ? "2FA Ativado" : "2FA Desativado"}
              </p>
              <p className="text-sm text-skin-text-muted">
                {isEnabled
                  ? "Sua conta está protegida com 2FA"
                  : twoFactorGloballyEnabled
                  ? "Ative o 2FA para maior segurança"
                  : "2FA desabilitado pelo administrador"}
              </p>
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isEnabled
                ? "bg-skin-success/15 text-skin-success"
                : twoFactorGloballyEnabled
                ? "bg-skin-background-elevated text-skin-text-muted"
                : "bg-skin-warning/15 text-skin-warning"
            }`}
          >
            {isEnabled ? "Ativo" : twoFactorGloballyEnabled ? "Inativo" : "Bloqueado"}
          </div>
        </div>

        {/* Conteúdo apenas se 2FA estiver habilitado globalmente */}
        {twoFactorGloballyEnabled ? (
          <>
            {/* Ativar 2FA */}
            {!isEnabled && !showSetup && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-skin-info/30 bg-skin-info/10 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-skin-info" />
                  <div className="text-sm text-skin-info">
                    <p className="font-medium mb-1">Como funciona?</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Clique em &quot;Ativar 2FA&quot;</li>
                      <li>Escaneie o QR Code com Google Authenticator</li>
                      <li>Digite o código de 6 dígitos para confirmar</li>
                      <li>Pronto! Sua conta está mais segura</li>
                    </ol>
                  </div>
                </div>
                <Button onClick={handleGenerate} disabled={loading} className="w-full">
                  <QrCode className="h-4 w-4 mr-2" />
                  {loading ? "Gerando..." : "Ativar 2FA"}
                </Button>
              </div>
            )}

            {/* Setup do 2FA */}
            {!isEnabled && showSetup && qrCode && (
              <div className="space-y-4">
                <div className="text-center space-y-4">
                  <p className="text-sm font-medium">
                    1. Escaneie este QR Code no Google Authenticator
                  </p>
                  <div className="flex justify-center">
                    <div className="rounded-lg border border-skin-border bg-skin-surface p-4">
                      <Image
                        src={qrCode}
                        alt="QR Code 2FA"
                        width={200}
                        height={200}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-skin-text-muted">
                    <p>Ou digite manualmente o código:</p>
                    <code className="rounded bg-skin-background-elevated px-2 py-1 text-skin-text">{secret}</code>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">2. Digite o código de 6 dígitos</Label>
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

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSetup(false);
                      setQrCode(null);
                      setSecret(null);
                      setVerificationCode("");
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
                    {loading ? "Ativando..." : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}

            {/* Desativar 2FA */}
            {isEnabled && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="disable-code">
                    Digite o código do seu app para desativar
                  </Label>
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
            <p className="text-sm text-skin-text-muted">
              A funcionalidade de 2FA está desabilitada pelo administrador do sistema.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
