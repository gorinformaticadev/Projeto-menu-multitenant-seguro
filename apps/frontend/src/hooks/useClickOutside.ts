import { useEffect, useRef } from 'react';

/**
 * Hook para detectar cliques fora de um elemento
 * 
 * @param handler - Função a ser executada quando clicar fora
 * @returns ref - Referência para o elemento que deve detectar cliques externos
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  handler: () => void
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    // Adicionar listener quando o componente monta
    document.addEventListener('mousedown', handleClickOutside);
    
    // Remover listener quando o componente desmonta
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handler]);

  return ref;
}