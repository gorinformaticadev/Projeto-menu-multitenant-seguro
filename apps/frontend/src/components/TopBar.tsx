"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformConfigContext } from "@/contexts/PlatformConfigContext";
import { useSystemVersion } from "@/hooks/useSystemVersion";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Button } from "./ui/button";
import { Search, User, LogOut, Info } from "lucide-react";
import api from "@/lib/api";
import { ModuleRegistryUserMenu } from "./ModuleRegistryUserMenu";
import Image from "next/image";
import { GlobalSearch } from "./GlobalSearch";
import { SystemNotificationsBell } from "@/components/system-notifications/SystemNotificationsBell";
import { SystemNotificationsDrawer } from "@/components/system-notifications/SystemNotificationsDrawer";
import { DEFAULT_TENANT_LOGO_PATH, resolveTenantLogoSrc } from "@/lib/tenant-logo";

export function TopBar() {
  const { user, logout } = useAuth();
  const { config: platformConfig } = usePlatformConfigContext();
  const platformName = platformConfig.platformName;
  const { version: systemVersion } = useSystemVersion();
  const [masterLogo, setMasterLogo] = useState<string | null>(null);
  const [platformLogoCacheBuster, setPlatformLogoCacheBuster] = useState<number>(() => Date.now());
  const [userTenantLogo, setUserTenantLogo] = useState<string | null>(null);
  const [userTenantLogoCacheBuster, setUserTenantLogoCacheBuster] = useState<number>(() => Date.now());
  const [userAvatarCacheBuster, setUserAvatarCacheBuster] = useState<number>(() => Date.now());
  const [userAvatarFailed, setUserAvatarFailed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false); // Adicionado estado
  const masterLogoSrc = resolveTenantLogoSrc(masterLogo);
  const platformLogoSrc = resolveTenantLogoSrc(platformConfig.platformLogoUrl, {
    cacheBuster: platformLogoCacheBuster,
  });
  const userTenantLogoSrc = resolveTenantLogoSrc(userTenantLogo, {
    cacheBuster: userTenantLogoCacheBuster,
    tenantId: user?.tenantId,
    fallbackToDefault: Boolean(user?.tenantId),
  });
  const userAvatarSrc = resolveTenantLogoSrc(user?.avatarUrl, {
    cacheBuster: userAvatarCacheBuster,
  });
  const effectiveUserAvatarSrc = userAvatarFailed ? null : userAvatarSrc;
  const userMenuImageSrc = effectiveUserAvatarSrc || userTenantLogoSrc;
  const effectiveMainLogoSrc = platformLogoSrc || masterLogoSrc;
  const tenantLogoEndpointSrc = user?.tenantId
    ? resolveTenantLogoSrc(`/api/tenants/public/${encodeURIComponent(user.tenantId)}/logo-file`, {
      cacheBuster: userTenantLogoCacheBuster,
      tenantId: user.tenantId,
      fallbackToDefault: false,
    })
    : null;

  const setUserTenantLogoWithBuster = (logo: string | null) => {
    setUserTenantLogo(logo);
    setUserTenantLogoCacheBuster(Date.now());
  };

  useEffect(() => {
    setPlatformLogoCacheBuster(Date.now());
  }, [platformConfig.platformLogoUrl]);

  useEffect(() => {
    setUserAvatarFailed(false);
    setUserAvatarCacheBuster(Date.now());
  }, [user?.avatarUrl]);

  // Hook para fechar menu ao clicar fora
  const userMenuRef = useClickOutside<HTMLDivElement>(() => {
    setShowUserMenu(false);
  });

  // Busca logo da empresa master (para o header)
  useEffect(() => {
    const cacheKey = 'master-logo-cache';
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const { logoUrl, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 10 * 60 * 1000) { // 10 minutos
          setMasterLogo(logoUrl);
          return;
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    api.get("/api/tenants/public/master-logo")
      .then(response => {
        const logoUrl = response.data?.logoUrl;
        if (logoUrl) {
          setMasterLogo(logoUrl);
          localStorage.setItem(cacheKey, JSON.stringify({
            logoUrl,
            timestamp: Date.now()
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Busca logo do tenant do usuario logado
  useEffect(() => {
    async function fetchUserTenantLogo() {
      const tenantId = user?.tenantId;
      if (!tenantId) {
        setUserTenantLogoWithBuster(null);
        return;
      }

      const cacheKey = `tenant-logo-${tenantId}`;

      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tenant-logo-') && key !== cacheKey) {
          localStorage.removeItem(key);
        }
      });

      const tenantLogoFromUser = user?.tenant?.logoUrl?.trim();
      if (tenantLogoFromUser) {
        setUserTenantLogoWithBuster(tenantLogoFromUser);
        localStorage.setItem(cacheKey, JSON.stringify({
          logoUrl: tenantLogoFromUser,
          timestamp: Date.now(),
        }));
        return;
      }

      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { logoUrl, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 10 * 60 * 1000) { // 10 minutos
            setUserTenantLogoWithBuster(logoUrl);
            return;
          }
        } catch {
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        const response = await api.get(`/tenants/public/${tenantId}/logo`);
        const logoUrl = response.data?.logoUrl;

        if (logoUrl) {
          setUserTenantLogoWithBuster(logoUrl);
          localStorage.setItem(cacheKey, JSON.stringify({
            logoUrl,
            timestamp: Date.now()
          }));
        } else {
          setUserTenantLogoWithBuster(null);
        }
      } catch {
        if (!cached) setUserTenantLogoWithBuster(null);
      }
    }
    fetchUserTenantLogo();
  }, [user?.tenantId, user?.tenant?.logoUrl]);

  const handleTenantLogoError = (target: HTMLImageElement, place: 'menu' | 'dropdown') => {
    target.style.display = 'none';
    const fallbackClass = place === 'menu' ? '.fallback-avatar' : '.fallback-avatar-dropdown';
    const fallback = target.parentElement?.querySelector(fallbackClass);
    if (fallback) {
      fallback.classList.remove('hidden');
    }

    if (user?.tenantId) {
      localStorage.removeItem(`tenant-logo-${user.tenantId}`);
    }
    setUserTenantLogoWithBuster(null);
  };

  const tryTenantImageFallback = (target: HTMLImageElement) => {
    if (!tenantLogoEndpointSrc) {
      return false;
    }

    if (target.dataset.tenantFallbackTried === '1') {
      return false;
    }

    const currentSrc = target.getAttribute('src') || '';
    const isDefaultLogo = currentSrc.includes(DEFAULT_TENANT_LOGO_PATH);
    if (!isDefaultLogo) {
      return false;
    }

    target.dataset.tenantFallbackTried = '1';
    target.src = tenantLogoEndpointSrc;
    return true;
  };

  // Icone de seta para voltar (usado na busca mobile)
  const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
  );

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-skin-border/80 bg-skin-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-skin-surface/85 dark:bg-skin-surface/90">

      {/* OVERLAY DE BUSCA MOBILE */}
      <div
        className={`absolute inset-0 z-50 flex items-center bg-skin-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-skin-surface/90 transition-transform duration-300 ${showMobileSearch ? 'translate-y-0' : '-translate-y-full'
          }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowMobileSearch(false)}
          className="mr-2 flex-shrink-0 text-skin-text-muted"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <GlobalSearch mobile onClose={() => setShowMobileSearch(false)} />
      </div>

      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo e Nome do Sistema */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {effectiveMainLogoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={effectiveMainLogoSrc}
                alt="Logo"
                className="h-10 w-auto max-w-40 object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-skin-primary shadow-md">
                <span className="text-skin-text-inverse font-bold text-lg">S</span>
              </div>
            )}
          </div>
          {/* Nome e Tenant responsivos */}
          <div className="flex flex-col max-w-[120px] md:max-w-none">
            <h1 className="truncate text-sm font-bold leading-tight text-skin-text md:text-lg">{platformName}</h1>
            {user?.tenant && (
              <p className="truncate text-xs text-skin-text-muted">{user.tenant.nomeFantasia}</p>
            )}
          </div>
        </div>

        {/* Barra de Busca Desktop */}
        <div className="hidden lg:flex flex-1 max-w-xl mx-4">
          <GlobalSearch />
        </div>

        {/* Acoes do Usuario (Direita) */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Botao de Busca Mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-skin-text-muted hover:bg-skin-menu-hover lg:hidden"
            onClick={() => setShowMobileSearch(true)}
          >
            <Search className="h-5 w-5" />
          </Button>

          {user?.role === "SUPER_ADMIN" && (
            <>
              <SystemNotificationsBell />
              <SystemNotificationsDrawer />
            </>
          )}

          {/* Menu do Usuario */}
          <div className="relative" ref={userMenuRef}>
            <Button
              variant="ghost"
              className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-accent md:rounded-xl md:px-3 md:py-2"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {/* Logo do Tenant do Usuario */}
              {userMenuImageSrc ? (
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-skin-border bg-skin-secondary">
                  <Image
                    src={userMenuImageSrc}
                    alt="Logo Tenant"
                    width={32}
                    height={32}
                    unoptimized
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      if (effectiveUserAvatarSrc) {
                        setUserAvatarFailed(true);
                        return;
                      }
                      if (tryTenantImageFallback(e.currentTarget)) {
                        return;
                      }
                      handleTenantLogoError(e.currentTarget, 'menu');
                    }}
                  />
                  <div className="fallback-avatar hidden w-full h-full rounded-full bg-skin-primary flex items-center justify-center text-skin-text-inverse font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-skin-primary text-skin-text-inverse shadow-md">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left">
                {user?.tenant?.nomeFantasia && (
                  <p className="truncate text-sm font-medium text-skin-primary">{user.tenant.nomeFantasia}</p>
                )}
                <p className="text-sm font-medium text-skin-text">{user?.name}</p>
                <p className="text-[10px] text-skin-text-muted">{user?.role}</p>
              </div>
            </Button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-skin-border/80 bg-skin-surface py-2 shadow-lg">
                <div className="border-b border-skin-border px-4 py-2">
                  <div className="flex items-center gap-3 mb-2">
                    {/* Logo da Tenant no Menu */}
                    {userMenuImageSrc ? (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-skin-border bg-skin-secondary">
                        <Image
                          src={userMenuImageSrc}
                          alt="Logo Tenant"
                          width={40}
                          height={40}
                          unoptimized
                           className="w-full h-full object-cover"
                           onError={(e) => {
                             if (effectiveUserAvatarSrc) {
                               setUserAvatarFailed(true);
                               return;
                             }
                             if (tryTenantImageFallback(e.currentTarget)) {
                               return;
                             }
                             handleTenantLogoError(e.currentTarget, 'dropdown');
                           }}
                         />
                        <div className="fallback-avatar-dropdown hidden w-full h-full rounded-full bg-skin-primary flex items-center justify-center text-skin-text-inverse font-semibold">
                          {user?.name?.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-skin-primary text-skin-text-inverse shadow-md">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {user?.tenant?.nomeFantasia && (
                        <p className="mb-1 truncate text-sm font-medium text-skin-primary">{user.tenant.nomeFantasia}</p>
                      )}
                      <p className="truncate text-sm font-medium text-skin-text">{user?.name}</p>
                      <p className="truncate text-xs text-skin-text-muted">{user?.email}</p>
                    </div>
                  </div>
                </div>

                <a
                  href="/perfil"
                  onClick={() => setShowUserMenu(false)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-skin-text transition-colors hover:bg-skin-menu-hover"
                >
                  <User className="h-4 w-4 text-skin-text-muted" />
                  Meu Perfil
                </a>

                {/* Itens do Menu do Usuario (Module Registry) */}
                <ModuleRegistryUserMenu onItemClick={() => setShowUserMenu(false)} />

                {/* Versao do Sistema */}
                {user?.role === "SUPER_ADMIN" ? (
                  <a
                    href="/configuracoes/sistema/updates"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-skin-text transition-colors hover:bg-skin-menu-hover"
                    title="Clique para gerenciar atualizacoes"
                  >
                    <Info className="h-4 w-4 text-skin-text-muted" />
                    <div>
                      <span className="text-xs text-skin-text-muted">Versao do Sistema</span>
                      <div className="text-xs font-mono font-medium text-skin-text">{systemVersion}</div>
                    </div>
                  </a>
                ) : (
                  <div className="flex cursor-default items-center gap-2 px-4 py-2 text-left text-sm text-skin-text-muted">
                    <Info className="h-4 w-4 text-skin-text-muted/70" />
                    <div>
                      <span className="text-xs">Versao do Sistema</span>
                      <div className="text-xs font-mono font-medium text-skin-text/85">{systemVersion}</div>
                    </div>
                  </div>
                )}

                <div className="mt-2 border-t border-skin-border pt-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-skin-danger transition-colors hover:bg-skin-danger/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
