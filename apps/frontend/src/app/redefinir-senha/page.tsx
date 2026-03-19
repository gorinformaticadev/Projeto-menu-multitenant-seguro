"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { PlatformName } from "@/components/PlatformInfo";
import { resetPassword } from "@/lib/contracts/auth-client";
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
        title: "Link invalido",
        description: "Token de redefinicao nao encontrado.",
      });
      setTimeout(() => router.push("/login"), 2000);
    }
  }, [token, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Senhas nao conferem",
        description: "A confirmacao da senha nao corresponde a nova senha.",
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
      const firstInvalidRequirement = passwordValidation.requirements.find(
        (requirement) => !requirement.valid,
      );
      toast({
        variant: "destructive",
        title: "Senha fora da politica",
        description:
          firstInvalidRequirement?.label ||
          "A nova senha nao atende a politica de seguranca ativa.",
      });
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword({ token, newPassword });

      setSuccess(true);
      toast({
        title: "Senha redefinida!",
        description: "Sua senha foi alterada com sucesso.",
      });

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

  if (success) {
    return (
      <div className="auth-theme flex min-h-screen items-center justify-center bg-auth-background px-4 py-12 text-auth-text">
        <Card className="w-full max-w-md border-auth-border bg-auth-surface text-auth-text shadow-xl">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-skin-success/15">
              <CheckCircle className="h-8 w-8 text-skin-success" />
            </div>
            <CardTitle className="text-2xl font-bold text-auth-text">
              Senha Alterada!
            </CardTitle>
            <CardDescription className="text-auth-text-muted">
              Sua senha foi redefinida com sucesso. Voce sera redirecionado para o login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Button
              className="w-full bg-auth-primary text-white hover:bg-auth-primary-hover"
              onClick={() => router.push("/login")}
            >
              Ir para Login agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-theme flex min-h-screen flex-col items-center justify-center bg-auth-background px-4 py-12 text-auth-text sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="mb-8 text-center">
          <PlatformName className="justify-center text-3xl mb-2 text-auth-text" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-auth-text">
            Redefinir Senha
          </h2>
          <p className="mt-2 text-sm text-auth-text-muted">
            Digite sua nova senha abaixo
          </p>
        </div>

        <Card className="border-auth-border bg-auth-surface text-auth-text shadow-xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-auth-text">Nova Senha</Label>
                  <PasswordInput
                    id="password"
                    value={newPassword}
                    onChange={(val) => setNewPassword(val)}
                    placeholder="********"
                    required
                    className="border-auth-border bg-auth-background text-auth-text placeholder:text-auth-text-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-auth-text">Confirmar Senha</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(val) => setConfirmPassword(val)}
                    placeholder="********"
                    required
                    className="border-auth-border bg-auth-background text-auth-text placeholder:text-auth-text-muted"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Button
                  type="submit"
                  className="w-full bg-auth-primary text-white hover:bg-auth-primary-hover"
                  disabled={isLoading}
                >
                  {isLoading ? "Redefinindo..." : "Definir Nova Senha"}
                </Button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="flex items-center justify-center text-sm font-medium text-auth-text-muted transition-colors hover:text-auth-text"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o Login
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-theme flex h-screen items-center justify-center bg-auth-background text-auth-text">Carregando...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
