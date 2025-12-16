import React from 'react';
import { useRouter } from 'next/router';
import { DemoView } from '../../components/DemoView';
import { Box } from '@mui/material';

export default function DemoViewPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id || typeof id !== 'string') {
    return <Box sx={{ p: 3 }}>Carregando...</Box>;
  }

  return (
    <Box>
      <DemoView demoId={id} />
    </Box>
  );
}
