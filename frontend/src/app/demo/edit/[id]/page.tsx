'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';
import { useParams } from 'next/navigation';

const DemoEdit = dynamic(
  () => import('../../../../../../modules/demo-completo/src/components/DemoEdit').then(mod => mod.DemoEdit),
  {
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    ),
    ssr: false,
  }
);

export default function DemoEditPage() {
  const params = useParams();
  const id = params?.id as string;

  if (!id) {
    return <Box sx={{ p: 3 }}>ID não encontrado</Box>;
  }

  return <DemoEdit demoId={id} />;
}
