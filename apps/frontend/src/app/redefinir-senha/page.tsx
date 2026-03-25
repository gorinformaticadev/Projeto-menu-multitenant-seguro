"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/api";
import { useSecurityConfig } from "@/contexts/SecurityConfigContext";
import { validatePasswordWithPolicy } from "@/hooks/usePasswordValidation";

export const dynamic = "force-dynamic";

function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { config } = useSecurityConfig();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Link inválido",
        description: "Token de redefinição não encontrado.",
      });
      setTimeout(() => router.push("/login"), 2000);
    }
  }, [token, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Senhas não conferem",
        description: "A confirmação da senha não corresponde à nova senha.",
      });
      return;
    }

    const passwordPolicy = config?.passwordPolicy ?? {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecial: true,
    };
    const passwordValidation = validatePasswordWithPolicy(newPassword, passwordPolicy);

    if (!passwordValidation.isValid) {
      const firstInvalid = passwordValidation.requirements.find((r) => !r.valid);
      toast({
        variant: "destructive",
        title: "Senha fora da política",
        description: firstInvalid?.label || "A nova senha não atende à política de segurança ativa.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao redefinir senha.");
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: (error as { message?: string })?.message || "Tente novamente mais tarde.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="auth-theme auth-page relative flex min-h-screen flex-col items-center justify-center gap-3 overflow-hidden p-4 font-sans text-[var(--auth-text)] selection:bg-[color:var(--auth-primary-selection)]">
      <div className="auth-blob-primary absolute -left-10 top-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px] animate-pulse" />
      <div className="auth-blob-secondary absolute -right-10 bottom-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px] animate-pulse delay-700" />
      {children}
    </div>
  );

  if (success) {
    return (
      <Wrapper>
        <div className="auth-card relative z-10 w-full max-w-[380px] rounded-3xl p-8 backdrop-blur-xl transition-all duration-500">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--auth-primary)]/15">
              <CheckCircle2 className="h-8 w-8 text-[var(--auth-primary)]" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-[var(--auth-text)]">Senha alterada!</h1>
              <p className="text-sm text-[var(--auth-text-muted)] leading-relaxed">
                Sua senha foi redefinida com sucesso. Você será redirecionado para o login em instantes.
              </p>
            </div>
            <Button
              className="auth-button mt-2 h-12 w-full rounded-xl font-bold tracking-wide"
              onClick={() => router.push("/login")}
            >
              IR PARA O LOGIN
            </Button>
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="auth-card relative z-10 w-full max-w-[380px] rounded-3xl p-8 backdrop-blur-xl transition-all duration-500">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="auth-shell rounded-full p-4 backdrop-blur-md">
            <KeyRound className="h-8 w-8 text-[var(--auth-text-muted)]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--auth-text)] drop-shadow-md">
              Redefinir Senha
            </h1>
            <p className="text-sm text-[var(--auth-text-muted)]">
              Digite e confirme sua nova senha abaixo
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="ml-2 text-xs font-bold uppercase tracking-wider text-[var(--auth-text-muted)]"
              >
                Nova Senha
              </Label>
              <PasswordInput
                id="password"
                value={newPassword}
                onChange={(val) => setNewPassword(val)}
                placeholder="••••••••"
                required
                className="auth-field h-10 rounded-xl px-4 !text-[var(--auth-input-text)] placeholder:!text-[var(--auth-input-placeholder)] transition-all focus-visible:ring-1 focus-visible:ring-[color:var(--auth-primary-soft)]"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="ml-2 text-xs font-bold uppercase tracking-wider text-[var(--auth-text-muted)]"
              >
                Confirmar Senha
              </Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(val) => setConfirmPassword(val)}
                placeholder="••••••••"
                required
                className="auth-field h-10 rounded-xl px-4 !text-[var(--auth-input-text)] placeholder:!text-[var(--auth-input-placeholder)] transition-all focus-visible:ring-1 focus-visible:ring-[color:var(--auth-primary-soft)]"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="auth-button h-12 w-full rounded-xl font-bold tracking-wide backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            disabled={isLoading}
          >
            {isLoading ? "REDEFININDO..." : "DEFINIR NOVA SENHA"}
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
    </Wrapper>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-theme auth-page flex h-screen items-center justify-center text-[var(--auth-text-muted)]">
          Carregando...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
