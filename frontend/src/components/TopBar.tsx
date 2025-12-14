"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformName } from "@/hooks/usePlatformConfig";
import { useSystemVersion } from "@/hooks/useSystemVersion";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Button } from "./ui/button";
import { Bell, Search, User, LogOut, Info } from "lucide-react";
import { API_URL } from "@/lib/api";
import api from "@/lib/api";
import { useModuleFeatures } from "@/hooks/useModuleFeatures";
import { ModuleRegistryUserMenu } from "./ModuleRegistryUserMenu";
import { useNotificationsDropdown } from "@/hooks/useNotificationsDropdown";
import { AlertTriangle, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { Notification } from "@/types/notifications";
import * as LucideIcons from "lucide-react";

// Helper para ícones dinâmicos
const getIconComponent = (iconName: string): any => {
  return (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
};

export function TopBar() {
  const { user, logout } = useAuth();
  const { platformName } = usePlatformName();
  const { version: systemVersion } = useSystemVersion();
  const [masterLogo, setMasterLogo] = useState<string | null>(null);
  const [userTenantLogo, setUserTenantLogo] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { features: moduleFeatures } = useModuleFeatures();

  // Hook do sistema de notificações
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    error: notificationsError,
    markAsRead,
    markAllAsRead,
    refresh: refreshNotifications,
    clearError
  } = useNotificationsDropdown();



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

  // Utilitários para notificações
  const getNotificationIcon = (severity: string) => {
    switch (severity) {
      case 'warning': return AlertTriangle;
      case 'critical': return AlertCircle;
      default: return Info;
    }
  };

  const getNotificationColor = (severity: string) => {
    switch (severity) {
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const formatNotificationTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes}min`;
    if (hours < 24) return `há ${hours}h`;
    return `há ${days}d`;
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Marca como lida se não estiver
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Redireciona se tiver contexto
    if (notification.context) {
      window.location.href = notification.context;
    }
  };

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
          <div className="relative" ref={notificationsRef}>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Dropdown de Notificações */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                        {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {notificationsLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  )}
                </div>

                {/* Erro */}
                {notificationsError && (
                  <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-red-600">{notificationsError}</p>
                      <button
                        onClick={clearError}
                        className="text-xs text-red-800 hover:text-red-900 font-medium"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  </div>
                )}

                {/* Conteúdo */}
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Sem notificações</p>
                    <p className="text-xs text-gray-400 mt-1">Você está em dia!</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notification) => {
                      const Icon = getNotificationIcon(notification.severity);
                      const isUnread = !notification.read;
                      
                      return (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors ${
                            isUnread ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Ícone e indicador de não lida */}
                            <div className="flex-shrink-0 relative">
                              <Icon className={`h-4 w-4 mt-1 ${
                                notification.severity === 'critical' ? 'text-red-600' :
                                notification.severity === 'warning' ? 'text-yellow-600' :
                                'text-blue-600'
                              }`} />
                              {isUnread && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm truncate ${
                                  isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                                }`}>
                                  {notification.title}
                                </p>
                                
                                {/* Badge de severidade */}
                                {notification.severity !== 'info' && (
                                  <span className={`px-2 py-1 text-xs rounded-full font-medium flex-shrink-0 ${
                                    getSeverityBadgeColor(notification.severity)
                                  }`}>
                                    {notification.severity === 'critical' ? 'Crítica' : 'Aviso'}
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <span>{formatNotificationTime(notification.createdAt)}</span>
                                  {notification.source === 'module' && notification.module && (
                                    <>
                                      <span>•</span>
                                      <span className="capitalize">{notification.module}</span>
                                    </>
                                  )}
                                </div>
                                
                                {notification.context && (
                                  <ExternalLink className="h-3 w-3 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  {notifications.length > 0 && (
                    <button
                      onClick={async () => {
                        await markAllAsRead();
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      disabled={unreadCount === 0}
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                  
                  <a
                    href="/notificacoes"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1"
                  >
                    Ver todas
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
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
              {userTenantLogo ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-100">
                  <img
                    src={`${API_URL}/uploads/logos/${userTenantLogo}`}
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
                          src={`${API_URL}/uploads/logos/${userTenantLogo}`}
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

                {/* Itens do Menu do Usuário (Sistema Antigo) */}
                {moduleFeatures.userMenu.map((item, index) => {
                  const Icon = getIconComponent(item.icon);
                  return (
                    <a
                      key={`module-menu-${index}`}
                      href={item.path}
                      onClick={() => setShowUserMenu(false)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </a>
                  );
                })}

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
