"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformConfigContext } from "@/contexts/PlatformConfigContext";
import { useSystemVersion } from "@/hooks/useSystemVersion";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Button } from "./ui/button";
import { Search, User, LogOut, Info, Settings } from "lucide-react";
import { ModuleRegistryUserMenu } from "./ModuleRegistryUserMenu";
import { GlobalSearch } from "./GlobalSearch";
import { SystemNotificationsBell } from "@/components/system-notifications/SystemNotificationsBell";
import { SystemNotificationsDrawer } from "@/components/system-notifications/SystemNotificationsDrawer";
import { resolveTenantLogoSrc } from "@/lib/tenant-logo";

export function TopBar() {
  const { user, logout } = useAuth();
  const { config: platformConfig } = usePlatformConfigContext();
  const { version: systemVersion } = useSystemVersion();
  const [userAvatarCacheBuster, setUserAvatarCacheBuster] = useState<number>(() => Date.now());
  const [userAvatarFailed, setUserAvatarFailed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const platformName = platformConfig.platformName;
  const platformLogoSrc = resolveTenantLogoSrc(platformConfig.platformBrandLogoUrl);
  const userAvatarSrc = resolveTenantLogoSrc(user?.avatarUrl, {
    cacheBuster: userAvatarCacheBuster,
  });
  const effectiveUserAvatarSrc = userAvatarFailed ? null : userAvatarSrc;
  const userInitial = user?.name?.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    setUserAvatarFailed(false);
    setUserAvatarCacheBuster(Date.now());
  }, [user?.avatarUrl]);

  const userMenuRef = useClickOutside<HTMLDivElement>(() => {
    setShowUserMenu(false);
  });

  const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );

  const renderUserAvatar = (sizeClassName: string, textSizeClassName: string) => {
    if (effectiveUserAvatarSrc) {
      return (
        <div
          className={`flex items-center justify-center overflow-hidden rounded-full border border-skin-border bg-skin-secondary ${sizeClassName}`}
        >
          <Image
            src={effectiveUserAvatarSrc}
            alt={`Avatar de ${user?.name || "usuario"}`}
            width={40}
            height={40}
            unoptimized
            className="h-full w-full object-cover"
            onError={() => setUserAvatarFailed(true)}
          />
        </div>
      );
    }

    return (
      <div
        className={`flex items-center justify-center rounded-full bg-skin-primary text-skin-text-inverse shadow-md ${sizeClassName} ${textSizeClassName}`}
      >
        {userInitial}
      </div>
    );
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-skin-border/80 bg-skin-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-skin-surface/85 dark:bg-skin-surface/90">
      <div
        className={`absolute inset-0 z-50 flex items-center bg-skin-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-skin-surface/90 transition-transform duration-300 ${
          showMobileSearch ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowMobileSearch(false)}
          className="mr-2 flex-shrink-0 text-skin-text-muted"
          aria-label="Fechar busca"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <GlobalSearch mobile onClose={() => setShowMobileSearch(false)} />
      </div>

      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {platformLogoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={platformLogoSrc}
                alt={`Logo da plataforma ${platformName}`}
                className="h-10 w-auto max-w-40 object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-skin-primary shadow-md">
                <span className="text-lg font-bold text-skin-text-inverse">
                  {platformName.trim().charAt(0).toUpperCase() || "S"}
                </span>
              </div>
            )}
          </div>

          <div className="flex max-w-[120px] flex-col md:max-w-none">
            <h1 className="truncate text-sm font-bold leading-tight text-skin-text md:text-lg">
              {platformName}
            </h1>
            {user?.tenant && (
              <p className="truncate text-xs text-skin-text-muted">{user.tenant.nomeFantasia}</p>
            )}
          </div>
        </div>

        <div className="mx-4 hidden max-w-xl flex-1 lg:flex">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-skin-text-muted hover:bg-skin-menu-hover lg:hidden"
            onClick={() => setShowMobileSearch(true)}
            aria-label="Abrir busca"
          >
            <Search className="h-5 w-5" />
          </Button>

          {user?.role === "SUPER_ADMIN" && (
            <>
              <SystemNotificationsBell />
              <SystemNotificationsDrawer />
            </>
          )}

          <div className="relative" ref={userMenuRef}>
            <Button
              variant="ghost"
              className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-skin-menu-hover md:rounded-xl md:px-3 md:py-2"
              onClick={() => setShowUserMenu((current) => !current)}
              aria-label="Abrir menu do usuario"
            >
              {renderUserAvatar("h-8 w-8", "text-sm font-semibold")}
              <div className="hidden text-left md:block">
                {user?.tenant?.nomeFantasia && (
                  <p className="truncate text-sm font-medium text-skin-primary">
                    {user.tenant.nomeFantasia}
                  </p>
                )}
                <p className="text-sm font-medium text-skin-text">{user?.name}</p>
                <p className="text-[10px] text-skin-text-muted">{user?.role}</p>
              </div>
            </Button>

            {showUserMenu && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-skin-border/80 bg-skin-surface py-2 shadow-lg">
                <div className="border-b border-skin-border px-4 py-2">
                  <div className="mb-2 flex items-center gap-3">
                    {renderUserAvatar("h-10 w-10 flex-shrink-0", "text-base font-semibold")}
                    <div className="min-w-0 flex-1">
                      {user?.tenant?.nomeFantasia && (
                        <p className="mb-1 truncate text-sm font-medium text-skin-primary">
                          {user.tenant.nomeFantasia}
                        </p>
                      )}
                      <p className="truncate text-sm font-medium text-skin-text">{user?.name}</p>
                      <p className="truncate text-xs text-skin-text-muted">{user?.email}</p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/perfil"
                  onClick={() => setShowUserMenu(false)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-skin-text transition-colors hover:bg-skin-menu-hover"
                >
                  <User className="h-4 w-4 text-skin-text-muted" />
                  Meu Perfil
                </Link>

                {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
                  <Link
                    href="/configuracoes"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-skin-text transition-colors hover:bg-skin-menu-hover"
                  >
                    <Settings className="h-4 w-4 text-skin-text-muted" />
                    Configuracoes
                  </Link>
                )}

                <ModuleRegistryUserMenu onItemClick={() => setShowUserMenu(false)} />

                {user?.role === "SUPER_ADMIN" ? (
                  <Link
                    href="/configuracoes/sistema/updates"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-skin-text transition-colors hover:bg-skin-menu-hover"
                    title="Clique para gerenciar atualizacoes"
                  >
                    <Info className="h-4 w-4 text-skin-text-muted" />
                    <div>
                      <span className="text-xs text-skin-text-muted">Versao do Sistema</span>
                      <div className="text-xs font-mono font-medium text-skin-text">
                        {systemVersion}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="flex cursor-default items-center gap-2 px-4 py-2 text-left text-sm text-skin-text-muted">
                    <Info className="h-4 w-4 text-skin-text-muted/70" />
                    <div>
                      <span className="text-xs">Versao do Sistema</span>
                      <div className="text-xs font-mono font-medium text-skin-text/85">
                        {systemVersion}
                      </div>
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
