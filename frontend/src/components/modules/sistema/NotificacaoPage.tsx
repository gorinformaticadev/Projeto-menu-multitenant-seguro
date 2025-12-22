"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle, Trash2, MailOpen, Mail, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ✅ PADRÃO CORRETO DE FETCH: Executa apenas UMA VEZ na montagem
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      // Correction: Backend endpoint is /notifications (no /api prefix)
      // Correction: Response is { notifications: [], total: 0, ... }
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

  // Ações manuais que chamam o refetch
  const handleMarkAsRead = async (id: string) => {
    setProcessingId(id);
    try {
      await api.patch(`/notifications/${id}/read`);
      await fetchNotifications(); // Refetch manual obrigatório
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
      await fetchNotifications(); // Refetch manual obrigatório
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
      await fetchNotifications(); // Refetch manual obrigatório
      toast({ description: "Notificação excluída." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao excluir.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notificações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas notificações do sistema
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchNotifications}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sua Caixa de Entrada</CardTitle>
          <CardDescription>
            {notifications.filter(n => !n.read).length} não lidas de {notifications.length} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-4">
              <RefreshCw className="h-10 w-10 animate-spin" />
              <p>Carregando notificações...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500/20" />
              <div>
                <p className="font-medium">Tudo limpo!</p>
                <p className="text-sm">Você não tem notificações no momento.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex flex-col sm:flex-row gap-4 p-4 rounded-lg border transition-all ${notification.read ? 'bg-background/50 opacity-75' : 'bg-card shadow-sm border-l-4 border-l-primary'
                    }`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-semibold text-base ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {notification.title}
                      </h4>
                      <Badge variant={notification.read ? "outline" : "default"} className="ml-auto flex-shrink-0">
                        {notification.read ? 'Lida' : 'Nova'}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {notification.description}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                      <Clock className="h-3 w-3" />
                      <span>
                        {notification.createdAt
                          ? formatDate(notification.createdAt)
                          : 'Data desconhecida'}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col gap-2 justify-center border-t sm:border-t-0 sm:border-l pt-3 sm:pt-0 sm:pl-3 mt-3 sm:mt-0">
                    {notification.read ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsUnread(notification.id)}
                        disabled={processingId === notification.id}
                        title="Marcar como não lida"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={processingId === notification.id}
                        title="Marcar como lida"
                        className="text-primary hover:text-primary/80"
                      >
                        <MailOpen className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(notification.id)}
                      disabled={processingId === notification.id}
                      title="Excluir"
                      className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
