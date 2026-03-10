"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformConfigContext } from "@/contexts/PlatformConfigContext";
import { useSystemVersion } from "@/hooks/useSystemVersion";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Button } from "./ui/button";
import { Bell, Search, User, LogOut, Info } from "lucide-react";
import api from "@/lib/api";
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
  const [showNotifications, setShowNotifications] = useState(false);
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
  const [notifications, setNotifications] = useState<{
    title: string;
    message: string;
    time: string;
  }[]>([]); // Lista de notificações

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



  // Hook para fechar menu ao clicar fora
  const userMenuRef = useClickOutside<HTMLDivElement>(() => {
    setShowUserMenu(false);
  });

  const notificationsRef = useClickOutside<HTMLDivElement>(() => {
    setShowNotifications(false);
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

  // Busca logo do tenant do usuário logado
  useEffect(() => {
    async function fetchUserTenantLogo() {
      const tenantId = user?.tenantId;
      if (!tenantId) {
        setUserTenantLogoWithBuster(null);
        return;
      }

      const cacheKey = `tenant-logo-${tenantId}`;
      const cacheTTL = 10 * 60 * 1000; // 10 minutos

      const tenantLogoFromUser = user?.tenant?.logoUrl?.trim();
      if (tenantLogoFromUser) {
        setUserTenantLogoWithBuster(tenantLogoFromUser);
        localStorage.setItem(cacheKey, JSON.stringify({
          logoUrl: tenantLogoFromUser,
          timestamp: Date.now(),
        }));
        return;
      }

      // Verificar cache
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { logoUrl, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTTL) {
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
          // Cache o resultado
          localStorage.setItem(cacheKey, JSON.stringify({
            logoUrl,
            timestamp: Date.now()
          }));
        } else {
          setUserTenantLogoWithBuster(null);
        }
      } catch {
        setUserTenantLogoWithBuster(null);
      }
    }
    fetchUserTenantLogo();
  }, [user?.tenantId, user?.tenant?.logoUrl]);

  // Simular notificações (remover em produção e conectar com dados reais)
  useEffect(() => {
    // Exemplo de notificações - você pode remover isso e conectar com API real
    const exampleNotifications: {
      title: string;
      message: string;
      time: string;
    }[] = [
        // Descomente as linhas abaixo para testar com notificações
        // {
        //   title: "Novo usuário cadastrado",
        //   message: "João Silva se cadastrou na plataforma",
        //   time: "há 5 minutos"
        // },
        // {
        //   title: "Backup concluído",
        //   message: "Backup automático realizado com sucesso",
        //   time: "há 1 hora"
        // }
      ];
    setNotifications(exampleNotifications);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 shadow-sm z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo e Nome do Sistema */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {effectiveMainLogoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={effectiveMainLogoSrc}
                alt="Logo"
                className="h-10 w-auto max-w-32 object-contain object-left"
              />
            ) : (
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <h1 className="text-lg font-bold text-gray-900">{platformName}</h1>
            {user?.tenant && (
              <p className="text-xs text-gray-500">{user.tenant.nomeFantasia}</p>
            )}
          </div>
        </div>

        {/* Barra de Busca (Centro) */}
        <div className="hidden lg:flex flex-1 max-w-xl mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Ações do Usuário (Direita) */}
        <div className="flex items-center gap-2">
          {/* Botão de Busca Mobile */}
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Search className="h-5 w-5" />
          </Button>

          {/* Notificações */}
          <div className="relative" ref={notificationsRef}>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              )}
            </Button>

            {/* Dropdown de Notificações */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Sem notificações</p>
                    <p className="text-xs text-gray-400 mt-1">Você está em dia!</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notification, index) => (
                      <div key={index} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {notification.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-200">
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      onClick={() => {
                        setNotifications([]);
                        setShowNotifications(false);
                      }}
                    >
                      Marcar todas como lidas
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Menu do Usuário */}
          <div className="relative" ref={userMenuRef}>
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {/* Logo do Tenant do Usuário */}
              {userMenuImageSrc ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 relative">
                  <Image
                    src={userMenuImageSrc}
                    alt="Logo Tenant"
                    fill
                    className="object-cover"
                    unoptimized
                    onError={(e) => {
                      if (effectiveUserAvatarSrc) {
                        setUserAvatarFailed(true);
                        return;
                      }
                      if (tryTenantImageFallback(e.currentTarget)) {
                        return;
                      }
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.parentElement?.parentElement?.querySelector('.fallback-avatar');
                      if (fallback) {
                        fallback.classList.remove('hidden');
                      }
                    }}
                  />
                  <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white font-semibold fallback-avatar hidden">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left">
                {user?.tenant?.nomeFantasia && (
                  <p className="text-sm text-blue-600 font-medium truncate">{user.tenant.nomeFantasia}</p>
                )}
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-[10px] text-gray-500">{user?.role}</p>
              </div>
            </Button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    {/* Logo da Tenant no Menu */}
                    {userMenuImageSrc ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 flex-shrink-0 relative">
                        <Image
                          src={userMenuImageSrc}
                          alt="Logo Tenant"
                          fill
                          className="object-cover"
                          unoptimized
                          onError={(e) => {
                            if (effectiveUserAvatarSrc) {
                              setUserAvatarFailed(true);
                              return;
                            }
                            if (tryTenantImageFallback(e.currentTarget)) {
                              return;
                            }
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.parentElement?.parentElement?.querySelector('.fallback-avatar-dropdown');
                            if (fallback) {
                              fallback.classList.remove('hidden');
                            }
                          }}
                        />
                        <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white font-semibold fallback-avatar-dropdown hidden">
                          {user?.name?.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {user?.tenant?.nomeFantasia && (
                        <p className="text-sm text-blue-600 font-medium truncate mb-1">{user.tenant.nomeFantasia}</p>
                      )}
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>
                <a
                  href="/perfil"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  Meu Perfil
                </a>

                {/* Versão do Sistema */}
                {user?.role === "SUPER_ADMIN" ? (
                  <a
                    href="/configuracoes/sistema/updates"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    title="Clique para gerenciar atualizações"
                  >
                    <Info className="h-4 w-4" />
                    <div>
                      <span className="text-xs text-gray-600">Versão do Sistema</span>
                      <div className="text-xs font-mono font-medium text-gray-800">{systemVersion}</div>
                    </div>
                  </a>
                ) : (
                  <div className="px-4 py-2 text-left text-sm text-gray-500 flex items-center gap-2 cursor-default">
                    <Info className="h-4 w-4" />
                    <div>
                      <span className="text-xs">Versão do Sistema</span>
                      <div className="text-xs font-mono font-medium text-gray-700">{systemVersion}</div>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 mt-2 pt-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
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
