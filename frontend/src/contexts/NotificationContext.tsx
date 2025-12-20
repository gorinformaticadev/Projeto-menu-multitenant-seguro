'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { API_URL } from '@/lib/api';
import { notificationsService } from '@/services/notifications.service';
import { Notification } from '@/types/notifications';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    loading: boolean;
    connectionStatus: 'connecting' | 'connected' | 'error' | 'disconnected';
    isSoundEnabled: boolean;
    toggleSound: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, token } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ctrl = useRef<AbortController | null>(null);
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');

    useEffect(() => {
        // 🔔 Load Audio
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio('/notification.mp3');
            // Load sound preference
            const stored = localStorage.getItem('notification_sound');
            if (stored !== null) {
                setIsSoundEnabled(stored === 'true');
            }
        }
    }, []);

    const toggleSound = useCallback(() => {
        setIsSoundEnabled(prev => {
            const newValue = !prev;
            localStorage.setItem('notification_sound', String(newValue));
            return newValue;
        });
    }, []);

    const playSound = useCallback(() => {
        if (isSoundEnabled && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((e) => console.log('Audio error:', e));
        }
    }, [isSoundEnabled]);

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            // Use service to get dropdown notifications (latest 15)
            const data = await notificationsService.getDropdownNotifications();
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch (e) {
            console.error('Error fetching notifications:', e);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // SSE Connection
    useEffect(() => {
        if (isAuthenticated && token) {
            setConnectionStatus('connecting');
            fetchNotifications();

            ctrl.current = new AbortController();
            const sseUrl = `${API_URL}/notifications/sse/stream`;

            fetchEventSource(sseUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                signal: ctrl.current.signal,
                async onopen(response) {
                    if (response.ok && response.headers.get('content-type') === 'text/event-stream') {
                        setConnectionStatus('connected');
                    } else {
                        console.error('SSE Error: Invalid content-type or status', response.status);
                        setConnectionStatus('error');
                    }
                },
                onmessage(msg) {
                    try {
                        const payload = JSON.parse(msg.data);
                        console.log('SSE Received', payload);

                        const newNotification: Notification = {
                            id: payload.id || 'temp-' + Date.now(),
                            title: payload.title,
                            message: payload.description || payload.message,
                            severity: payload.type || payload.severity,
                            read: false,
                            createdAt: new Date(),
                            audience: payload.audience,
                            source: payload.origin || payload.source,
                            module: payload.metadata?.module || payload.module,
                            context: payload.metadata?.context || payload.context,
                            data: payload.metadata || payload.data,
                            // fill other fields as needed
                            tenantId: payload.tenantId,
                            userId: payload.userId
                        };

                        setNotifications(prev => {
                            if (prev.find(n => n.id === newNotification.id)) return prev;
                            const updated = [newNotification, ...prev];
                            return updated.slice(0, 20); // Keep only latest 20 in context
                        });

                        setUnreadCount(prev => prev + 1);
                        playSound();
                    } catch (e) { console.error('SSE Error parsing message', e); }
                },
                onclose() {
                    setConnectionStatus('disconnected');
                },
                onerror(err) {
                    console.error('SSE Connection Error', err);
                    setConnectionStatus('error');
                }
            });

            return () => {
                ctrl.current?.abort();
                setConnectionStatus('disconnected');
            };
        }
    }, [isAuthenticated, token, fetchNotifications, playSound]);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        if (!id.startsWith('temp-')) {
            try {
                await notificationsService.markAsRead(id);
            } catch (e) {
                console.error('Error marking as read:', e);
            }
        }
    };

    const markAllAsRead = async () => {
        // Optimistic update
        const unreadInList = notifications.filter(n => !n.read).length;
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        // We reduce based on what we see, but fetch update to be sure
        setUnreadCount(prev => Math.max(0, prev - unreadInList));

        try {
            await notificationsService.markAllAsRead();
            const count = await notificationsService.getUnreadCount();
            setUnreadCount(count);
        } catch (e) {
            console.error('Error marking all as read:', e);
        }
    };

    const deleteNotification = async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (!id.startsWith('temp-')) {
            try {
                await notificationsService.deleteNotification(id);
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            loading,
            connectionStatus,
            isSoundEnabled,
            toggleSound
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
    return ctx;
};
