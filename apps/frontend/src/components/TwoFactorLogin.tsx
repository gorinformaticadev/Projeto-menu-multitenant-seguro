"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft } from "lucide-react";

interface TwoFactorLoginProps {
  email: string;
  password: string;
  onSubmit: (code: string) => Promise<void>;
  onBack: () => void;
  loading: boolean;
}

export function TwoFactorLogin({
  email: _email,
  password: _password,
  onSubmit,
  onBack,
  loading,
}: TwoFactorLoginProps) {
  const [code, setCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length === 6) {
      await onSubmit(code);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Autenticação de Dois Fatores
        </CardTitle>
        <CardDescription>
          Digite o código de 6 dígitos do seu aplicativo autenticador
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="2fa-code">Código de Verificação</Label>
            <Input
              id="2fa-code"
              type="text"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-widest"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground text-center">
              Abra o Google Authenticator e digite o código
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={loading}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex-1"
            >
              {loading ? "Verificando..." : "Entrar"}
            </Button>
          </div>

          <div className="text-xs text-center text-muted-foreground">
            <p>Não tem acesso ao seu aplicativo?</p>
            <p>Entre em contato com o administrador</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
