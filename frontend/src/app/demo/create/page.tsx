'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';

const DemoCreate = dynamic(
  () => import('../../../../../modules/demo-completo/src/components/DemoCreate').then(mod => mod.DemoCreate),
  {
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    ),
    ssr: false,
  }
);

export default function DemoCreatePage() {
  return <DemoCreate />;
}
