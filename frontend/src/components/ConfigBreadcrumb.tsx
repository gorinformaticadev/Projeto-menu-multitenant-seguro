"use client";

import Link from "next/link";
import { ChevronRight, Settings } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ConfigBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function ConfigBreadcrumb({ items }: ConfigBreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
      <Link 
        href="/configuracoes" 
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Settings className="h-4 w-4" />
        Configurações
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <ChevronRight className="h-4 w-4" />
          {item.href ? (
            <Link 
              href={item.href} 
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}