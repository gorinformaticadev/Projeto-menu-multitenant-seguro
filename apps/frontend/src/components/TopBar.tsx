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
import { ModuleRegistryUserMenu } from "./ModuleRegistryUserMenu";
import { useNotificationContext } from '@/providers/NotificationProvider';
import { AlertTriangle, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { Notification } from '@/types/notifications';
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "next-themes";
import * as LucideIcons from "lucide-react";
import Image from "next/image";

export function TopBar() {
  const { user, logout } = useAuth();
  const { platformName } = usePlatformName();
  const { version: systemVersion } = useSystemVersion();
  const [masterLogo, setMasterLogo] = useState<string | null>(null);
  const [userTenantLogo, setUserTenantLogo] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  // const { setTheme } = useTheme();

  // Sincroniza tema da preferência do usuário


  // Hook do sistema de notificações
  const {
    notifications,
    unreadCount,
    isConnected,
    connectionError,
    markAsRead,
    markAllAsRead
  } = useNotificationContext();


  // console.log('👀 [TopBar] Render com unreadCount:', unreadCount);

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
          // console.log('🎨 Usando cache master logo:', logoUrl);
          setMasterLogo(logoUrl);
          return;
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    // console.log('🌐 Buscando master logo da API');
    api.get("/tenants/public/master-logo")
      .then(response => {
        const logoUrl = response.data?.logoUrl;
        if (logoUrl) {
          setMasterLogo(logoUrl);
          localStorage.setItem(cacheKey, JSON.stringify({
            logoUrl,
            timestamp: Date.now()
          }));
          // console.log('💾 Master logo cacheado:', logoUrl);
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
          // console.log('🔄 Logo do tenant atualizado:', logoUrl);
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

  // Utilitários para notificações
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'error': return AlertCircle;
      case 'success': return CheckCircle;
      default: return Info;
    }
  };

  // const getNotificationColor = (type: string) => {
  //   switch (type) {
  //     case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  //     case 'error': return 'text-red-600 bg-red-50 border-red-200';
  //     case 'success': return 'text-green-600 bg-green-50 border-green-200';
  //     default: return 'text-blue-600 bg-blue-50 border-blue-200';
  //   }
  // };
  // const getSeverityBadgeColor = (type: string) => {
  //   switch (type) {
  //     case 'warning': return 'bg-yellow-100 text-yellow-800';
  //     case 'error': return 'bg-red-100 text-red-800';
  //     case 'success': return 'bg-green-100 text-green-800';
  //     default: return 'bg-blue-100 text-blue-800';
  //   }
  // };

  const formatNotificationTime = (dateInput: Date | string) => {
    const now = new Date();
    const date = new Date(dateInput);

    if (isNaN(date.getTime())) return 'data inválida';

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
      markAsRead(notification.id);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-card border-b border-gray-200 dark:border-border shadow-sm z-50 transition-colors duration-200">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo e Nome do Sistema */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {masterLogo ? (
              <Image
                src={`${API_URL}/uploads/logos/${masterLogo}`}
                alt="Logo"
                width={80}
                height={40}
                className="h-10 w-auto object-contain"
                unoptimized
                priority
              />
            ) : (
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-white font-bold text-lg">S</span>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <h1 className="text-lg font-bold text-gray-900 dark:text-foreground">{platformName}</h1>
            {user?.tenant && (
              <p className="text-xs text-gray-500 dark:text-muted-foreground">{user.tenant.nomeFantasia}</p>
            )}
          </div>
        </div>


        {/* Barra de Busca (Centro) */}
        <div className="hidden lg:flex flex-1 max-w-xl mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-secondary/50 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-muted-foreground/50 transition-colors"
            />
          </div>
        </div>


        {/* Ações do Usuário (Direita) */}
        <div className="flex items-center gap-2">
          {/* Botão de Busca Mobile */}
          <Button variant="ghost" size="icon" className="lg:hidden text-gray-600 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent">
            <Search className="h-5 w-5" />
          </Button>

          {/* Notificações */}
          <div className="relative" ref={notificationsRef}>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-gray-600 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium px-1 shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Dropdown de Notificações */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-popover rounded-lg shadow-lg dark:shadow-shadow-dark border border-gray-200 dark:border-border z-50">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground">Notificações</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs rounded-full font-medium">
                        {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {!isConnected && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-full font-medium">
                        Desconectado
                      </span>
                    )}
                  </div>
                </div>

                {/* Erro */}
                {connectionError && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/30">
                    <p className="text-xs text-red-600 dark:text-red-400">{connectionError}</p>
                  </div>
                )}

                {/* Conteúdo */}
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="h-8 w-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-muted-foreground">Sem notificações</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Você está em dia!</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {notifications.map((notification) => {
                      const Icon = getNotificationIcon(notification.type);
                      const isUnread = !notification.read;

                      return (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 border-b border-gray-100 dark:border-border last:border-b-0 cursor-pointer transition-colors ${isUnread ? 'bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-muted/50'
                            }`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Ícone e indicador de não lida */}
                            <div className="flex-shrink-0 relative">
                              <Icon className={`h-4 w-4 mt-1 ${notification.type === 'error' ? 'text-red-600 dark:text-red-400' :
                                notification.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                                  notification.type === 'success' ? 'text-green-600 dark:text-green-400' :
                                    'text-blue-600 dark:text-blue-400'
                                }`} />
                              {isUnread && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900 dark:text-foreground' : 'font-medium text-gray-700 dark:text-muted-foreground'
                                  }`}>
                                  {notification.title}
                                </p>

                                {/* Badge de tipo */}
                                {notification.type !== 'info' && (
                                  <span className={`px-2 py-1 text-xs rounded-full font-medium flex-shrink-0 ${notification.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                                    notification.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                                      notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                        'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                    }`}>
                                    {notification.type === 'error' ? 'Erro' :
                                      notification.type === 'warning' ? 'Aviso' :
                                        notification.type === 'success' ? 'Sucesso' : 'Info'}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-gray-500 dark:text-muted-foreground/80 mt-1 line-clamp-2">
                                {notification.description}
                              </p>

                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
                                  <span>{formatNotificationTime(notification.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-border flex items-center justify-between bg-gray-50 dark:bg-muted/30 rounded-b-lg">
                  {notifications.length > 0 && (
                    <button
                      onClick={async () => {
                        await markAllAsRead();
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
                      disabled={unreadCount === 0}
                    >
                      Marcar todas como lidas
                    </button>
                  )}

                  <a
                    href="/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground font-medium flex items-center gap-1 transition-colors"
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
              className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-accent transition-colors"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {/* Logo do Tenant do Usuário */}
              {userTenantLogo ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-secondary border border-gray-200 dark:border-border">
                  <Image
                    src={`${API_URL}/uploads/logos/${userTenantLogo}?t=${Date.now()}`}
                    alt="Logo Tenant"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                    onError={(e) => {
                      console.error('Erro ao carregar logo do tenant no menu:', userTenantLogo);
                      const target = e.currentTarget as HTMLImageElement;
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
                          src={`${API_URL}/uploads/logos/${userTenantLogo}?t=${Date.now()}`}
                          alt="Logo Tenant"
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          unoptimized
                          onError={(e) => {
                            console.error('Erro ao carregar logo do tenant no dropdown:', userTenantLogo);
                            const target = e.currentTarget as HTMLImageElement;
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

                {/* Itens do Menu do Usuário (Module Registry) */}
                <ModuleRegistryUserMenu onItemClick={() => setShowUserMenu(false)} />

                {/* Versão do Sistema */}
                {user?.role === "SUPER_ADMIN" ? (
                  <a
                    href="/configuracoes/sistema/updates"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-foreground hover:bg-gray-100 dark:hover:bg-accent flex items-center gap-2 transition-colors"
                    title="Clique para gerenciar atualizações"
                  >
                    <Info className="h-4 w-4 text-gray-500 dark:text-muted-foreground" />
                    <div>
                      <span className="text-xs text-gray-600 dark:text-muted-foreground">Versão do Sistema</span>
                      <div className="text-xs font-mono font-medium text-gray-800 dark:text-foreground">v{systemVersion}</div>
                    </div>
                  </a>
                ) : (
                  <div className="px-4 py-2 text-left text-sm text-gray-500 dark:text-muted-foreground flex items-center gap-2 cursor-default">
                    <Info className="h-4 w-4 text-gray-400 dark:text-slate-600" />
                    <div>
                      <span className="text-xs">Versão do Sistema</span>
                      <div className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300">v{systemVersion}</div>
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
