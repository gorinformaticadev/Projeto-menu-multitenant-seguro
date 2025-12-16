import React, { useState } from 'react';
import { useTags, Tag } from '../hooks/useDemos';
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
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Label as LabelIcon,
} from '@mui/icons-material';
import { SketchPicker } from 'react-color';

export const TagManager: React.FC = () => {
  const { tags, loading, error, createTag, deleteTag } = useTags();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    color: '#2196f3',
  });

  const handleOpenDialog = () => {
    setFormData({
      name: '',
      slug: '',
      color: '#2196f3',
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
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

    const success = await createTag(formData);
    if (success) {
      handleCloseDialog();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja deletar esta tag?')) {
      await deleteTag(id);
    }
  };

  // Pré-definir cores populares
  const presetColors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7',
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
    '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
  ];

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
          Gerenciar Tags
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Nova Tag
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Lista de Tags */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            sx={{
              bgcolor: tag.color,
              color: '#fff',
              fontSize: '0.9rem',
              height: 36,
              '& .MuiChip-deleteIcon': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  color: '#fff',
                },
              },
            }}
            onDelete={() => handleDelete(tag.id)}
            deleteIcon={<DeleteIcon />}
          />
        ))}
      </Box>

      {tags.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Nenhuma tag cadastrada. Crie a primeira tag!
        </Alert>
      )}

      {/* Dialog de Criar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Nova Tag
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              required
              label="Nome"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Iniciante"
            />

            <TextField
              fullWidth
              required
              label="Slug"
              value={formData.slug}
              onChange={(e) => handleChange('slug', e.target.value)}
              placeholder="Ex: iniciante"
              helperText="Identificador único em formato URL-friendly"
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Cor da Tag
              </Typography>
              
              {/* Cores pré-definidas */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {presetColors.map((color) => (
                  <Box
                    key={color}
                    onClick={() => handleChange('color', color)}
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: color,
                      border: formData.color === color ? '3px solid' : '1px solid',
                      borderColor: formData.color === color ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        transition: 'transform 0.2s',
                      },
                    }}
                  />
                ))}
              </Box>

              {/* Color picker customizado */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TextField
                  label="Cor personalizada (hex)"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  sx={{ width: 180 }}
                />
                <Box
                  sx={{
                    width: 50,
                    height: 50,
                    bgcolor: formData.color,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                />
              </Box>

              <SketchPicker
                color={formData.color}
                onChangeComplete={(color) => handleChange('color', color.hex)}
              />
            </Box>

            {/* Preview */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Preview
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={formData.name || 'Nome da tag'}
                  sx={{
                    bgcolor: formData.color,
                    color: '#fff',
                    fontSize: '0.9rem',
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  ({formData.slug || 'slug'})
                </Typography>
              </Stack>
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
            Criar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TagManager;
