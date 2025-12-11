"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformName } from "@/hooks/usePlatformConfig";
import { Button } from "./ui/button";
import { Bell, Search, User, LogOut } from "lucide-react";
import { API_URL } from "@/lib/api";
import api from "@/lib/api";

export function TopBar() {
  const { user, logout } = useAuth();
  const { platformName } = usePlatformName();
  const [masterLogo, setMasterLogo] = useState<string | null>(null);
  const [userTenantLogo, setUserTenantLogo] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
        // Usuário tem tenant (ADMIN, USER, CLIENT) - usa endpoint público
        const cacheKey = `tenant-logo-${user.tenantId}`;
        const cacheTTL = 10 * 60 * 1000; // 10 minutos

        // Verificar cache
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { logoUrl, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < cacheTTL) {
              setUserTenantLogo(logoUrl);
              return;
            }
          } catch (e) {
            // Cache inválido, continua
          }
        }

        try {
          const response = await api.get(`/tenants/public/${user.tenantId}/logo`);
          const logoUrl = response.data?.logoUrl;
          if (logoUrl) {
            setUserTenantLogo(logoUrl);
            // Cache o resultado
            localStorage.setItem(cacheKey, JSON.stringify({
              logoUrl,
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          console.error("Erro ao buscar logo do tenant:", error);
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

          {/* Notificações */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </Button>

          {/* Menu do Usuário */}
          <div className="relative">
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {/* Logo do Tenant do Usuário */}
              {userTenantLogo ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-100">
                  <img 
                    src={`${API_URL}/uploads/logos/${userTenantLogo}`} 
                    alt="Logo Tenant"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
            </Button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <a
                  href="/perfil"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  Meu Perfil
                </a>
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
