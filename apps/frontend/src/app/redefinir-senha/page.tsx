"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PlatformName } from "@/components/PlatformInfo";
import { PasswordInput } from "@/components/ui/password-input";
import { ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      toast({
        title: "Token inválido",
        description: "Link de recuperação inválido ou expirado",
        variant: "destructive",
      });
      router.push("/login");
      return;
    }
    setToken(tokenParam);
  }, [searchParams, router, toast]);



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!token) {
      toast({
        title: "Erro",
        description: "Token inválido",
        variant: "destructive",
      });
      return;
    }

    if (!newPassword || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (!isPasswordValid) {
      toast({
        title: "Erro",
        description: "A senha não atende aos requisitos de segurança",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        toast({
          title: "Sucesso",
          description: data.message,
        });
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro ao redefinir senha",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex flex-col items-center justify-center mb-4 space-y-3">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Senha Redefinida!</CardTitle>
            <CardDescription className="text-center">
              Sua senha foi alterada com sucesso. Agora você pode fazer login com sua nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">
                Fazer Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Redefinir Senha</CardTitle>
          <CardDescription className="text-center">
            Digite sua nova senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput
              id="newPassword"
              label="Nova Senha"
              value={newPassword}
              onChange={(value, isValid) => {
                setNewPassword(value);
                setIsPasswordValid(isValid);
              }}
              showValidation={true}
              showStrengthMeter={true}
              showConfirmation={true}
              confirmPassword={confirmPassword}
              onConfirmChange={(value, matches) => {
                setConfirmPassword(value);
                setPasswordsMatch(matches);
              }}
              placeholder="Digite sua nova senha"
              disabled={loading}
            />
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !isPasswordValid || !passwordsMatch}
            >
              {loading ? "Redefinindo..." : "Redefinir Senha"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}