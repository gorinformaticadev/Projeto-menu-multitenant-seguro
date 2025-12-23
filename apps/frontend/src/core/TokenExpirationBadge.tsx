"use client";

import { useTokenExpiration } from "@/hooks/useTokenExpiration";
import { Clock } from "lucide-react";

/**
 * Badge que mostra o tempo restante do token
 * Útil para desenvolvimento e debug
 */
export function TokenExpirationBadge() {
  const timeRemaining = useTokenExpiration();

  if (timeRemaining === null) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  const getColor = () => {
    if (timeRemaining > 300) return "bg-green-500"; // > 5 min
    if (timeRemaining > 60) return "bg-yellow-500"; // > 1 min
    return "bg-red-500"; // < 1 min
  };

  return (
    <div
      className={`fixed top-4 right-4 ${getColor()} text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 text-xs z-50`}
    >
      <Clock className="h-3 w-3" />
      <span>
        Token: {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
