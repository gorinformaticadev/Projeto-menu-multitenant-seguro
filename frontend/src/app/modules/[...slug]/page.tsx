"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { AllModuleRoutes } from '../../../lib/modules-registry';
import { match } from 'path-to-regexp'; // Se disponível, ou implementar logic simples

// match simples para evitar dep extra se não estiver instalada, 
// mas se o projeto já tiver, melhor.
// Vou usar lógica manual robusta para garantir zero deps novas.

export default function DynamicModulePage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug : [params.slug];
  const currentPath = '/' + slug.join('/');

  // Lógica de Match
  let ComponentToRender = null;
  let matchParams = {};

  // Debug: Verificar o que está chegando e o que temos registrado
  console.log('🔍 [DynamicModulePage] Debug:', { 
    currentPath, 
    routesCount: AllModuleRoutes.length, 
    availablePaths: AllModuleRoutes.map(r => r.path),
    slug,
    params 
  });

  for (const route of AllModuleRoutes) {

    // 1. Match Exato
    if (route.path === currentPath) {
      ComponentToRender = route.component;
      break;
    }

    // 2. Match com Parâmetros (ex: /demo/edit/:id)
    if (route.path.includes(':')) {
      const routeSegments = route.path.split('/').filter(Boolean);
      const pathSegments = currentPath.split('/').filter(Boolean);

      if (routeSegments.length === pathSegments.length) {
        let isMatch = true;
        const currentParams: any = {};

        for (let i = 0; i < routeSegments.length; i++) {
          const rSeg = routeSegments[i];
          const pSeg = pathSegments[i];

          if (rSeg.startsWith(':')) {
            const paramName = rSeg.slice(1);
            currentParams[paramName] = pSeg;
          } else if (rSeg !== pSeg) {
            isMatch = false;
            break;
          }
        }

        if (isMatch) {
          ComponentToRender = route.component;
          matchParams = currentParams;
          break;
        }
      }
    }
  }

  if (!ComponentToRender) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
        <h2 className="text-2xl font-bold mb-2">Página não encontrada</h2>
        <p>A rota <code>{currentPath}</code> não foi definida em nenhum módulo.</p>
      </div>
    );
  }

  // O componente pode esperar props, mas page top-level geralmente pega params via hook ou context
  // Se o componente espera props, podemos passar matchParams
  return <ComponentToRender params={matchParams} />;
}