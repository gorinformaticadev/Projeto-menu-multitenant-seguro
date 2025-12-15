'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';

const TagManager = dynamic(
  () => import('../../../../../modules/demo-completo/src/components/TagManager').then(mod => mod.TagManager),
  {
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    ),
    ssr: false,
  }
);

export default function TagsPage() {
  return <TagManager />;
}
