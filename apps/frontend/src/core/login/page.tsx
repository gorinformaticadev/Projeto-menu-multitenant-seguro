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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex flex-col items-center justify-center mb-4 space-y-3">
            {/* Logo do Tenant - Exibido quando disponível */}
            {masterLogo && (
              <div className="w-32 h-20 flex items-center justify-center">
                <img 
                  src={`/uploads/logos/${masterLogo}`} 
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
          <CardTitle className="text-2xl text-center"><PlatformName /></CardTitle>
          <CardDescription className="text-center">
            Entre com suas credenciais para acessar o sistema
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
                disabled={loading}
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
                disabled={loading}
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
            <Button type="submit" className="w-full" disabled={loading}>
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

          <div className="mt-1 p-2 bg-muted rounded-lg text-sm text-center">
            <p className="mb-0">Desenvolvido por: GOR Informática - {currentYear}</p>
            <a 
              href="https://wa.me/5561336597358" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full transition-colors duration-200"
            >
              Whatsapp: (61) 33659-7358
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
