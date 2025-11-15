"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Settings, LogOut, Shield, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Recolhe o menu ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isExpanded &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded]);

  const menuItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      show: true,
    },
    {
      name: "Empresas",
      href: "/empresas",
      icon: Building2,
      show: user?.role === "SUPER_ADMIN",
    },
    {
      name: "Configurações",
      href: "/configuracoes",
      icon: Settings,
      show: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN",
    },
  ];

  return (
    <div 
      ref={sidebarRef}
      className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-300",
        isExpanded ? "w-64" : "w-20"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        {isExpanded ? (
          <div className="flex items-center gap-2">
            <div className="bg-primary rounded-lg p-2">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Sistema</h2>
              <p className="text-xs text-muted-foreground">Multitenant</p>
            </div>
          </div>
        ) : (
          <div className="bg-primary rounded-lg p-2 mx-auto">
            <Shield className="h-6 w-6 text-white" />
          </div>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "h-8 w-8 transition-all",
            !isExpanded && "mx-auto mt-2"
          )}
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* User Info */}
      <div className="flex-1 p-4">
        {isExpanded ? (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <div className="mt-2 inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
              {user?.role}
            </div>
            {user?.tenant && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {user.tenant.nomeFantasia}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 flex justify-center">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            if (!item.show) return null;

            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  !isExpanded && "justify-center"
                )}
                title={!isExpanded ? item.name : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isExpanded && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className={cn(
            "w-full",
            isExpanded ? "justify-start" : "justify-center px-2"
          )}
          onClick={logout}
          title={!isExpanded ? "Sair" : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {isExpanded && <span className="ml-3">Sair</span>}
        </Button>
      </div>
    </div>
  );
}
