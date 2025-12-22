"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bell,
  CheckCircle,
  Trash2,
  MailOpen,
  Mail,
  RefreshCw,
  AlertCircle,
  Clock,
  Filter,
  Check,
  EyeOff,
  Eye,
  X,
  Search
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { useNotificationContext } from '@/providers/NotificationProvider';

interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export default function NotificacaoPage() {
  const { toast } = useToast();
  const { refreshNotifications } = useNotificationContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ✅ PADRÃO CORRETO DE FETCH: Executa apenas UMA VEZ na montagem
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      const data = response.data?.notifications || [];

      if (Array.isArray(data)) {
        setNotifications(data);
      } else {
        console.error('Formato de resposta inválido:', response.data);
        setNotifications([]);
      }
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível buscar as notificações.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Derived state for filtered notifications
  const filteredNotifications = notifications.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const unreadCount = notifications.filter(n => !n.read).length;
  const errorCount = notifications.filter(n => n.type === 'error').length;

  // Ações manuais que chamam o refetch
  const handleMarkAsRead = async (id: string) => {
    setProcessingId(id);
    try {
      await api.patch(`/notifications/${id}/read`);
      await fetchNotifications();
      console.log('🔄 Atualizando contexto global...');
      await refreshNotifications();
      toast({ description: "Notificação marcada como lida." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAsUnread = async (id: string) => {
    setProcessingId(id);
    try {
      await api.patch(`/notifications/${id}/unread`);
      await fetchNotifications();
      console.log('🔄 Atualizando contexto global...');
      await refreshNotifications();
      toast({ description: "Notificação marcada como não lida." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setProcessingId(id);
    try {
      await api.delete(`/notifications/${id}`);
      await fetchNotifications();
      console.log('🔄 Atualizando contexto global...');
      await refreshNotifications();
      setSelectedIds(prev => prev.filter(pid => pid !== id));
      toast({ description: "Notificação excluída." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao excluir.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    try {
      setLoading(true);
      // Implement batch delete or sequential delete
      await api.delete('/notifications/batch', { data: { ids: selectedIds } });
      await fetchNotifications();
      console.log('🔄 Atualizando contexto global...');
      await refreshNotifications();
      setSelectedIds([]);
      toast({ description: `${selectedIds.length} notificações excluídas.` });
    } catch (error) {
      toast({ title: "Erro", description: "Falha na exclusão em massa.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      await api.patch('/notifications/mark-all-read');
      await fetchNotifications();
      console.log('🔄 Atualizando contexto global...');
      await refreshNotifications();
      toast({ description: "Todas as notificações marcadas como lidas." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao atualizar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(pid => pid !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(filteredNotifications.map(n => n.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBadgeColor = (type?: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 hover:bg-red-200';
      default: return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    }
  };

  const getBadgeLabel = (type?: string) => {
    switch (type) {
      case 'success': return 'Sucesso';
      case 'warning': return 'Aviso';
      case 'error': return 'Erro';
      default: return 'Info';
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateString));
    } catch (e) {
      return 'Data inválida';
    }
  };

  return (
    <div className="p-6 container mx-auto space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900">
            <Bell className="h-8 w-8 text-primary" />
            Central de Notificações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas notificações do sistema
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchNotifications}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-full">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <h3 className="text-2xl font-bold">{notifications.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-yellow-100 rounded-full">
              <EyeOff className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Não lidas</p>
              <h3 className="text-2xl font-bold">{unreadCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Erros</p>
              <h3 className="text-2xl font-bold">{errorCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-2 rounded-full ${selectedIds.length > 0 ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Check className={`h-5 w-5 ${selectedIds.length > 0 ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Selecionadas</p>
              <h3 className="text-2xl font-bold">{selectedIds.length}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="space-y-4">
        {(showFilters || searchTerm) && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por título ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-800">
                <Check className="h-4 w-4" />
                <span className="font-medium">{selectedIds.length} itens selecionados</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="hover:bg-blue-100 text-blue-700"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Selecionados
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {filteredNotifications.length > 0 && (
                <div title={selectedIds.length === filteredNotifications.length ? "Desmarcar todos" : "Selecionar todos"}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredNotifications.length && filteredNotifications.length > 0}
                    onChange={selectedIds.length === filteredNotifications.length ? clearSelection : selectAll}
                    style={{ width: '1.2rem', height: '1.2rem' }}
                    className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </div>
              )}
              <CardTitle>Lista de Notificações</CardTitle>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={loading}
                >
                  <MailOpen className="h-4 w-4 mr-2" />
                  Marcar todas como lidas
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-4">
              <RefreshCw className="h-10 w-10 animate-spin text-primary" />
              <p>Carregando notificações...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-4">
              <div className="bg-gray-100 p-4 rounded-full">
                <Bell className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Nenhuma notificação encontrada</p>
                <p className="text-sm mt-1">
                  {searchTerm ? "Tente ajustar seus filtros de busca." : "Você não tem notificações no momento."}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((notification) => {
                const isSelected = selectedIds.includes(notification.id);
                return (
                  <div
                    key={notification.id}
                    className={`flex gap-4 p-4 transition-colors hover:bg-gray-50/80 ${notification.read ? 'opacity-80' : 'bg-blue-50/30'
                      } ${isSelected ? 'bg-blue-50 border-l border-blue-500' : ''}`}
                  >
                    <div className="flex flex-col items-center gap-3 pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(notification.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                      {getIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-base truncate ${notification.read ? 'text-gray-600 font-medium' : 'text-gray-900 font-bold'}`}>
                            {notification.title}
                          </h4>
                          <Badge variant="outline" className={`${getBadgeColor(notification.type)} border-0`}>
                            {getBadgeLabel(notification.type)}
                          </Badge>
                          {!notification.read && (
                            <Badge className="bg-blue-600 hover:bg-blue-700 text-xs px-2 py-0.5 h-5">Nova</Badge>
                          )}
                        </div>

                        <span className="text-xs text-muted-foreground flex items-center gap-1 bg-gray-50 px-2 py-1 rounded whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>

                      <p className={`text-sm leading-relaxed ${notification.read ? 'text-gray-500' : 'text-gray-700'}`}>
                        {notification.description}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 pl-2 border-l border-gray-100 ml-2 justify-center">
                      {notification.read ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-blue-600"
                          onClick={() => handleMarkAsUnread(notification.id)}
                          disabled={processingId === notification.id}
                          title="Marcar como não lida"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={processingId === notification.id}
                          title="Marcar como lida"
                        >
                          <MailOpen className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(notification.id)}
                        disabled={processingId === notification.id}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
