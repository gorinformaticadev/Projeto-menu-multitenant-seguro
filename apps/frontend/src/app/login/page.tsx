"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Building2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TwoFactorLogin } from "@/components/TwoFactorLogin";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { useToast } from "@/hooks/use-toast";
import { use2FALogin } from "@/hooks/use2FALogin";
import { usePlatformConfigContext } from "@/contexts/PlatformConfigContext";
import { ROUTE_CONFIG, isSafeCallbackUrl } from "@/lib/routes";
import { resolveTenantLogoSrc } from "@/lib/tenant-logo";

const REMEMBERED_LOGIN_KEY = "rememberedLoginEmail";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { config: platformConfig } = usePlatformConfigContext();
  const platformLogoSrc = resolveTenantLogoSrc(platformConfig.platformLogoUrl);
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();
  const {
    requires2FA,
    mustEnrollTwoFactor,
    loading,
    error,
    attemptLogin,
    loginWith2FA,
    reset,
    credentials,
  } = use2FALogin();

  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBERED_LOGIN_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    toast({
      title: "Erro no login",
      description: error,
      variant: "destructive",
    });
  }, [error, toast]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (rememberMe) {
      localStorage.setItem(REMEMBERED_LOGIN_KEY, email);
    } else {
      localStorage.removeItem(REMEMBERED_LOGIN_KEY);
    }

    await attemptLogin(email, password);
  }

  async function handle2FASubmit(code: string, trustDevice: boolean) {
    await loginWith2FA(code, trustDevice);
  }

  function handleBack() {
    reset();
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setCapsLockActive(false);
    setRememberMe(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    setCapsLockActive(event.getModifierState("CapsLock"));
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="auth-theme auth-page min-h-screen flex flex-col items-center justify-center gap-4 p-4 font-sans text-[var(--auth-text)] selection:bg-[color:var(--auth-primary-selection)]">
      <div className="fixed left-0 top-0 -z-10 h-full w-full overflow-hidden pointer-events-none">
        <div className="auth-blob-primary absolute left-1/4 top-1/4 h-96 w-96 rounded-full opacity-50 blur-[100px] animate-pulse" />
        <div className="auth-blob-secondary absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full opacity-50 blur-[100px] animate-pulse delay-1000" />
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

  if (mustEnrollTwoFactor) {
    return (
      <Wrapper>
        <div className="w-full max-w-md space-y-4">
          <TwoFactorSetup
            isEnabled={false}
            mode="enrollment"
            onStatusChange={async (enabled) => {
              if (!enabled || typeof window === "undefined") {
                return;
              }

              const searchParams = new URLSearchParams(window.location.search);
              const rawCallback = searchParams.get("callbackUrl");
              const callbackUrl = isSafeCallbackUrl(rawCallback)
                ? rawCallback!
                : ROUTE_CONFIG.authenticatedFallback;

              window.location.assign(callbackUrl);
            }}
          />
          <Button variant="outline" onClick={handleBack} disabled={loading} className="w-full">
            Voltar ao login
          </Button>
        </div>
      </Wrapper>
    );
  }

  return (
    <div className="auth-theme auth-page relative flex min-h-screen flex-col items-center justify-center gap-3 overflow-hidden p-4 font-sans text-[var(--auth-text)] selection:bg-[color:var(--auth-primary-selection)]">
      <div className="auth-blob-primary absolute -left-10 top-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px] animate-pulse" />
      <div className="auth-blob-secondary absolute -right-10 bottom-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px] animate-pulse delay-700" />

      <div className="auth-card relative z-10 w-full max-w-[380px] rounded-3xl p-6 backdrop-blur-xl transition-all duration-500">
        <div className="mb-2 flex flex-col items-center justify-center space-y-4">
          {platformLogoSrc ? (
            <div className="auth-shell relative inline-flex items-center justify-center rounded-2xl backdrop-blur-md">
              <Image
                src={platformLogoSrc}
                alt="Logo da Plataforma"
                width={80}
                height={80}
                className="relative z-10 h-20 w-auto object-contain drop-shadow-xl"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  const fallback =
                    event.currentTarget.parentElement?.querySelector(".fallback-tenant-icon");
                  if (fallback) {
                    fallback.classList.remove("hidden");
                  }
                }}
                unoptimized
                priority
              />
              <div className="fallback-tenant-icon hidden h-20 w-20 items-center justify-center rounded-xl bg-transparent">
                <Building2 className="auth-text-muted h-10 w-10" />
              </div>
            </div>
          ) : (
            <div className="auth-shell rounded-full p-5 backdrop-blur-md">
              <Building2 className="auth-text-muted h-10 w-10" />
            </div>
          )}

          <div className="space-y-1 text-center">
            <div className="text-xl font-bold tracking-tight text-[var(--auth-text)] drop-shadow-md">
              {platformConfig.platformName}
            </div>
            <p className="auth-text-muted text-sm font-medium tracking-wide">BEM-VINDO DE VOLTA</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="auth-text-muted ml-2 text-xs font-bold uppercase tracking-wider"
            >
              Email
            </Label>
            <div className="relative group">
              <Input
                id="email"
                name="username"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                className="auth-field h-10 rounded-xl px-4 !text-[var(--auth-input-text)] placeholder:!text-[var(--auth-input-placeholder)] transition-all focus-visible:ring-1 focus-visible:ring-[color:var(--auth-primary-soft)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="ml-2 mr-1 flex items-center justify-between">
              <Label
                htmlFor="password"
                className="auth-text-muted text-xs font-bold uppercase tracking-wider"
              >
                Senha
              </Label>
            </div>
            <div className="relative group">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyDown}
                className="auth-field h-10 rounded-xl px-4 pr-10 !text-[var(--auth-input-text)] placeholder:!text-[var(--auth-input-placeholder)] transition-all focus-visible:ring-1 focus-visible:ring-[color:var(--auth-primary-soft)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="auth-text-soft absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-[var(--auth-text-muted)]"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {capsLockActive ? (
              <div className="auth-warning ml-2 mt-1 flex animate-pulse items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  CAPS LOCK ATIVADO
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between px-2 pt-2">
            <div className="flex items-center space-x-2">
              <div className="relative flex items-center">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked: boolean) => setRememberMe(Boolean(checked))}
                  disabled={loading}
                  className="auth-checkbox checkbox-shadow h-5 w-5 rounded"
                />
                <Label
                  htmlFor="rememberMe"
                  className="auth-text-muted ml-2 cursor-pointer text-xs font-medium transition-colors hover:text-[var(--auth-text)]"
                >
                  Lembrar-me
                </Label>
              </div>
            </div>
            <a
              href="/esqueci-senha"
              className="auth-link text-xs font-bold transition-colors drop-shadow-sm"
            >
              Recuperar Senha?
            </a>
          </div>

          <Button
            type="submit"
            className="auth-button mt-4 h-12 w-full rounded-xl font-bold tracking-wide backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            disabled={loading}
          >
            {loading ? "AUTENTICANDO..." : "ENTRAR"}
          </Button>
        </form>
      </div>

      <div className="auth-footer-shell relative z-10 flex w-full max-w-[380px] flex-col items-center justify-center gap-3 rounded-2xl p-3 backdrop-blur-xl transition-all hover:bg-[var(--auth-surface-hover)]">
        <p className="auth-text-soft text-[10px] font-semibold tracking-wide">
          POWERED BY <span className="auth-text-muted font-bold">GOR INFORMÁTICA</span> ©{" "}
          {currentYear}
        </p>

        <a
          href="https://wa.me/556133597358"
          target="_blank"
          rel="noopener noreferrer"
          className="auth-support-link flex items-center gap-2 rounded-full px-6 py-2 text-[11px] font-bold tracking-wide backdrop-blur-sm transition-all duration-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
          </svg>
          SUPORTE WHATSAPP
        </a>
      </div>
    </div>
  );
}
