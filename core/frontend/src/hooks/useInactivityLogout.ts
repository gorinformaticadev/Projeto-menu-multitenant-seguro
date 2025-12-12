import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para logout automático por inatividade
 * @param timeoutMinutes - Tempo de inatividade em minutos antes de deslogar
 */
export function useInactivityLogout(timeoutMinutes: number = 30) {
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    // Limpar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Não iniciar timer se não houver usuário logado
    if (!user) return;

    const timeoutMs = timeoutMinutes * 60 * 1000; // Converter minutos para ms
    const warningMs = timeoutMs - 60 * 1000; // Avisar 1 minuto antes

    // Timer de aviso (1 minuto antes do logout)
    warningTimeoutRef.current = setTimeout(() => {
      toast({
        title: "Sessão expirando",
        description: "Você será deslogado em 1 minuto por inatividade. Mova o mouse ou pressione uma tecla para continuar.",
        variant: "default",
      });
    }, warningMs);

    // Timer de logout
    timeoutRef.current = setTimeout(() => {
      toast({
        title: "Sessão expirada",
        description: "Você foi deslogado por inatividade.",
        variant: "destructive",
      });
      logout();
    }, timeoutMs);
  }, [timeoutMinutes, user, logout, toast]);

  useEffect(() => {
    // Eventos que resetam o timer
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Adicionar listeners
    events.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    // Iniciar timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [resetTimer]);
}
