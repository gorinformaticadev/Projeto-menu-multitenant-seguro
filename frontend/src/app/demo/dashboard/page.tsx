'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';

const DemoDashboard = dynamic(
  () => import('../../../../../modules/demo-completo/src/components/DemoDashboard').then(mod => mod.DemoDashboard),
  {
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    ),
    ssr: false,
  }
);

export default function DemoDashboardPage() {
  return <DemoDashboard />;
}
