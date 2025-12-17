import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDemos, useCategories, useTags } from '../hooks/useDemos';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
  ThumbUp as ThumbUpIcon,
  Description as DescriptionIcon,
  Category as CategoryIcon,
  Label as LabelIcon,
  Comment as CommentIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface DashboardStats {
  totalDemos: number;
  publishedDemos: number;
  draftDemos: number;
  archivedDemos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  avgViewsPerDemo: number;
  avgLikesPerDemo: number;
  demosByCategory: Array<{ name: string; count: number; color: string }>;
  demosByTag: Array<{ name: string; count: number; color: string }>;
  topDemos: Array<{
    id: string;
    title: string;
    views: number;
    likes: number;
    comments: number;
    status: string;
  }>;
  recentActivity: Array<{
    date: string;
    views: number;
    demos: number;
  }>;
}

export const DemoDashboard: React.FC = () => {
  const router = useRouter();
  const { demos, loading: demosLoading, error } = useDemos();
  const { categories } = useCategories();
  const { tags } = useTags();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [demos]);

  const loadStats = async () => {
    try {
      // Você pode implementar um endpoint dedicado ou calcular aqui
      const response = await axios.get<DashboardStats>('/api/demo/stats');
      setStats(response.data);
    } catch (err) {
      // Fallback: calcular stats localmente
      if (demos.length > 0) {
        const calculatedStats = calculateLocalStats();
        setStats(calculatedStats);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateLocalStats = (): DashboardStats => {
    const totalDemos = demos.length;
    const publishedDemos = demos.filter(d => d.status === 'published').length;
    const draftDemos = demos.filter(d => d.status === 'draft').length;
    const archivedDemos = demos.filter(d => d.status === 'archived').length;

    const totalViews = demos.reduce((sum, d) => sum + d.viewsCount, 0);
    const totalLikes = demos.reduce((sum, d) => sum + d.likesCount, 0);
    const totalComments = demos.reduce((sum, d) => sum + (d.comments?.length || 0), 0);

    const avgViewsPerDemo = totalDemos > 0 ? totalViews / totalDemos : 0;
    const avgLikesPerDemo = totalDemos > 0 ? totalLikes / totalDemos : 0;

    // Demos por categoria
    const categoryMap = new Map<string, number>();
    demos.forEach(demo => {
      demo.categories?.forEach(cat => {
        categoryMap.set(cat.id, (categoryMap.get(cat.id) || 0) + 1);
      });
    });
    const demosByCategory = Array.from(categoryMap.entries()).map(([id, count]) => {
      const cat = categories.find(c => c.id === id);
      return {
        name: cat?.name || 'Sem categoria',
        count,
        color: cat?.color || '#ccc',
      };
    });

    // Demos por tag
    const tagMap = new Map<string, number>();
    demos.forEach(demo => {
      demo.tags?.forEach(tag => {
        tagMap.set(tag.id, (tagMap.get(tag.id) || 0) + 1);
      });
    });
    const demosByTag = Array.from(tagMap.entries())
      .map(([id, count]) => {
        const tag = tags.find(t => t.id === id);
        return {
          name: tag?.name || 'Sem tag',
          count,
          color: tag?.color || '#ccc',
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top demos
    const topDemos = [...demos]
      .sort((a, b) => b.viewsCount - a.viewsCount)
      .slice(0, 10)
      .map(d => ({
        id: d.id,
        title: d.title,
        views: d.viewsCount,
        likes: d.likesCount,
        comments: d.comments?.length || 0,
        status: d.status,
      }));

    // Atividade recente (últimos 7 dias)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        views: Math.floor(Math.random() * 100), // Placeholder - deveria vir do backend
        demos: 0,
      };
    });

    return {
      totalDemos,
      publishedDemos,
      draftDemos,
      archivedDemos,
      totalViews,
      totalLikes,
      totalComments,
      avgViewsPerDemo,
      avgLikesPerDemo,
      demosByCategory,
      demosByTag,
      topDemos,
      recentActivity: last7Days,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'success';
      case 'draft': return 'warning';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published': return 'Publicado';
      case 'draft': return 'Rascunho';
      case 'archived': return 'Arquivado';
      default: return status;
    }
  };

  if (loading || demosLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="info" sx={{ m: 3 }}>
        Sem dados para exibir
      </Alert>
    );
  }

  const statusData = [
    { name: 'Publicados', value: stats.publishedDemos, color: '#4caf50' },
    { name: 'Rascunhos', value: stats.draftDemos, color: '#ff9800' },
    { name: 'Arquivados', value: stats.archivedDemos, color: '#9e9e9e' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard - Módulo Demo
      </Typography>

      {/* Estatísticas Principais */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    bgcolor: 'primary.light',
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                  }}
                >
                  <DescriptionIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                </Box>
                <Box>
                  <Typography variant="h4">{stats.totalDemos}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de Demos
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    bgcolor: 'success.light',
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                  }}
                >
                  <VisibilityIcon sx={{ fontSize: 32, color: 'success.main' }} />
                </Box>
                <Box>
                  <Typography variant="h4">{stats.totalViews}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de Visualizações
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    bgcolor: 'error.light',
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                  }}
                >
                  <ThumbUpIcon sx={{ fontSize: 32, color: 'error.main' }} />
                </Box>
                <Box>
                  <Typography variant="h4">{stats.totalLikes}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de Curtidas
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    bgcolor: 'info.light',
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                  }}
                >
                  <CommentIcon sx={{ fontSize: 32, color: 'info.main' }} />
                </Box>
                <Box>
                  <Typography variant="h4">{stats.totalComments}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de Comentários
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Gráfico de Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribuição por Status
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Gráfico de Categorias */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Demos por Categoria
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.demosByCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8">
                    {stats.demosByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Atividade Recente */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Atividade dos Últimos 7 Dias
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.recentActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="views" stroke="#8884d8" name="Visualizações" />
                  <Line type="monotone" dataKey="demos" stroke="#82ca9d" name="Novos Demos" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Demos */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top 10 Demos Mais Visualizados
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Título</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Visualizações</TableCell>
                      <TableCell align="right">Curtidas</TableCell>
                      <TableCell align="right">Comentários</TableCell>
                      <TableCell align="right">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.topDemos.map((demo) => (
                      <TableRow key={demo.id} hover>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                            {demo.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(demo.status)}
                            color={getStatusColor(demo.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">{demo.views}</TableCell>
                        <TableCell align="right">{demo.likes}</TableCell>
                        <TableCell align="right">{demo.comments}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/demo/${demo.id}`)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/demo/edit/${demo.id}`)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Tags Populares */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tags Mais Usadas
              </Typography>
              <Stack spacing={1.5}>
                {stats.demosByTag.slice(0, 8).map((tag, index) => (
                  <Box key={index}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Chip
                        label={tag.name}
                        size="small"
                        sx={{ bgcolor: tag.color, color: '#fff' }}
                      />
                      <Typography variant="body2">{tag.count} demos</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(tag.count / stats.totalDemos) * 100}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Métricas de Engajamento */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Métricas de Engajamento
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Média de Visualizações por Demo</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.avgViewsPerDemo.toFixed(1)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((stats.avgViewsPerDemo / 100) * 100, 100)}
                    color="primary"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Média de Curtidas por Demo</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.avgLikesPerDemo.toFixed(1)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((stats.avgLikesPerDemo / 50) * 100, 100)}
                    color="secondary"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Taxa de Publicação</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {((stats.publishedDemos / stats.totalDemos) * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(stats.publishedDemos / stats.totalDemos) * 100}
                    color="success"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Resumo */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resumo Executivo
              </Typography>
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <TrendingUpIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                    Demos Publicados
                  </Typography>
                  <Typography variant="h5">
                    {stats.publishedDemos} / {stats.totalDemos}
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    {((stats.publishedDemos / stats.totalDemos) * 100).toFixed(0)}% do total
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <CategoryIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                    Categorias Utilizadas
                  </Typography>
                  <Typography variant="h5">{stats.demosByCategory.length}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {categories.length} disponíveis
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <LabelIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                    Tags Utilizadas
                  </Typography>
                  <Typography variant="h5">{stats.demosByTag.length}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {tags.length} disponíveis
                  </Typography>
                </Paper>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DemoDashboard;
