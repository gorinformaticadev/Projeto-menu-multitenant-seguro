'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';

// Importar componente dinamicamente para evitar SSR issues
const DemoList = dynamic(
  () => import('../../../../modules/demo-completo/src/components/DemoList').then(mod => mod.DemoList),
  {
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    ),
    ssr: false,
  }
);

export default function DemoPage() {
  return <DemoList />;
}
