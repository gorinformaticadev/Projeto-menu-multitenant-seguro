/**
 * PÁGINA DO DASHBOARD - MÓDULO SISTEMA
 *
 * Esta é a página principal do módulo sistema.
 * Ela serve como um contêiner para o componente SistemaDashboard.
 *
 * A página é acessada através da rota /modules/sistema/dashboard
 * conforme definido em frontend/routes.tsx
 */

// Importações necessárias do React e Material-UI
import React from 'react';
import { SistemaDashboard } from '../components/SistemaDashboard';
import { Box } from '@mui/material';

/**
 * Componente de página do dashboard do módulo sistema
 *
 * Esta função cria uma página React que renderiza o componente SistemaDashboard.
 * O Box do Material-UI é usado como contêiner principal.
 *
 * @returns {JSX.Element} Elemento JSX representando a página do dashboard
 */
export default function SistemaDashboardPage() {
  return (
    // Contêiner principal da página
    <Box>
      {/* Renderiza o componente principal do dashboard */}
      <SistemaDashboard />
    </Box>
  );
}