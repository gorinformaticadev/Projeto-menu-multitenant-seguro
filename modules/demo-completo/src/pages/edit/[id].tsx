import React from 'react';
import { useRouter } from 'next/router';
import { DemoEdit } from '../../components/DemoEdit';
import { Box } from '@mui/material';

export default function DemoEditPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id || typeof id !== 'string') {
    return <Box sx={{ p: 3 }}>Carregando...</Box>;
  }

  return (
    <Box>
      <DemoEdit demoId={id} />
    </Box>
  );
}
