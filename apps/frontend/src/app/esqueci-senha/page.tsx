"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { requestPasswordReset } from "@/lib/contracts/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Erro",
        description: "Digite seu email",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const data = await requestPasswordReset({ email });
      setEmailSent(true);
      toast({
        title: "Email enviado",
        description: data.message,
      });
    } catch {
      toast({
        title: "Erro",
        description: "Erro de conexao. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="auth-theme flex min-h-screen items-center justify-center bg-auth-background p-4 text-auth-text">
        <Card className="w-full max-w-md border-auth-border bg-auth-surface text-auth-text shadow-xl">
          <CardHeader className="space-y-1">
            <div className="mb-4 flex flex-col items-center justify-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-skin-success/15">
                <Mail className="h-8 w-8 text-skin-success" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl text-auth-text">Email Enviado!</CardTitle>
            <CardDescription className="text-center text-auth-text-muted">
              Verifique sua caixa de entrada e siga as instrucoes para redefinir sua senha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-auth-border bg-auth-background/60 p-4">
              <p className="text-sm text-auth-text">
                <strong>Nao recebeu o email?</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-auth-text-muted">
                <li>- Verifique sua pasta de spam</li>
                <li>- Aguarde alguns minutos</li>
                <li>- Certifique-se de que digitou o email correto</li>
              </ul>
            </div>

            <div className="flex flex-col space-y-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
                className="w-full border-auth-border bg-auth-surface text-auth-text hover:bg-auth-background"
              >
                Tentar outro email
              </Button>

              <Link href="/login">
                <Button variant="ghost" className="w-full text-auth-text hover:bg-auth-background">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-theme flex min-h-screen items-center justify-center bg-auth-background p-4 text-auth-text">
      <Card className="w-full max-w-md border-auth-border bg-auth-surface text-auth-text shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl text-auth-text">Esqueci minha senha</CardTitle>
          <CardDescription className="text-center text-auth-text-muted">
            Digite seu email para receber as instrucoes de recuperacao
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-auth-text">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
                className="border-auth-border bg-auth-background text-auth-text placeholder:text-auth-text-muted"
              />
            </div>

            <Button type="submit" className="w-full bg-auth-primary text-white hover:bg-auth-primary-hover" disabled={loading}>
              {loading ? "Enviando..." : "Enviar instrucoes"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-auth-text hover:bg-auth-background">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
