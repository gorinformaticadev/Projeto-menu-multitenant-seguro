import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useDemos, useCategories, useTags } from '../hooks/useDemos';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Stack,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';

export const DemoCreate: React.FC = () => {
  const router = useRouter();
  const { createDemo, loading, error } = useDemos();
  const { categories } = useCategories();
  const { tags } = useTags();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    status: 'draft',
    priority: 0,
    categoryIds: [] as string[],
    tagIds: [] as string[],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const demo = await createDemo(formData);
    
    if (demo) {
      // Upload de arquivos se houver
      if (files.length > 0) {
        const uploadFormData = new FormData();
        files.forEach(file => uploadFormData.append('files', file));
        
        try {
          // TODO: Implementar upload de arquivos
          // await axios.post(`/api/demo/${demo.id}/upload`, uploadFormData);
        } catch (err) {
          console.error('Erro ao fazer upload de arquivos:', err);
        }
      }
      
      router.push(`/demo/${demo.id}`);
    }
  };

  const handleSaveDraft = async () => {
    const demo = await createDemo({ ...formData, status: 'draft' });
    if (demo) {
      router.push(`/demo/${demo.id}`);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Criar Novo Demo
        </Typography>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Formulário Principal */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Stack spacing={3}>
                  {/* Título */}
                  <TextField
                    fullWidth
                    required
                    label="Título"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="Digite um título descritivo..."
                  />

                  {/* Descrição */}
                  <TextField
                    fullWidth
                    label="Descrição"
                    multiline
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Breve descrição do demo..."
                  />

                  {/* Conteúdo */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle1">Conteúdo (Markdown)</Typography>
                      <Button
                        size="small"
                        onClick={() => setShowPreview(!showPreview)}
                      >
                        {showPreview ? 'Editar' : 'Preview'}
                      </Button>
                    </Box>
                    
                    {!showPreview ? (
                      <TextField
                        fullWidth
                        multiline
                        rows={15}
                        value={formData.content}
                        onChange={(e) => handleChange('content', e.target.value)}
                        placeholder="Digite o conteúdo em Markdown..."
                        sx={{ fontFamily: 'monospace' }}
                      />
                    ) : (
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          p: 2, 
                          minHeight: 400, 
                          maxHeight: 600, 
                          overflow: 'auto',
                          bgcolor: '#fafafa'
                        }}
                      >
                        <ReactMarkdown>{formData.content}</ReactMarkdown>
                      </Paper>
                    )}
                  </Box>

                  {/* Upload de Arquivos */}
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Anexos
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<CloudUploadIcon />}
                      sx={{ mb: 2 }}
                    >
                      Upload de Arquivos
                      <input
                        type="file"
                        hidden
                        multiple
                        onChange={handleFileChange}
                      />
                    </Button>

                    {files.length > 0 && (
                      <Stack spacing={1}>
                        {files.map((file, index) => (
                          <Box
                            key={index}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              p: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                            }}
                          >
                            <Typography variant="body2">
                              {file.name} ({(file.size / 1024).toFixed(2)} KB)
                            </Typography>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveFile(index)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar - Configurações */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {/* Status e Prioridade */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Configurações
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={formData.status}
                        label="Status"
                        onChange={(e) => handleChange('status', e.target.value)}
                      >
                        <MenuItem value="draft">Rascunho</MenuItem>
                        <MenuItem value="published">Publicado</MenuItem>
                        <MenuItem value="archived">Arquivado</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      fullWidth
                      type="number"
                      label="Prioridade"
                      value={formData.priority}
                      onChange={(e) => handleChange('priority', parseInt(e.target.value))}
                      inputProps={{ min: 0, max: 10 }}
                      helperText="0 = baixa, 10 = alta"
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Categorias */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Categorias
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <FormControl fullWidth>
                    <InputLabel>Selecione categorias</InputLabel>
                    <Select
                      multiple
                      value={formData.categoryIds}
                      onChange={(e) => handleChange('categoryIds', e.target.value)}
                      input={<OutlinedInput label="Selecione categorias" />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => {
                            const cat = categories.find(c => c.id === value);
                            return (
                              <Chip
                                key={value}
                                label={cat?.name}
                                size="small"
                                sx={{ borderColor: cat?.color, color: cat?.color }}
                              />
                            );
                          })}
                        </Box>
                      )}
                    >
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          <Chip
                            label={cat.name}
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: cat.color, color: cat.color, mr: 1 }}
                          />
                          {cat.description}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>

              {/* Tags */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Tags
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <FormControl fullWidth>
                    <InputLabel>Selecione tags</InputLabel>
                    <Select
                      multiple
                      value={formData.tagIds}
                      onChange={(e) => handleChange('tagIds', e.target.value)}
                      input={<OutlinedInput label="Selecione tags" />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => {
                            const tag = tags.find(t => t.id === value);
                            return (
                              <Chip
                                key={value}
                                label={tag?.name}
                                size="small"
                                sx={{ bgcolor: tag?.color, color: '#fff' }}
                              />
                            );
                          })}
                        </Box>
                      )}
                    >
                      {tags.map((tag) => (
                        <MenuItem key={tag.id} value={tag.id}>
                          <Chip
                            label={tag.name}
                            size="small"
                            sx={{ bgcolor: tag.color, color: '#fff', mr: 1 }}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>

              {/* Ações */}
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      type="submit"
                      startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                      disabled={loading || !formData.title}
                    >
                      {formData.status === 'published' ? 'Publicar' : 'Salvar'}
                    </Button>

                    {formData.status !== 'draft' && (
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={handleSaveDraft}
                        disabled={loading || !formData.title}
                      >
                        Salvar como Rascunho
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default DemoCreate;
