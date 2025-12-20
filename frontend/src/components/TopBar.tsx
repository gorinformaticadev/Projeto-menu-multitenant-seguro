"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformName } from "@/hooks/usePlatformConfig";
import { useSystemVersion } from "@/hooks/useSystemVersion";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Button } from "./ui/button";
import { Search, User, LogOut, Info } from "lucide-react";
import { API_URL } from "@/lib/api";
import api from "@/lib/api";
import { ModuleRegistryUserMenu } from "./ModuleRegistryUserMenu";
import { NotificationTaskbar } from "./layout/NotificationTaskbar";

export function TopBar() {
  const { user, logout } = useAuth();
  const { platformName } = usePlatformName();
  const { version: systemVersion } = useSystemVersion();
  const [masterLogo, setMasterLogo] = useState<string | null>(null);
  const [userTenantLogo, setUserTenantLogo] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
          console.log('🎨 Usando cache master logo:', logoUrl);
          setMasterLogo(logoUrl);
          return;
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    console.log('🌐 Buscando master logo da API');
    api.get("/tenants/public/master-logo")
      .then(response => {
        const logoUrl = response.data?.logoUrl;
        if (logoUrl) {
          setMasterLogo(logoUrl);
          localStorage.setItem(cacheKey, JSON.stringify({
            logoUrl,
            timestamp: Date.now()
          }));
          console.log('💾 Master logo cacheado:', logoUrl);
        }
      })
      .catch(error => {
        console.error("❌ Erro ao buscar master logo:", error);
      });
  }, []);

  // Busca logo do tenant do usuário logado
  useEffect(() => {
    async function fetchUserTenantLogo() {
      if (user?.tenantId) {
        // Limpar cache antigo de outros tenants
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('tenant-logo-') && key !== `tenant-logo-${user.tenantId}`) {
            localStorage.removeItem(key);
          }
        });

        try {
          // SEMPRE buscar da API para garantir dados atualizados
          const response = await api.get(`/tenants/public/${user.tenantId}/logo?_t=${Date.now()}`);
          const logoUrl = response.data?.logoUrl;
          console.log('🔄 Logo do tenant atualizado:', logoUrl);
          if (logoUrl) {
            setUserTenantLogo(logoUrl);
          } else {
            setUserTenantLogo(null);
          }
        } catch (error) {
          console.error("Erro ao buscar logo do tenant:", error);
          setUserTenantLogo(null);
        }
      } else if (user?.role === "SUPER_ADMIN") {
        // SUPER_ADMIN usa o logo master
        setUserTenantLogo(masterLogo);
      }
    }
    fetchUserTenantLogo();
  }, [user, masterLogo]);

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 shadow-sm z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo e Nome do Sistema */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {masterLogo ? (
              <img
                src={`${API_URL}/uploads/logos/${masterLogo}`}
                alt="Logo"
                className="h-10 w-auto object-contain"
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

          {/* [REGRA 2] TASKBAR DE NOTIFICAÇÕES SSE - Recepção direta */}
          <NotificationTaskbar />

          {/* Menu do Usuário */}
          <div className="relative" ref={userMenuRef}>
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {/* Logo do Tenant do Usuário */}
              {userTenantLogo ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-100">
                  <img
                    src={`${API_URL}/uploads/logos/${userTenantLogo}?t=${Date.now()}`}
                    alt="Logo Tenant"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('Erro ao carregar logo do tenant no menu:', userTenantLogo);
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.parentElement?.querySelector('.fallback-avatar');
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
                    {userTenantLogo ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 flex-shrink-0">
                        <img
                          src={`${API_URL}/uploads/logos/${userTenantLogo}?t=${Date.now()}`}
                          alt="Logo Tenant"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Erro ao carregar logo do tenant no dropdown:', userTenantLogo);
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.parentElement?.querySelector('.fallback-avatar-dropdown');
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

                {/* Itens do Menu do Usuário (Module Registry) */}
                <ModuleRegistryUserMenu onItemClick={() => setShowUserMenu(false)} />

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
                      <div className="text-xs font-mono font-medium text-gray-800">v{systemVersion}</div>
                    </div>
                  </a>
                ) : (
                  <div className="px-4 py-2 text-left text-sm text-gray-500 flex items-center gap-2 cursor-default">
                    <Info className="h-4 w-4" />
                    <div>
                      <span className="text-xs">Versão do Sistema</span>
                      <div className="text-xs font-mono font-medium text-gray-700">v{systemVersion}</div>
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
