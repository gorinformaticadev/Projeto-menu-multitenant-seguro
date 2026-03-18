"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook para monitorar a expiração do token
 * Retorna o tempo restante em segundos
 */
export function useTokenExpiration() {
  const { user } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    setTimeRemaining(null);
    return () => {
      setTimeRemaining(null);
    };
  }, [user]);

  return timeRemaining;
}
