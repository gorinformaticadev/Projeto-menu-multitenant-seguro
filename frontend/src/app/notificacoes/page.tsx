/**
 * CENTRAL DE NOTIFICAÇÕES
 * 
 * Página completa para gerenciar notificações com filtros,
 * paginação, seleção múltipla e ações em lote
 */

"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationsCenter } from '@/hooks/useNotificationsCenter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Search, 
  Filter, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  ExternalLink,
  Calendar,
  Package,
  Settings,
  Eye,
  EyeOff,
  MoreVertical,
  Check,
  X
} from 'lucide-react';
import { Notification } from '@/types/notifications';

export default function NotificationsPage() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    filters,
    setFilters,
    loadMore,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    deleteNotification,
    deleteMultiple,
    refresh,
    clearError,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection
  } = useNotificationsCenter();

  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Utilitários
  const getNotificationIcon = (severity: string) => {
    switch (severity) {
      case 'warning': return AlertTriangle;
      case 'critical': return AlertCircle;
      default: return Info;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    if (notification.context) {
      window.open(notification.context, '_blank');
    }
  };

  const handleBulkAction = async (action: 'read' | 'delete') => {
    if (selectedIds.length === 0) return;

    try {
      if (action === 'read') {
        await markMultipleAsRead(selectedIds);
      } else {
        await deleteMultiple(selectedIds);
      }
    } catch (err) {
      console.error(`Erro na ação em lote ${action}:`, err);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Faça login para ver suas notificações</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Central de Notificações
            </h1>
            <p className="text-gray-600 mt-1">
              Gerencie todas as suas notificações em um só lugar
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-lg font-semibold">{total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Não lidas</p>
                  <p className="text-lg font-semibold">{unreadCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Críticas</p>
                  <p className="text-lg font-semibold">
                    {notifications.filter(n => n.severity === 'critical').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Selecionadas</p>
                  <p className="text-lg font-semibold">{selectedIds.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Severidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Severidade
                </label>
                <select
                  value={filters.severity || 'all'}
                  onChange={(e) => setFilters({ severity: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Todas</option>
                  <option value="info">Informação</option>
                  <option value="warning">Aviso</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>

              {/* Origem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origem
                </label>
                <select
                  value={filters.source || 'all'}
                  onChange={(e) => setFilters({ source: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Todas</option>
                  <option value="core">Sistema</option>
                  <option value="module">Módulos</option>
                </select>
              </div>

              {/* Status de leitura */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.read === undefined ? 'all' : filters.read ? 'read' : 'unread'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters({ 
                      read: value === 'all' ? undefined : value === 'read' 
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Todas</option>
                  <option value="unread">Não lidas</option>
                  <option value="read">Lidas</option>
                </select>
              </div>

              {/* Ações */}
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setFilters({
                    severity: 'all',
                    source: 'all',
                    read: undefined,
                    module: undefined
                  })}
                  className="flex-1"
                >
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações em lote */}
      {selectedIds.length > 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {selectedIds.length} notificação{selectedIds.length !== 1 ? 'ões' : ''} selecionada{selectedIds.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('read')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Marcar como lidas
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deletar
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de notificações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Notificações ({total})
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectedIds.length === notifications.length ? clearSelection : selectAll}
                  >
                    {selectedIds.length === notifications.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </Button>
                  
                  {unreadCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAsRead}
                    >
                      Marcar todas como lidas
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Erro */}
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-red-600">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Loading inicial */}
          {loading && notifications.length === 0 && (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-500">Carregando notificações...</p>
            </div>
          )}

          {/* Sem notificações */}
          {!loading && notifications.length === 0 && (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma notificação encontrada
              </h3>
              <p className="text-gray-500">
                {Object.values(filters).some(v => v && v !== 'all') 
                  ? 'Tente ajustar os filtros para ver mais resultados.'
                  : 'Você está em dia com suas notificações!'
                }
              </p>
            </div>
          )}

          {/* Lista */}
          {notifications.length > 0 && (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.severity);
                const isSelected = selectedIds.includes(notification.id);
                const isUnread = !notification.read;
                
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      isUnread ? 'bg-blue-50' : ''
                    } ${isSelected ? 'bg-blue-100' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(notification.id)}
                        className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />

                      {/* Ícone e indicador */}
                      <div className="flex-shrink-0 relative">
                        <Icon className={`h-5 w-5 mt-0.5 ${getSeverityColor(notification.severity)}`} />
                        {isUnread && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-sm truncate ${
                                isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                              }`}>
                                {notification.title}
                              </h3>
                              
                              <Badge className={getSeverityBadge(notification.severity)}>
                                {notification.severity === 'critical' ? 'Crítica' : 
                                 notification.severity === 'warning' ? 'Aviso' : 'Info'}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{formatDate(notification.createdAt)}</span>
                              
                              {notification.source === 'module' && notification.module && (
                                <div className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  <span className="capitalize">{notification.module}</span>
                                </div>
                              )}
                              
                              {notification.source === 'core' && (
                                <div className="flex items-center gap-1">
                                  <Settings className="h-3 w-3" />
                                  <span>Sistema</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2">
                            {notification.context && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNotificationClick(notification)}
                                title="Abrir contexto"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {isUnread && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                title="Marcar como lida"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotification(notification.id)}
                              title="Deletar"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Carregar mais */}
          {hasMore && (
            <div className="p-4 text-center border-t border-gray-200">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                    Carregando...
                  </>
                ) : (
                  'Carregar mais'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}