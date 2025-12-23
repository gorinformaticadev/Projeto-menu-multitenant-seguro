import { useState, useEffect } from 'react';
import api from '@/lib/api';

/**
 * Hook para gerenciar a versão do sistema
 * 
 * Busca a versão do sistema de múltiplas fontes:
 * 1. API de updates (se disponível)
 * 2. Package.json do frontend
 * 3. Versão padrão como fallback
 */
export function useSystemVersion() {
  const [version, setVersion] = useState<string>('1.0.0');
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'package' | 'default'>('default');

  useEffect(() => {
    const fetchVersion = async () => {
      setLoading(true);
      
      try {
        // Primeiro tenta buscar da API de updates
        const response = await api.get('/api/update/status');
        if (response.data?.currentVersion) {
          setVersion(response.data.currentVersion);
          setSource('api');
          setLoading(false);
          return;
        }
      } catch (error) {
        console.log('API de updates não disponível, tentando package.json');
      }

      try {
        // Se não conseguir da API, tenta buscar do package.json
        const packageResponse = await fetch('/package.json');
        if (packageResponse.ok) {
          const packageData = await packageResponse.json();
          if (packageData.version) {
            setVersion(packageData.version);
            setSource('package');
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log('Package.json não disponível, usando versão padrão');
      }

      // Fallback para versão padrão
      setVersion('1.0.0');
      setSource('default');
      setLoading(false);
    };

    fetchVersion();
  }, []);

  /**
   * Força uma nova busca da versão
   */
  const refreshVersion = async () => {
    setLoading(true);
    
    try {
      const response = await api.get('/api/update/status');
      if (response.data?.currentVersion) {
        setVersion(response.data.currentVersion);
        setSource('api');
      }
    } catch (error) {
      console.log('Erro ao atualizar versão:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    version,
    loading,
    source,
    refreshVersion,
  };
}