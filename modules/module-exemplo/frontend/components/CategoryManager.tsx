import React, { useState } from 'react';
import { useCategories, Category } from '../hooks/useDemos';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Grid,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { SketchPicker } from 'react-color';

export const CategoryManager: React.FC = () => {
  const { categories, loading, error, createCategory, updateCategory, deleteCategory } = useCategories();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#1976d2',
    icon: '',
  });

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        color: category.color || '#1976d2',
        icon: category.icon || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        slug: '',
        description: '',
        color: '#1976d2',
        icon: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Auto-generate slug from name
      ...(field === 'name' ? { slug: value.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') } : {})
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug) {
      alert('Nome e slug são obrigatórios');
      return;
    }

    const success = editingCategory
      ? await updateCategory(editingCategory.id, formData)
      : await createCategory(formData);

    if (success) {
      handleCloseDialog();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja deletar esta categoria?')) {
      await deleteCategory(id);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Gerenciar Categorias
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nova Categoria
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Lista de Categorias */}
      <Grid container spacing={2}>
        {categories.map((category) => (
          <Grid item xs={12} sm={6} md={4} key={category.id}>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                borderLeft: '4px solid',
                borderColor: category.color || '#ccc',
                '&:hover': { boxShadow: 4 },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    {category.icon && <span style={{ fontSize: '1.5rem' }}>{category.icon}</span>}
                    <Typography variant="h6">{category.name}</Typography>
                  </Stack>
                  <Chip
                    label={category.slug}
                    size="small"
                    variant="outlined"
                    sx={{ mb: 1, borderColor: category.color, color: category.color }}
                  />
                  {category.description && (
                    <Typography variant="body2" color="text.secondary">
                      {category.description}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleOpenDialog(category)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(category.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {categories.length === 0 && (
        <Alert severity="info">
          Nenhuma categoria cadastrada. Crie a primeira categoria!
        </Alert>
      )}

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              required
              label="Nome"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Tutoriais"
            />

            <TextField
              fullWidth
              required
              label="Slug"
              value={formData.slug}
              onChange={(e) => handleChange('slug', e.target.value)}
              placeholder="Ex: tutoriais"
              helperText="Identificador único em formato URL-friendly"
            />

            <TextField
              fullWidth
              label="Descrição"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Breve descrição da categoria..."
            />

            <TextField
              fullWidth
              label="Ícone (emoji ou texto)"
              value={formData.icon}
              onChange={(e) => handleChange('icon', e.target.value)}
              placeholder="Ex: 📚"
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Cor da Categoria
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  label="Cor (hex)"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  sx={{ width: 150 }}
                />
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: formData.color,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <SketchPicker
                  color={formData.color}
                  onChangeComplete={(color) => handleChange('color', color.hex)}
                />
              </Box>
            </Box>

            {/* Preview */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Preview
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, borderLeft: '4px solid', borderColor: formData.color }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {formData.icon && <span style={{ fontSize: '1.5rem' }}>{formData.icon}</span>}
                  <Typography variant="h6">{formData.name || 'Nome da categoria'}</Typography>
                </Stack>
                <Chip
                  label={formData.slug || 'slug'}
                  size="small"
                  variant="outlined"
                  sx={{ mt: 1, borderColor: formData.color, color: formData.color }}
                />
                {formData.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {formData.description}
                  </Typography>
                )}
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<CancelIcon />}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!formData.name || !formData.slug}
          >
            {editingCategory ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CategoryManager;
