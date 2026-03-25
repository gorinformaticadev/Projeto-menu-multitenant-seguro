"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Campo obrigatório",
        description: "Digite seu endereço de email.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailSent(true);
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro ao enviar email de recuperação.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="auth-theme auth-page relative flex min-h-screen flex-col items-center justify-center gap-3 overflow-hidden p-4 font-sans text-[var(--auth-text)] selection:bg-[color:var(--auth-primary-selection)]">
        <div className="auth-blob-primary absolute -left-10 top-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px] animate-pulse" />
        <div className="auth-blob-secondary absolute -right-10 bottom-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px] animate-pulse delay-700" />

        <div className="auth-card relative z-10 w-full max-w-[380px] rounded-3xl p-8 backdrop-blur-xl transition-all duration-500">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--auth-primary)]/15">
              <CheckCircle2 className="h-8 w-8 text-[var(--auth-primary)]" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--auth-text)]">Email enviado!</h1>
            <p className="text-sm text-[var(--auth-text-muted)] leading-relaxed">
              Se o endereço <strong className="text-[var(--auth-text)]">{email}</strong> estiver cadastrado, você receberá as instruções em instantes.
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-[var(--auth-border)] bg-[var(--auth-background)]/60 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--auth-text-muted)]">Não recebeu?</p>
            <ul className="space-y-1 text-sm text-[var(--auth-text-muted)]">
              <li>• Verifique a pasta de spam ou lixo eletrônico</li>
              <li>• Aguarde alguns minutos</li>
              <li>• Confirme se digitou o email correto</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => { setEmailSent(false); setEmail(""); }}
              className="w-full border-[var(--auth-border)] bg-[var(--auth-surface)] text-[var(--auth-text)] hover:bg-[var(--auth-background)]"
            >
              Tentar outro email
            </Button>
            <Link href="/login" className="w-full">
              <Button variant="ghost" className="w-full text-[var(--auth-text-muted)] hover:bg-[var(--auth-background)] hover:text-[var(--auth-text)]">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-theme auth-page relative flex min-h-screen flex-col items-center justify-center gap-3 overflow-hidden p-4 font-sans text-[var(--auth-text)] selection:bg-[color:var(--auth-primary-selection)]">
      <div className="auth-blob-primary absolute -left-10 top-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px] animate-pulse" />
      <div className="auth-blob-secondary absolute -right-10 bottom-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px] animate-pulse delay-700" />

      <div className="auth-card relative z-10 w-full max-w-[380px] rounded-3xl p-8 backdrop-blur-xl transition-all duration-500">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="auth-shell rounded-full p-4 backdrop-blur-md">
            <Mail className="h-8 w-8 text-[var(--auth-text-muted)]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--auth-text)] drop-shadow-md">
              Recuperar Senha
            </h1>
            <p className="text-sm text-[var(--auth-text-muted)]">
              Informe seu email para receber o link de redefinição
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="ml-2 text-xs font-bold uppercase tracking-wider text-[var(--auth-text-muted)]"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="email"
              className="auth-field h-10 rounded-xl px-4 !text-[var(--auth-input-text)] placeholder:!text-[var(--auth-input-placeholder)] transition-all focus-visible:ring-1 focus-visible:ring-[color:var(--auth-primary-soft)]"
            />
          </div>

          <Button
            type="submit"
            className="auth-button h-12 w-full rounded-xl font-bold tracking-wide backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            disabled={loading}
          >
            {loading ? "ENVIANDO..." : "ENVIAR INSTRUÇÕES"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--auth-text-muted)] hover:bg-[var(--auth-background)] hover:text-[var(--auth-text)]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
