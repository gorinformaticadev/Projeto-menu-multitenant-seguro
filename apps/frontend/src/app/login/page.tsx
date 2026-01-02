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
  }

  async function handle2FASubmit(code: string) {
    await loginWith2FA(code);
  }

  function handleBack() {
    reset();
    setEmail("");
    setPassword("");
    setRememberMe(false);
  }

  // Wrapper with Glassmorphism Context
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#020617] p-4 gap-4 font-sans selection:bg-indigo-500/30 text-slate-200">
      {/* Background Blobs for Glass Effect Enhancement */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] opacity-50 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] opacity-50 animate-pulse delay-1000" />
      </div>
      {children}
    </div>
  );

  if (requires2FA) {
    return (
      <Wrapper>
        <TwoFactorLogin
          email={credentials.email}
          password={credentials.password}
          onSubmit={handle2FASubmit}
          onBack={handleBack}
          loading={loading}
        />
      </Wrapper>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#020617] p-4 gap-3 font-sans selection:bg-indigo-500/30 text-slate-200 relative overflow-hidden">

      {/* Background Glows to enhance Glass Effect */}
      <div className="absolute top-1/4 -left-10 w-72 h-72 bg-indigo-500/30 rounded-full blur-[100px] opacity-40 animate-pulse" />
      <div className="absolute bottom-1/4 -right-10 w-72 h-72 bg-blue-600/20 rounded-full blur-[100px] opacity-40 animate-pulse delay-700" />

      {/* 
        Main Login Card - GLASS NEUMORPHISM HYBRID
        Combines backdrop-blur (Glass) with strong box-shadows (Neumorphism volume).
      */}
      <div className="w-full max-w-[380px] rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-[20px_20px_40px_rgba(0,0,0,0.5),-10px_-10px_20px_rgba(255,255,255,0.05)] relative z-10 transition-all duration-500 hover:shadow-[20px_20px_50px_rgba(0,0,0,0.6),-10px_-10px_30px_rgba(255,255,255,0.08)]">

        <div className="flex flex-col items-center justify-center mb-2 space-y-4">
          {/* Logo Container - Glass Pop-out */}
          {masterLogo ? (
            <div className="inline-flex items-center justify-center relative rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[8px_8px_16px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)]">
              <img
                src={`${API_URL}/uploads/logos/${masterLogo}`}
                alt="Logo do Tenant"
                className="h-20 w-auto object-contain relative z-10 drop-shadow-xl"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.fallback-tenant-icon');
                  if (fallback) {
                    fallback.classList.remove('hidden');
                  }
                }}
              />
              <div className="bg-transparent rounded-xl w-20 h-20 flex items-center justify-center fallback-tenant-icon hidden">
                <Building2 className="h-10 w-10 text-slate-300" />
              </div>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-md p-5 rounded-full border border-white/10 shadow-[8px_8px_16px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)]">
              <Building2 className="h-10 w-10 text-slate-300" />
            </div>
          )}

          <div className="text-center space-y-1">
            <div className="text-xl font-bold tracking-tight text-white drop-shadow-md">
              <PlatformName />
            </div>
            <p className="text-sm text-slate-400 font-medium tracking-wide">BEM-VINDO DE VOLTA</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-bold text-slate-400 ml-2 uppercase tracking-wider">Email</Label>
            <div className="relative group">
              {/* Glassy Inset Input */}
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/20 border border-white/5 rounded-xl h-10 px-4 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.05)] focus-visible:ring-1 focus-visible:ring-indigo-500/50 focus-visible:bg-black/30 transition-all placeholder:text-slate-600 text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-2 mr-1">
              <Label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Senha</Label>
            </div>
            {/* Glassy Inset Input */}
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black/20 border border-white/5 rounded-xl h-10 px-4 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.05)] focus-visible:ring-1 focus-visible:ring-indigo-500/50 focus-visible:bg-black/30 transition-all placeholder:text-slate-600 text-slate-200"
            />
          </div>

          <div className="flex items-center justify-between pt-2 px-2">
            <div className="flex items-center space-x-2">
              <div className="relative flex items-center">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={loading}
                  className="h-5 w-5 border-white/10 rounded bg-black/20 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 checkbox-shadow text-white"
                />
                <Label
                  htmlFor="rememberMe"
                  className="ml-2 text-xs font-medium cursor-pointer text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Lembrar-me
                </Label>
              </div>
            </div>
            <a
              href="/esqueci-senha"
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors drop-shadow-sm"
            >
              Recuperar Senha?
            </a>
          </div>

          <Button
            type="submit"
            className="w-full text-white font-bold tracking-wide h-12 rounded-xl bg-indigo-600/90 backdrop-blur-sm shadow-[0_4px_14px_0_rgba(99,102,241,0.39)] hover:bg-indigo-500 hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mt-4 border border-indigo-400/20"
            disabled={loading}
          >
            {loading ? "AUTENTICANDO..." : "ENTRAR"}
          </Button>
        </form>
      </div>

      {/* Footer Info Card - GLASS */}
      <div className="w-full max-w-[380px] rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-3 shadow-[10px_10px_20px_rgba(0,0,0,0.3),-5px_-5px_10px_rgba(255,255,255,0.03)] flex flex-col items-center justify-center gap-3 relative z-10 transition-all hover:bg-white/10">
        <p className="text-[10px] text-slate-500 font-semibold tracking-wide">
          POWERED BY <span className="text-slate-300 font-bold">GOR INFORMÁTICA</span> © {currentYear}
        </p>

        <a
          href="https://wa.me/556133597358"
          target="_blank"
          rel="noopener noreferrer"
          className="
              flex items-center gap-2 px-6 py-2 rounded-full 
              bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
              hover:bg-emerald-500/20 hover:border-emerald-500/30
              hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]
              transition-all duration-300
              text-[11px] font-bold tracking-wide backdrop-blur-sm
            "
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentcolor" viewBox="0 0 16 16">
            <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
          </svg>
          SUPORTE WHATSAPP
        </a>
      </div>
    </div >
  );
}
