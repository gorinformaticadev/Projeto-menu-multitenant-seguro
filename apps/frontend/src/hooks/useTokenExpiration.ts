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
    const checkExpiration = () => {
      if (typeof window === "undefined") return;

      const encryptedToken = localStorage.getItem("@App:token");
      if (!encryptedToken) {
        setTimeRemaining(null);
        return;
      }

      try {
        // Descriptografar e decodificar payload do JWT
        const token = atob(encryptedToken);
        const payload = JSON.parse(atob(token.split(".")[1]));
        const exp = payload.exp * 1000; // Converter para milliseconds
        const now = Date.now();
        const remaining = Math.floor((exp - now) / 1000); // Segundos restantes

        setTimeRemaining(remaining > 0 ? remaining : 0);
      } catch (error) {
        setTimeRemaining(null);
      }
    };

    // Verificar imediatamente
    checkExpiration();

    // Verificar a cada 10 segundos
    const interval = setInterval(checkExpiration, 10000);

    return () => clearInterval(interval);
  }, [user]);

  return timeRemaining;
}
