/**
 * COMPONENTE DO DASHBOARD - MÓDULO SISTEMA
 *
 * Este componente exibe o conteúdo principal do dashboard do módulo sistema.
 * Ele é utilizado pela página SistemaDashboardPage.
 *
 * O componente utiliza componentes do Material-UI para criar uma interface
 * responsiva com cards e grid layout.
 */

// Importações necessárias do React e Material-UI
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
} from '@mui/material';

/**
 * Componente principal do dashboard do módulo sistema
 *
 * Esta função cria um componente React que exibe o conteúdo do dashboard.
 * Inclui um título principal e um card com informações do módulo.
 *
 * @returns {JSX.Element} Elemento JSX representando o dashboard do módulo
 */
export const SistemaDashboard: React.FC = () => {
  return (
    // Contêiner principal do dashboard com padding
    <Box sx={{ p: 3 }}>
      {/* Título principal do dashboard */}
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard - Módulo Sistema
      </Typography>

      {/* Grid container para layout responsivo */}
      <Grid container spacing={3}>
        {/* Coluna do grid (ocupando 12 unidades em telas pequenas e 6 em médias+) */}
        <Grid item xs={12} md={6}>
          {/* Card contendo informações do módulo */}
          <Card>
            <CardContent>
              {/* Título do card */}
              <Typography variant="h6" gutterBottom>
                Widget do Sistema
              </Typography>
              {/* Conteúdo do card */}
              <Typography variant="body1">
                Informações do módulo funcionando perfeitamente.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SistemaDashboard;