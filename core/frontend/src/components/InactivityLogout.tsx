"use client";

import { useSecurityConfig } from '@/contexts/SecurityConfigContext';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

/**
 * Componente que gerencia o logout automático por inatividade
 * Usa a configuração do contexto global
 */
export function InactivityLogout() {
  const { config } = useSecurityConfig();
  const timeoutMinutes = config?.sessionTimeoutMinutes ?? 30;

  // Aplicar o hook de inatividade
  useInactivityLogout(timeoutMinutes);

  // Este componente não renderiza nada
  return null;
}
