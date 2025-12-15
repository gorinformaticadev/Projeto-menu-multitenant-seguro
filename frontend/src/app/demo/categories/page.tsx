'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';

const CategoryManager = dynamic(
  () => import('../../../../../modules/demo-completo/src/components/CategoryManager').then(mod => mod.CategoryManager),
  {
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    ),
    ssr: false,
  }
);

export default function CategoriesPage() {
  return <CategoryManager />;
}
