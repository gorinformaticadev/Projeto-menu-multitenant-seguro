import React from 'react';
import { Box, Typography } from '@mui/material';

export default function SistemaAjustesPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Ajustes
      </Typography>
      <Typography variant="body1">
        Seu conteúdo vai aqui
      </Typography>
    </Box>
  );
}