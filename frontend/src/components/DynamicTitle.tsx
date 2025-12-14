/**
 * COMPONENTE PARA TÍTULO DINÂMICO DA PLATAFORMA
 * 
 * Atualiza o título da página baseado na configuração da plataforma
 */

"use client";

import { useEffect } from 'react';
import { usePlatformName } from '@/hooks/usePlatformConfig';

export function DynamicTitle() {
  const { platformName } = usePlatformName();

  useEffect(() => {
    if (platformName) {
      document.title = platformName;
    }
  }, [platformName]);

  return null; // Este componente não renderiza nada visualmente
}