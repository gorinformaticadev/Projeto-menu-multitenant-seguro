import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDemos, useComments, Demo } from '../hooks/useDemos';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  IconButton,
  Avatar,
  TextField,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ThumbUp as ThumbUpIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
  Visibility as VisibilityIcon,
  Comment as CommentIcon,
  ArrowBack as ArrowBackIcon,
  Share as ShareIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface DemoViewProps {
  demoId: string;
}

export const DemoView: React.FC<DemoViewProps> = ({ demoId }) => {
  const router = useRouter();
  const { getDemo, deleteDemo, likeDemo, incrementViews, loading, error } = useDemos();
  const { comments, createComment, deleteComment, loading: commentsLoading } = useComments(demoId);

  const [demo, setDemo] = useState<Demo | null>(null);
  const [liked, setLiked] = useState(false);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    loadDemo();
  }, [demoId]);

  const loadDemo = async () => {
    const data = await getDemo(demoId);
    if (data) {
      setDemo(data);
      incrementViews(demoId);
    }
  };

  const handleLike = async () => {
    const success = await likeDemo(demoId);
    if (success) {
      setLiked(!liked);
      loadDemo();
    }
  };

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja deletar este demo?')) {
      const success = await deleteDemo(demoId);
      if (success) {
        router.push('/demo');
      }
    }
  };

  const handleAddComment = async () => {
    if (commentText.trim()) {
      const comment = await createComment(commentText);
      if (comment) {
        setCommentText('');
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (confirm('Tem certeza que deseja deletar este comentário?')) {
      await deleteComment(commentId);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: demo?.title,
        text: demo?.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiado para a área de transferência!');
    }
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !demo) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error || 'Demo não encontrado'}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/demo" underline="hover" color="inherit">
          Demos
        </Link>
        <Typography color="text.primary">{demo.title}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            {demo.title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" paragraph>
            {demo.description}
          </Typography>

          {/* Metadata */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Chip
              label={getStatusLabel(demo.status)}
              color={getStatusColor(demo.status)}
              size="small"
            />
            {demo.priority > 5 && (
              <Chip label="Alta Prioridade" color="error" size="small" />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VisibilityIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {demo.viewsCount} visualizações
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ThumbUpIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {demo.likesCount} curtidas
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CommentIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {comments.length} comentários
              </Typography>
            </Box>
          </Stack>

          {/* Categories & Tags */}
          {demo.categories && demo.categories.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
              {demo.categories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  variant="outlined"
                  sx={{ borderColor: cat.color, color: cat.color }}
                />
              ))}
            </Stack>
          )}

          {demo.tags && demo.tags.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {demo.tags.map((tag) => (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  size="small"
                  sx={{ bgcolor: tag.color, color: '#fff' }}
                />
              ))}
            </Stack>
          )}
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={1}>
          <IconButton onClick={() => router.back()} title="Voltar">
            <ArrowBackIcon />
          </IconButton>
          <IconButton onClick={handleShare} title="Compartilhar">
            <ShareIcon />
          </IconButton>
          <IconButton
            onClick={handleLike}
            color={liked ? 'primary' : 'default'}
            title="Curtir"
          >
            {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
          </IconButton>
          <IconButton
            onClick={() => router.push(`/demo/edit/${demo.id}`)}
            color="info"
            title="Editar"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={handleDelete}
            color="error"
            title="Deletar"
          >
            <DeleteIcon />
          </IconButton>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Conteúdo Principal */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{
                '& h1': { fontSize: '2rem', mb: 2 },
                '& h2': { fontSize: '1.5rem', mb: 1.5, mt: 3 },
                '& h3': { fontSize: '1.25rem', mb: 1.5, mt: 2 },
                '& p': { mb: 2 },
                '& pre': { mb: 2 },
                '& ul, & ol': { mb: 2, pl: 3 },
                '& li': { mb: 0.5 },
                '& img': { maxWidth: '100%', borderRadius: 1 },
                '& blockquote': {
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                  pl: 2,
                  ml: 0,
                  fontStyle: 'italic',
                  color: 'text.secondary'
                },
              }}>
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={atomDark}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {demo.content || 'Sem conteúdo'}
                </ReactMarkdown>
              </Box>
            </CardContent>
          </Card>

          {/* Attachments */}
          {demo.attachments && demo.attachments.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Anexos ({demo.attachments.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  {demo.attachments.map((file) => (
                    <Box
                      key={file.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box>
                        <Typography variant="body1">{file.filename}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(file.fileSize / 1024).toFixed(2)} KB • {file.mimeType}
                        </Typography>
                      </Box>
                      <IconButton
                        href={file.fileUrl}
                        download
                        color="primary"
                      >
                        <CloudDownloadIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Comentários */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Comentários ({comments.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Novo comentário */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Adicione um comentário..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Button
                  variant="contained"
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || commentsLoading}
                >
                  Comentar
                </Button>
              </Box>

              {/* Lista de comentários */}
              {commentsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center">
                  Nenhum comentário ainda. Seja o primeiro!
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {comments.map((comment) => (
                    <Paper key={comment.id} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            src={comment.user?.avatar}
                            sx={{ width: 32, height: 32 }}
                          >
                            {comment.user?.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2">
                              {comment.user?.name || 'Usuário'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(comment.createdAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Typography variant="body2">
                        {comment.content}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Informações */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informações
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Criado em
                    </Typography>
                    <Typography variant="body2">
                      {new Date(demo.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Atualizado em
                    </Typography>
                    <Typography variant="body2">
                      {new Date(demo.updatedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Prioridade
                    </Typography>
                    <Typography variant="body2">
                      {demo.priority}/10
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Ações Rápidas */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Ações
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => router.push(`/demo/edit/${demo.id}`)}
                  >
                    Editar
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDelete}
                  >
                    Deletar
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<ShareIcon />}
                    onClick={handleShare}
                  >
                    Compartilhar
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DemoView;
