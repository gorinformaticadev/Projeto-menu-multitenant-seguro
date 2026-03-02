import { useState, useEffect } from 'react';
import api from '@/lib/api';
import frontendPackage from '../../package.json';

/**
 * Hook para gerenciar a versão do sistema
 * 
 * Busca a versão do sistema de múltiplas fontes:
 * 1. API de updates (se disponível)
 * 2. Package.json do frontend
 * 3. Versão padrão como fallback
 */
export function useSystemVersion() {
  const localPackageVersion = normalizeVersion(frontendPackage.version || '0.0.0');
  const [version, setVersion] = useState<string>(localPackageVersion);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'system-api' | 'update-api' | 'package'>('package');

  useEffect(() => {
    const fetchVersion = async () => {
      setLoading(true);
      
      try {
        const response = await api.get('/api/system/version');
        if (response.data?.version) {
          setVersion(normalizeVersion(response.data.version));
          setSource('system-api');
          setLoading(false);
          return;
        }
      } catch {
        console.log('API de versão do sistema não disponível, tentando status de updates');
      }

      try {
        // Segundo tenta buscar da API de updates
        const response = await api.get('/api/update/status');
        if (response.data?.currentVersion) {
          setVersion(normalizeVersion(response.data.currentVersion));
          setSource('update-api');
          setLoading(false);
          return;
        }
      } catch {
        console.log('API de updates não disponível, usando package.json local');
      }

      // Fallback para versão do package local (buildado com pnpm version/release)
      setVersion(localPackageVersion);
      setSource('package');
      setLoading(false);
    };

    fetchVersion();
  }, [localPackageVersion]);

  /**
   * Força uma nova busca da versão
   */
  const refreshVersion = async () => {
    setLoading(true);
    
    try {
      const response = await api.get('/api/system/version');
      if (response.data?.version) {
        setVersion(normalizeVersion(response.data.version));
        setSource('system-api');
        return;
      }

      const updateResponse = await api.get('/api/update/status');
      if (updateResponse.data?.currentVersion) {
        setVersion(normalizeVersion(updateResponse.data.currentVersion));
        setSource('update-api');
      }
    } catch (error) {
      console.log('Erro ao atualizar versão:', error);
      setVersion(localPackageVersion);
      setSource('package');
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

function normalizeVersion(value: string): string {
  return String(value || '').replace(/^v/i, '').trim() || '0.0.0';
}
