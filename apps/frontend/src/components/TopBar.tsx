"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformName } from "@/hooks/usePlatformConfig";
import { useSystemVersion } from "@/hooks/useSystemVersion";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Button } from "./ui/button";
import { Search, User, LogOut, Info } from "lucide-react";
import api from "@/lib/api";
import { ModuleRegistryUserMenu } from "./ModuleRegistryUserMenu";
import { ThemeToggle } from "./ThemeToggle";
import Image from "next/image";
import { GlobalSearch } from "./GlobalSearch";
import { SystemNotificationsBell } from "@/components/system-notifications/SystemNotificationsBell";
import { SystemNotificationsDrawer } from "@/components/system-notifications/SystemNotificationsDrawer";

export function TopBar() {
  const { user, logout } = useAuth();
  const { platformName } = usePlatformName();
  const { version: systemVersion } = useSystemVersion();
  const [masterLogo, setMasterLogo] = useState<string | null>(null);
  const [userTenantLogo, setUserTenantLogo] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false); // Adicionado estado

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
      .catch(error => {
        console.error("Erro ao buscar master logo:", error);
      });
  }, []);

  // Busca logo do tenant do usuario logado
  useEffect(() => {
    async function fetchUserTenantLogo() {
      if (user?.tenantId) {
        const cacheKey = `tenant-logo-${user.tenantId}`;

        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('tenant-logo-') && key !== cacheKey) {
            localStorage.removeItem(key);
          }
        });

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { logoUrl, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 10 * 60 * 1000) { // 10 minutos
              setUserTenantLogo(logoUrl);
              return;
            }
          } catch {
            localStorage.removeItem(cacheKey);
          }
        }

        try {
          const response = await api.get(`/tenants/public/${user.tenantId}/logo`);
          const logoUrl = response.data?.logoUrl;

          if (logoUrl) {
            setUserTenantLogo(logoUrl);
            localStorage.setItem(cacheKey, JSON.stringify({
              logoUrl,
              timestamp: Date.now()
            }));
          } else {
            setUserTenantLogo(null);
          }
        } catch (error) {
          console.error("Erro ao buscar logo do tenant:", error);
          if (!cached) setUserTenantLogo(null);
        }
      } else if (user?.role === "SUPER_ADMIN") {
        setUserTenantLogo(masterLogo);
      }
    }
    fetchUserTenantLogo();
  }, [user, masterLogo]);

  const handleTenantLogoError = (target: HTMLImageElement, place: 'menu' | 'dropdown') => {
    console.error(`Erro ao carregar logo do tenant no ${place}:`, userTenantLogo);
    target.style.display = 'none';
    const fallbackClass = place === 'menu' ? '.fallback-avatar' : '.fallback-avatar-dropdown';
    const fallback = target.parentElement?.querySelector(fallbackClass);
    if (fallback) {
      fallback.classList.remove('hidden');
    }

    if (user?.tenantId) {
      localStorage.removeItem(`tenant-logo-${user.tenantId}`);
    }
    setUserTenantLogo(null);
  };

  // Icone de seta para voltar (usado na busca mobile)
  const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
  );

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-card border-b border-gray-200 dark:border-border shadow-sm z-50 transition-colors duration-200">

      {/* OVERLAY DE BUSCA MOBILE */}
      <div
        className={`absolute inset-0 bg-white dark:bg-card px-4 flex items-center transition-transform duration-300 z-50 ${showMobileSearch ? 'translate-y-0' : '-translate-y-full'
          }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowMobileSearch(false)}
          className="mr-2 text-gray-500 dark:text-muted-foreground flex-shrink-0"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <GlobalSearch mobile onClose={() => setShowMobileSearch(false)} />
      </div>

      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo e Nome do Sistema */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {masterLogo ? (
              <Image
                src={`/uploads/logos/${masterLogo}`}
                alt="Logo"
                width={160}
                height={40}
                unoptimized
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-white font-bold text-lg">S</span>
              </div>
            )}
          </div>
          {/* Nome e Tenant responsivos */}
          <div className="flex flex-col max-w-[120px] md:max-w-none">
            <h1 className="text-sm md:text-lg font-bold text-gray-900 dark:text-foreground leading-tight truncate">{platformName}</h1>
            {user?.tenant && (
              <p className="text-xs text-gray-500 dark:text-muted-foreground truncate">{user.tenant.nomeFantasia}</p>
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
            className="lg:hidden text-gray-600 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent rounded-full"
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
              className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-accent transition-colors p-1 md:px-3 md:py-2 rounded-full md:rounded-md"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {/* Logo do Tenant do Usuario */}
              {userTenantLogo ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-secondary border border-gray-200 dark:border-border">
                  <Image
                    src={`/uploads/logos/${userTenantLogo}`}
                    alt="Logo Tenant"
                    width={32}
                    height={32}
                    unoptimized
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      handleTenantLogoError(e.currentTarget, 'menu');
                    }}
                  />
                  <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white font-semibold fallback-avatar hidden">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold shadow-sm">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left">
                {user?.tenant?.nomeFantasia && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium truncate">{user.tenant.nomeFantasia}</p>
                )}
                <p className="text-sm font-medium text-gray-900 dark:text-foreground">{user?.name}</p>
                <p className="text-[10px] text-gray-500 dark:text-muted-foreground">{user?.role}</p>
              </div>
            </Button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-popover rounded-lg shadow-lg dark:shadow-shadow-dark border border-gray-200 dark:border-border py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-border">
                  <div className="flex items-center gap-3 mb-2">
                    {/* Logo da Tenant no Menu */}
                    {userTenantLogo ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-secondary border border-gray-200 dark:border-border flex-shrink-0">
                        <Image
                          src={`/uploads/logos/${userTenantLogo}`}
                          alt="Logo Tenant"
                          width={40}
                          height={40}
                          unoptimized
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            handleTenantLogoError(e.currentTarget, 'dropdown');
                          }}
                        />
                        <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white font-semibold fallback-avatar-dropdown hidden">
                          {user?.name?.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-sm">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {user?.tenant?.nomeFantasia && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium truncate mb-1">{user.tenant.nomeFantasia}</p>
                      )}
                      <p className="text-sm font-medium text-gray-900 dark:text-foreground truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Seletor de Tema */}
                <div className="px-4 py-2 border-b border-gray-200 dark:border-border">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Tema</div>
                  <ThemeToggle />
                </div>

                <a
                  href="/perfil"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-foreground hover:bg-gray-100 dark:hover:bg-accent flex items-center gap-2 transition-colors"
                >
                  <User className="h-4 w-4 text-gray-500 dark:text-muted-foreground" />
                  Meu Perfil
                </a>

                {/* Itens do Menu do Usuario (Module Registry) */}
                <ModuleRegistryUserMenu onItemClick={() => setShowUserMenu(false)} />

                {/* Versao do Sistema */}
                {user?.role === "SUPER_ADMIN" ? (
                  <a
                    href="/configuracoes/sistema/updates"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-foreground hover:bg-gray-100 dark:hover:bg-accent flex items-center gap-2 transition-colors"
                    title="Clique para gerenciar atualizacoes"
                  >
                    <Info className="h-4 w-4 text-gray-500 dark:text-muted-foreground" />
                    <div>
                      <span className="text-xs text-gray-600 dark:text-muted-foreground">Versao do Sistema</span>
                      <div className="text-xs font-mono font-medium text-gray-800 dark:text-foreground">{systemVersion}</div>
                    </div>
                  </a>
                ) : (
                  <div className="px-4 py-2 text-left text-sm text-gray-500 dark:text-muted-foreground flex items-center gap-2 cursor-default">
                    <Info className="h-4 w-4 text-gray-400 dark:text-slate-600" />
                    <div>
                      <span className="text-xs">Versao do Sistema</span>
                      <div className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300">{systemVersion}</div>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-border mt-2 pt-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
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
