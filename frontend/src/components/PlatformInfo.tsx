"use client";

import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { Building2, Mail, Phone } from "lucide-react";

interface PlatformInfoProps {
  showEmail?: boolean;
  showPhone?: boolean;
  className?: string;
}

/**
 * Componente para exibir informações da plataforma
 * Usa as configurações dinâmicas do banco de dados
 */
export default function PlatformInfo({ 
  showEmail = false, 
  showPhone = false, 
  className = "" 
}: PlatformInfoProps) {
  const { config, loading } = usePlatformConfig();

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Building2 className="h-4 w-4 animate-pulse" />
        <span className="animate-pulse">Carregando...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        <span className="font-medium">{config.platformName}</span>
      </div>
      
      {showEmail && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span>{config.platformEmail}</span>
        </div>
      )}
      
      {showPhone && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-3 w-3" />
          <span>{config.platformPhone}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Componente simples para exibir apenas o nome da plataforma
 */
export function PlatformName({ className = "" }: { className?: string }) {
  const { platformName, loading } = usePlatformConfig();

  if (loading) {
    return <span className={`animate-pulse ${className}`}>Carregando...</span>;
  }

  return <span className={className}>{platformName}</span>;
}

/**
 * Componente para exibir informações de contato completas
 */
export function PlatformContact({ className = "" }: { className?: string }) {
  return (
    <PlatformInfo 
      showEmail={true} 
      showPhone={true} 
      className={className} 
    />
  );
}