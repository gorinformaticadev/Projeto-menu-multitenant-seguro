"use client";

import { useState } from "react";
import { useNotificationContext } from '@/providers/NotificationProvider';
import {
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    Info,
    Bell,
    Search,
    Check,
    Trash2
} from 'lucide-react';
import { Button } from "./ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function NotificationCenter() {
    const {
        notifications,
        unreadCount,
        isConnected,
        connectionError,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotificationContext();

    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Filtragem
    const filteredNotifications = notifications.filter(notification => {
        // Filtro por status
        if (filter === 'unread' && notification.read) return false;

        // Filtro por busca
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                notification.title.toLowerCase().includes(search) ||
                notification.description.toLowerCase().includes(search)
            );
        }

        return true;
    });

    // Lógica de Seleção
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredNotifications.map(n => n.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelect = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(x => x !== id));
        }
    };

    const handleDeleteSelected = () => {
        if (confirm(`Tem certeza que deseja excluir ${selectedIds.length} notificações?`)) {
            selectedIds.forEach(id => deleteNotification(id));
            setSelectedIds([]);
        }
    };

    const handleMarkSelectedAsRead = () => {
        selectedIds.forEach(id => markAsRead(id));
        setSelectedIds([]);
    };

    const isAllSelected = filteredNotifications.length > 0 && selectedIds.length === filteredNotifications.length;

    // Helpers
    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'warning': return AlertTriangle;
            case 'error': return AlertCircle;
            case 'success': return CheckCircle;
            default: return Info;
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'warning': return 'text-amber-600';
            case 'error': return 'text-rose-600';
            case 'success': return 'text-emerald-600';
            default: return 'text-indigo-600';
        }
    };

    const getSeverityBadgeColor = (type: string) => {
        switch (type) {
            case 'warning': return 'bg-amber-50 text-amber-800 border-amber-200';
            case 'error': return 'bg-rose-50 text-rose-800 border-rose-200';
            case 'success': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
            default: return 'bg-indigo-50 text-indigo-800 border-indigo-200';
        }
    };

    const formatNotificationTime = (dateInput: Date | string) => {
        const now = new Date();
        const date = new Date(dateInput);

        if (isNaN(date.getTime())) return 'data inválida';

        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (minutes < 1) return 'agora';
        if (minutes < 60) return `${minutes} min atrás`;
        if (hours < 24) return `${hours} h atrás`;
        return date.toLocaleDateString();
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Bell className="h-6 w-6 text-indigo-600" />
                        Central de Notificações
                    </h1>
                    <p className="text-slate-600 mt-1">Gerencie seus alertas e mensagens do sistema</p>
                </div>

                <div className="flex gap-3">
                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => markAllAsRead()}
                            className="flex items-center gap-2 text-primary hover:text-primary/80"
                        >
                            <Check className="h-4 w-4" />
                            Marcar tudo como lido
                        </Button>
                    )}
                </div>
            </div>

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-indigo-50 rounded-lg">
                        <Bell className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-600">Total recebidas</p>
                        <p className="text-2xl font-bold text-slate-900">{notifications.length}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-amber-50 rounded-lg">
                        <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-600">Não lidas</p>
                        <p className="text-2xl font-bold text-slate-900">{unreadCount}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                        <CheckCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-600">Lidas</p>
                        <p className="text-2xl font-bold text-slate-900">{notifications.length - unreadCount}</p>
                    </div>
                </div>
            </div>

            {/* Status da Conexão */}
            {!isConnected && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-amber-800">
                                Você está desconectado do servidor de notificações em tempo real.
                                {connectionError && <span className="block mt-1 text-xs text-amber-700">{connectionError}</span>}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filtros e Busca */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 w-full">
                        {/* Checkbox Selecionar Tudo */}
                        <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                            <Checkbox
                                id="select-all"
                                checked={isAllSelected}
                                onCheckedChange={(checked: boolean) => handleSelectAll(checked as boolean)}
                            />
                            <label htmlFor="select-all" className="text-sm font-medium text-slate-700 cursor-pointer">
                                Todos
                            </label>
                        </div>

                        {/* Botões de Ação em Massa */}
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleMarkSelectedAsRead}
                                    className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                    <Check className="h-4 w-4" />
                                    Marcar Lidas
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteSelected}
                                    className="flex items-center gap-2"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Excluir ({selectedIds.length})
                                </Button>
                            </div>
                        )}

                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar notificações..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            />
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'all'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Todas
                            </button>
                            <button
                                onClick={() => setFilter('unread')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${filter === 'unread'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Não Lidas
                                {unreadCount > 0 && (
                                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Notificações */}
            <div className="space-y-4">
                {filteredNotifications.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-xl border-dashed border-2 border-slate-200">
                        <div className="bg-white p-4 rounded-full inline-block mb-4 shadow-sm">
                            <Bell className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">Nenhuma notificação encontrada</h3>
                        <p className="text-slate-600 mt-1 max-w-sm mx-auto">
                            {searchTerm
                                ? `Não encontramos resultados para "${searchTerm}"`
                                : filter === 'unread'
                                    ? "Você leu todas as suas notificações!"
                                    : "Seu histórico de notificações está vazio."}
                        </p>
                        {filter !== 'all' && (
                            <Button
                                variant="link"
                                onClick={() => setFilter('all')}
                                className="mt-4"
                            >
                                Ver todas as notificações
                            </Button>
                        )}
                    </div>
                ) : (
                    filteredNotifications.map((notification) => {
                        const Icon = getNotificationIcon(notification.type);
                        const isUnread = !notification.read;
                        const isSelected = selectedIds.includes(notification.id);

                        return (
                            <div
                                key={notification.id}
                                className={`group relative bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isUnread
                                    ? 'border-indigo-200 shadow-sm ring-1 ring-indigo-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                    } ${isSelected ? 'bg-indigo-50/50 border-indigo-300' : ''}`}
                            >
                                {isUnread && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                                )}

                                <div className="p-5 flex items-start gap-4">
                                    <div className="pt-1">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked: boolean) => handleSelect(notification.id, checked as boolean)}
                                        />
                                    </div>

                                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isUnread ? 'bg-indigo-50' : 'bg-slate-50 group-hover:bg-slate-100'
                                        }`}>
                                        <Icon className={`h-5 w-5 ${getIconColor(notification.type)}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4 mb-1">
                                            <div>
                                                <h3 className={`text-base ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                    {notification.title}
                                                </h3>
                                            </div>
                                        </div>

                                        <p className="text-slate-600 text-sm leading-relaxed mb-3">
                                            {notification.description}
                                        </p>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium border ${getSeverityBadgeColor(notification.type)}`}>
                                                    {notification.type === 'error' ? 'Erro' :
                                                        notification.type === 'warning' ? 'Aviso' :
                                                            notification.type === 'success' ? 'Sucesso' : 'Informativo'}
                                                </span>

                                                <span className="text-xs text-slate-400 flex items-center gap-1 border-l pl-3 ml-1 border-slate-200">
                                                    {formatNotificationTime(notification.createdAt)}
                                                </span>
                                            </div>

                                            {isUnread && (
                                                <button
                                                    onClick={() => markAsRead(notification.id)}
                                                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Check className="h-3 w-3" />
                                                    Marcar como lida
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
