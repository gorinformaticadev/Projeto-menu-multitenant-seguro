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
    <nav className="mb-6 flex items-center space-x-2 text-sm text-skin-text-muted">
      <Link 
        href="/configuracoes" 
        className="flex items-center gap-1 transition-colors hover:text-skin-text"
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
              className="transition-colors hover:text-skin-text"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-skin-text">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
