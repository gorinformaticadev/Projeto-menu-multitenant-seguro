"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Settings, LogOut, Shield } from "lucide-react";
import { Button } from "./ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

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
    <div className="flex flex-col h-full bg-card border-r">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <div className="bg-primary rounded-lg p-2">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Sistema</h2>
            <p className="text-xs text-muted-foreground">Multitenant</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <div className="mt-2 inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
            {user?.role}
          </div>
          {user?.tenant && (
            <p className="text-xs text-muted-foreground mt-1">
              {user.tenant.nomeFantasia}
            </p>
          )}
        </div>

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
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={logout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );
}
