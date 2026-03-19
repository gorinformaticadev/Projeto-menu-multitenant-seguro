"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

/**
 * Componente que mostra um indicador quando o token esta sendo renovado
 * Util para debug e feedback ao usuario
 */
export function TokenRefreshIndicator() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const handleRefreshStart = () => setIsRefreshing(true);
    const handleRefreshEnd = () => setIsRefreshing(false);

    window.addEventListener("token-refresh-start", handleRefreshStart);
    window.addEventListener("token-refresh-end", handleRefreshEnd);

    return () => {
      window.removeEventListener("token-refresh-start", handleRefreshStart);
      window.removeEventListener("token-refresh-end", handleRefreshEnd);
    };
  }, []);

  if (!isRefreshing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex animate-pulse items-center gap-2 rounded-lg bg-skin-info px-4 py-2 text-skin-text-inverse shadow-lg">
      <Shield className="h-4 w-4" />
      <span className="text-sm">Renovando sessao...</span>
    </div>
  );
}
