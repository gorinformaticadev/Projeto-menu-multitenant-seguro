'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fetchEventSource } from '@microsoft/fetch-event-source';

export interface Notification {
    id: string;
    title: string;
    description: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    createdAt: string;
    metadata?: any;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    loading: boolean;
    connectionStatus: 'connecting' | 'connected' | 'error' | 'disconnected';
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, token } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ctrl = useRef<AbortController | null>(null);

    useEffect(() => {
        // 🔔 Load Audio
        audioRef.current = new Audio('/notification.mp3');
    }, []);

    const playSound = useCallback(() => {
        audioRef.current?.play().catch((e) => console.log('Audio error:', e));
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                const mapped = data.map((n: any) => ({
                    id: n.id,
                    title: n.title,
                    description: n.message,
                    type: n.severity === 'critical' ? 'error' : n.severity,
                    read: n.read,
                    createdAt: n.createdAt,
                    metadata: n.data ? JSON.parse(n.data) : {}
                }));
                setNotifications(mapped);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');

    useEffect(() => {
        if (isAuthenticated && token) {
            setConnectionStatus('connecting');
            fetchNotifications();

            ctrl.current = new AbortController();

            const sseUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/notifications/sse/stream`;

            fetchEventSource(sseUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                signal: ctrl.current.signal,
                async onopen(response) {
                    if (response.ok && response.headers.get('content-type') === 'text/event-stream') {
                        setConnectionStatus('connected');
                    } else {
                        setConnectionStatus('error');
                    }
                },
                onmessage(msg) {
                    try {
                        const payload = JSON.parse(msg.data);
                        // Avoid duplicates if ID exists
                        const id = payload.id || 'temp-' + Date.now();
                        console.log('SSE Received', payload);
                        setNotifications(prev => {
                            if (prev.find(n => n.id === id)) return prev;
                            return [{
                                id,
                                title: payload.title,
                                description: payload.description,
                                type: payload.type,
                                read: false,
                                createdAt: new Date().toISOString(),
                                metadata: payload.metadata
                            }, ...prev];
                        });

                        playSound();
                    } catch (e) { console.error('SSE Error', e); }
                },
                onclose() {
                    setConnectionStatus('disconnected');
                },
                onerror(err) {
                    console.error('SSE Connection Error', err);
                    setConnectionStatus('error');
                    // Retry logic handled by fetchEventSource defaults
                }
            });

            return () => {
                ctrl.current?.abort();
                setConnectionStatus('disconnected');
            };
        }
    }, [isAuthenticated, token, fetchNotifications, playSound]);

    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        if (!id.startsWith('temp-')) {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
        }
    };

    const markAllAsRead = async () => {
        // Implement bulk read if backend supports it or loop?
        // Assuming naive loop for now or TBD
    };

    const deleteNotification = async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        // Call backend delete
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, loading, connectionStatus }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
    return ctx;
};
