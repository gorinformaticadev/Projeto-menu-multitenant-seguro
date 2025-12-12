import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface TwoFactorStatus {
  enabled: boolean;
  suggested: boolean;
}

export function use2FAStatus() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        setLoading(true);
        // Primeiro tenta obter o status do usuário
        const userResponse = await api.get('/auth/2fa/status');
        setStatus(userResponse.data);
      } catch (err) {
        try {
          // Se falhar, tenta obter a configuração global
          const configResponse = await api.get('/security-config/2fa-status');
          setStatus({
            enabled: configResponse.data.enabled || false,
            suggested: true, // Por padrão, sugerimos 2FA
          });
        } catch (configErr) {
          setError('Falha ao carregar status de 2FA');
          // Valores padrão se ambos falharem
          setStatus({
            enabled: false,
            suggested: true,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetch2FAStatus();
  }, []);

  return { status, loading, error };
}
