import React, { useState, useEffect } from 'react';
import { useDemos, useCategories, useTags, DemoFilters } from '../hooks/useDemos';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Stack,
  Pagination,
  CircularProgress,
  Alert,
  InputAdornment,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  ThumbUp as ThumbUpIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';

export const DemoList: React.FC = () => {
  const router = useRouter();
  const [filters, setFilters] = useState<DemoFilters>({
    search: '',
    status: '',
    categoryId: '',
    tagId: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 12,
  });

  const { demos, loading, error, pagination, fetchDemos, deleteDemo, likeDemo } = useDemos();
  const { categories } = useCategories();
  const { tags } = useTags();

  useEffect(() => {
    fetchDemos(filters);
  }, [filters, fetchDemos]);

  const handleFilterChange = (field: keyof DemoFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setFilters(prev => ({ ...prev, page: value }));
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja deletar este demo?')) {
      const success = await deleteDemo(id);
      if (success) {
        fetchDemos(filters);
      }
    }
  };

  const handleLike = async (id: string) => {
    await likeDemo(id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published':
        return 'Publicado';
      case 'draft':
        return 'Rascunho';
      case 'archived':
        return 'Arquivado';
      default:
        return status;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Demos do Sistema Modular
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => router.push('/demo/create')}
        >
          Novo Demo
        </Button>
      </Box>

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Buscar"
                placeholder="Buscar por título ou descrição..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="published">Publicado</MenuItem>
                  <MenuItem value="draft">Rascunho</MenuItem>
                  <MenuItem value="archived">Arquivado</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Categoria</InputLabel>
                <Select
                  value={filters.categoryId}
                  label="Categoria"
                  onChange={(e) => handleFilterChange('categoryId', e.target.value)}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Tag</InputLabel>
                <Select
                  value={filters.tagId}
                  label="Tag"
                  onChange={(e) => handleFilterChange('tagId', e.target.value)}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {tags.map((tag) => (
                    <MenuItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Ordenar por</InputLabel>
                <Select
                  value={filters.sortBy}
                  label="Ordenar por"
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  <MenuItem value="createdAt">Data de criação</MenuItem>
                  <MenuItem value="title">Título</MenuItem>
                  <MenuItem value="priority">Prioridade</MenuItem>
                  <MenuItem value="viewsCount">Visualizações</MenuItem>
                  <MenuItem value="likesCount">Curtidas</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Loading & Error */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Lista de Demos */}
      {!loading && demos.length === 0 && (
        <Alert severity="info">
          Nenhum demo encontrado. Crie o primeiro demo!
        </Alert>
      )}

      <Grid container spacing={3}>
        {demos.map((demo) => (
          <Grid item xs={12} sm={6} md={4} key={demo.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-4px)',
                  transition: 'all 0.3s ease'
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                {/* Status e Prioridade */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Chip
                    label={getStatusLabel(demo.status)}
                    color={getStatusColor(demo.status)}
                    size="small"
                  />
                  {demo.priority > 5 && (
                    <Chip label="Alta Prioridade" color="error" size="small" />
                  )}
                </Box>

                {/* Título */}
                <Typography
                  variant="h6"
                  component="h2"
                  gutterBottom
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {demo.title}
                </Typography>

                {/* Descrição */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {demo.description || 'Sem descrição'}
                </Typography>

                {/* Categorias */}
                {demo.categories && demo.categories.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {demo.categories.map((cat) => (
                      <Chip
                        key={cat.id}
                        label={cat.name}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: cat.color, color: cat.color }}
                      />
                    ))}
                  </Stack>
                )}

                {/* Tags */}
                {demo.tags && demo.tags.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {demo.tags.slice(0, 3).map((tag) => (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        size="small"
                        sx={{
                          bgcolor: tag.color || '#e0e0e0',
                          color: '#fff',
                          fontSize: '0.7rem'
                        }}
                      />
                    ))}
                    {demo.tags.length > 3 && (
                      <Chip label={`+${demo.tags.length - 3}`} size="small" />
                    )}
                  </Stack>
                )}

                {/* Stats */}
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <VisibilityIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      {demo.viewsCount}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ThumbUpIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      {demo.likesCount}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>

              {/* Actions */}
              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Stack direction="row" spacing={1}>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => router.push(`/demo/${demo.id}`)}
                    title="Visualizar"
                  >
                    <VisibilityIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="info"
                    onClick={() => router.push(`/demo/edit/${demo.id}`)}
                    title="Editar"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(demo.id)}
                    title="Deletar"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
                <IconButton
                  size="small"
                  onClick={() => handleLike(demo.id)}
                  title="Curtir"
                >
                  <ThumbUpIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
            size="large"
          />
        </Box>
      )}
    </Box>
  );
};

export default DemoList;
