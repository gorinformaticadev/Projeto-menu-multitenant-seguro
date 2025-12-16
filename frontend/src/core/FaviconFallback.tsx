"use client";

import { useEffect } from 'react';

export function FaviconFallback() {
  useEffect(() => {
    // Criar favicon.ico dinamicamente se não existir
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    
    if (!link) {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.type = 'image/svg+xml';
      newLink.href = '/favicon.svg';
      document.head.appendChild(newLink);
    }
  }, []);

  return null;
}
