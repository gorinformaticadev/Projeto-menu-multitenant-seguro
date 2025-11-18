"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Settings, LogOut, ChevronLeft, User, Menu, Shield, FileText } from "lucide-react";
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
      name: "Usuários",
      href: "/usuarios",
      icon: User,
      show: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN",
    },
    {
      name: "Logs de Auditoria",
      href: "/logs",
      icon: FileText,
      show: user?.role === "SUPER_ADMIN",
    },
    {
      name: "Configurações",
      href: "/configuracoes",
      icon: Settings,
      show: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN",
      submenu: user?.role === "SUPER_ADMIN" ? [
        {
          name: "Geral",
          href: "/configuracoes",
        },
        {
          name: "Segurança",
          href: "/configuracoes/seguranca",
          icon: Shield,
        },
      ] : undefined,
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
      <div className="p-4 border-b flex items-center justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 w-8"
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4">
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
