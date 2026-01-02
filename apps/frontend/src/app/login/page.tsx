"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TwoFactorLogin } from "@/components/TwoFactorLogin";
import { use2FALogin } from "@/hooks/use2FALogin";
import { PlatformName } from "@/components/PlatformInfo";
import { Building2 } from "lucide-react";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [masterLogo, setMasterLogo] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();
  const {
    requires2FA,
    loading,
    error,
    attemptLogin,
    loginWith2FA,
    reset,
    credentials,
  } = use2FALogin();

  useEffect(() => {
    // Busca o logo da tenant padrão (endpoint público)
    async function fetchMasterLogo() {
      try {
        const response = await fetch(`${API_URL}/tenants/public/master-logo`);
        if (response.ok) {
          const data = await response.json();
          if (data.logoUrl) {
            setMasterLogo(data.logoUrl);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar logo:", error);
      }
    }
    fetchMasterLogo();

    // Carrega credenciais salvas se existirem
    const savedCredentials = localStorage.getItem("loginCredentials");
    if (savedCredentials) {
      try {
        const { email: savedEmail, password: savedPassword, rememberMe: savedRememberMe } = JSON.parse(savedCredentials);
        if (savedRememberMe) {
          setEmail(savedEmail || "");
          setPassword(savedPassword || "");
          setRememberMe(true);
        }
      } catch (error) {
        console.error("Erro ao carregar credenciais salvas:", error);
        localStorage.removeItem("loginCredentials");
      }
    }
  }, []);

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro no login",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    // Salva ou remove credenciais baseado no checkbox
    if (rememberMe) {
      localStorage.setItem("loginCredentials", JSON.stringify({
        email,
        password,
        rememberMe: true
      }));
    } else {
      localStorage.removeItem("loginCredentials");
    }

    await attemptLogin(email, password);
    // Não é necessário toast de sucesso - AuthContext redireciona automaticamente
  }

  async function handle2FASubmit(code: string) {
    await loginWith2FA(code);
    // Não é necessário toast de sucesso - AuthContext redireciona automaticamente
  }

  function handleBack() {
    reset();
    setEmail("");
    setPassword("");
    setRememberMe(false);
  }

  // Se requer 2FA, mostrar componente de 2FA
  if (requires2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <TwoFactorLogin
          email={credentials.email}
          password={credentials.password}
          onSubmit={handle2FASubmit}
          onBack={handleBack}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 gap-2">
      <Card className="w-full max-w-[340px] shadow-neu-flat border border-gray-200 bg-background/80 backdrop-blur-[2px] rounded-2xl">
        <CardHeader className="space-y-1">
          <div className="flex flex-col items-center justify-center mb-4 space-y-3">
            {/* Logo do Tenant - Exibido quando disponível */}
            {masterLogo && (
              <div className="w-32 h-20 flex items-center justify-center">
                <img
                  src={`${API_URL}/uploads/logos/${masterLogo}`}
                  alt="Logo do Tenant"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.fallback-tenant-icon');
                    if (fallback) {
                      fallback.classList.remove('hidden');
                    }
                  }}
                />
                <div className="bg-blue-100 rounded-lg w-16 h-16 flex items-center justify-center fallback-tenant-icon hidden">
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            )}
          </div>
          <CardTitle className="text-xl text-center font-bold text-primary"><PlatformName /></CardTitle>
          <CardDescription className="text-center text-xs">
            Acesse sua conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="shadow-neu-pressed border-none bg-muted/30 h-10 text-sm placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="shadow-neu-pressed border-none bg-muted/30 h-10 text-sm placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                disabled={loading}
              />
              <Label
                htmlFor="rememberMe"
                className="text-sm font-normal cursor-pointer"
              >
                Lembrar meus dados de acesso
              </Label>
            </div>
            <Button
              type="submit"
              className="w-full shadow-neu-sm hover:shadow-neu-flat active:shadow-neu-pressed transition-all duration-300 hover:-translate-y-0.5 rounded-lg h-10 text-sm font-semibold"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <a
              href="/esqueci-senha"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Esqueci minha senha
            </a>
          </div>

        </CardContent>
      </Card>

      {/* Footer Info Card */}
      <Card className="w-full max-w-[340px] shadow-neu-flat border border-gray-200 bg-background/80 backdrop-blur-[2px] rounded-2xl py-1">
        <CardContent className="flex flex-col items-center justify-center p-2 gap-1">
          <p className="text-[10px] text-muted-foreground font-medium">
            Desenvolvido por <span className="text-primary font-bold">GOR Informática</span> © {currentYear}
          </p>

          <a
            href="https://wa.me/556133597358"
            target="_blank"
            rel="noopener noreferrer"
            className="
              flex items-center gap-2 px-4 py-1 rounded-full 
              bg-background text-green-600 border border-green-100
              shadow-neu-sm hover:shadow-neu-flat active:shadow-neu-pressed
              transition-all duration-300 hover:-translate-y-0.5
              text-xs font-semibold
            "
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
            </svg>
            Suporte WhatsApp
          </a>
        </CardContent>
      </Card>
    </div >
  );
}
