'use client';

import React from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Trash } from 'lucide-react';

export default function NotificationsPage() {
    const { notifications, markAsRead, markAllAsRead, deleteNotification, loading } = useNotifications();

    const unread = notifications.filter(n => !n.read);
    const read = notifications.filter(n => n.read);

    if (loading) {
        return <div className="p-8 text-center">Carregando...</div>;
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notificações</h1>
                    <p className="text-muted-foreground">Gerencie suas notificações e alertas.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => markAllAsRead()}>Marcar todas como lidas</Button>
                </div>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList>
                    <TabsTrigger value="all">Todas</TabsTrigger>
                    <TabsTrigger value="unread">Não lidas ({unread.length})</TabsTrigger>
                    <TabsTrigger value="read">Lidas</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                    <NotificationList list={notifications} markAsRead={markAsRead} deleteNotification={deleteNotification} />
                </TabsContent>
                <TabsContent value="unread">
                    <NotificationList list={unread} markAsRead={markAsRead} deleteNotification={deleteNotification} />
                </TabsContent>
                <TabsContent value="read">
                    <NotificationList list={read} markAsRead={markAsRead} deleteNotification={deleteNotification} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function NotificationList({ list, markAsRead, deleteNotification }: any) {
    if (list.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">Nenhuma notificação encontrada.</div>;
    }
    return (
        <div className="space-y-4 pt-4">
            {list.map((n: any) => (
                <Card key={n.id} className={`${!n.read ? 'bg-muted/50 border-l-4 border-l-blue-500' : ''}`}>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <Badge variant={n.type === 'error' ? 'destructive' : n.type === 'warning' ? 'secondary' : 'default'}>{n.type}</Badge>
                            <CardTitle className="text-base">{n.title}</CardTitle>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {new Date(n.createdAt).toLocaleString()}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <CardDescription className="text-sm text-foreground">{n.description}</CardDescription>
                        {/* Actions */}
                        <div className="flex justify-end gap-2 mt-4">
                            {!n.read && (
                                <Button size="sm" variant="ghost" onClick={() => markAsRead(n.id)}>
                                    <Check className="mr-2 h-4 w-4" /> Marcar como lida
                                </Button>
                            )}
                            {/* Simulate delete logic or actual delete */}
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteNotification(n.id)}>
                                <Trash className="mr-2 h-4 w-4" /> Excluir
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
