"use client";

import React from 'react';
// import { useQuery } from '@tanstack/react-query';
// import { base44 } from '@/api/base44Client';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    MessageSquare,
    QrCode,
    Users,
    MessageCircle,
    ArrowRight,
    TrendingUp,
    Zap,
    Clock
} from 'lucide-react';

export default function HomePage() {
    // Mock Data for Visualization
    const sessions = [{ status: 'connected' }];
    const conversations: any[] = [
        { unread_count: 5, status: 'open' },
        { unread_count: 2, status: 'attending' },
        { unread_count: 0, status: 'resolved' },
    ];
    // const { data: sessions = [], isLoading } = useQuery({
    //     queryKey: ['whatsapp-sessions'],
    //     queryFn: () => base44.entities.WhatsAppSession.list(),
    // });

    // const { data: conversations = [] } = useQuery({
    //     queryKey: ['conversations-stats'],
    //     queryFn: () => base44.entities.Conversation.list(),
    // });

    const currentSession = sessions[0];
    const isConnected = currentSession?.status === 'connected';

    const stats = {
        totalConversations: conversations.length,
        unreadMessages: conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
        activeChats: conversations.filter(c => c.status === 'attending' || c.status === 'open').length,
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#111b21] via-[#0b141a] to-[#111b21]">
            {/* Header */}
            <header className="border-b border-[#2a3942]/50">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a884] to-[#25d366] flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-[#e9edef]">WhatsApp Business</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {isConnected ? (
                            <div className="flex items-center gap-2 text-green-400">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-sm">Conectado</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-[#8696a0]">
                                <div className="w-2 h-2 rounded-full bg-[#8696a0]" />
                                <span className="text-sm">Desconectado</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-6 py-12">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-[#e9edef] mb-4">
                        Gerencie suas conversas
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00a884] to-[#25d366]">
                            em um só lugar
                        </span>
                    </h1>
                    <p className="text-[#8696a0] text-lg max-w-2xl mx-auto mb-8">
                        Centralize o atendimento do seu WhatsApp Business com nossa plataforma
                        completa de gerenciamento de conversas.
                    </p>

                    <div className="flex flex-wrap justify-center gap-4">
                        {isConnected ? (
                            <Link href={'/whatsapp'}>
                                <Button size="lg" className="bg-[#00a884] hover:bg-[#00a884]/90 text-white h-14 px-8 text-lg">
                                    <MessageCircle className="w-5 h-5 mr-2" />
                                    Abrir WhatsApp
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </Link>
                        ) : (
                            <Link href={'/whatsapp/connect'}>
                                <Button size="lg" className="bg-[#00a884] hover:bg-[#00a884]/90 text-white h-14 px-8 text-lg">
                                    <QrCode className="w-5 h-5 mr-2" />
                                    Conectar WhatsApp
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                {isConnected && (
                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        <Card className="bg-[#202c33] border-[#2a3942]">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-[#8696a0]">Total de Conversas</CardDescription>
                                <CardTitle className="text-3xl text-[#e9edef] flex items-center gap-2">
                                    {stats.totalConversations}
                                    <Users className="w-6 h-6 text-[#00a884]" />
                                </CardTitle>
                            </CardHeader>
                        </Card>

                        <Card className="bg-[#202c33] border-[#2a3942]">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-[#8696a0]">Mensagens não lidas</CardDescription>
                                <CardTitle className="text-3xl text-[#e9edef] flex items-center gap-2">
                                    {stats.unreadMessages}
                                    <MessageCircle className="w-6 h-6 text-[#00a884]" />
                                </CardTitle>
                            </CardHeader>
                        </Card>

                        <Card className="bg-[#202c33] border-[#2a3942]">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-[#8696a0]">Chats Ativos</CardDescription>
                                <CardTitle className="text-3xl text-[#e9edef] flex items-center gap-2">
                                    {stats.activeChats}
                                    <Zap className="w-6 h-6 text-[#00a884]" />
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    </div>
                )}

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="bg-[#202c33]/50 border-[#2a3942] hover:bg-[#202c33] transition-colors">
                        <CardHeader>
                            <div className="w-12 h-12 rounded-xl bg-[#00a884]/20 flex items-center justify-center mb-4">
                                <MessageSquare className="w-6 h-6 text-[#00a884]" />
                            </div>
                            <CardTitle className="text-[#e9edef]">Chat em Tempo Real</CardTitle>
                            <CardDescription className="text-[#8696a0]">
                                Responda mensagens instantaneamente com interface idêntica ao WhatsApp Web
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className="bg-[#202c33]/50 border-[#2a3942] hover:bg-[#202c33] transition-colors">
                        <CardHeader>
                            <div className="w-12 h-12 rounded-xl bg-[#00a884]/20 flex items-center justify-center mb-4">
                                <Zap className="w-6 h-6 text-[#00a884]" />
                            </div>
                            <CardTitle className="text-[#e9edef]">Respostas Rápidas</CardTitle>
                            <CardDescription className="text-[#8696a0]">
                                Crie atalhos para mensagens frequentes e agilize seu atendimento
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className="bg-[#202c33]/50 border-[#2a3942] hover:bg-[#202c33] transition-colors">
                        <CardHeader>
                            <div className="w-12 h-12 rounded-xl bg-[#00a884]/20 flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-[#00a884]" />
                            </div>
                            <CardTitle className="text-[#e9edef]">Gestão de Contatos</CardTitle>
                            <CardDescription className="text-[#8696a0]">
                                Organize seus contatos com etiquetas e notas personalizadas
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className="bg-[#202c33]/50 border-[#2a3942] hover:bg-[#202c33] transition-colors">
                        <CardHeader>
                            <div className="w-12 h-12 rounded-xl bg-[#00a884]/20 flex items-center justify-center mb-4">
                                <Clock className="w-6 h-6 text-[#00a884]" />
                            </div>
                            <CardTitle className="text-[#e9edef]">Fila de Atendimento</CardTitle>
                            <CardDescription className="text-[#8696a0]">
                                Gerencie conversas com status de atendimento e aguardando
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className="bg-[#202c33]/50 border-[#2a3942] hover:bg-[#202c33] transition-colors">
                        <CardHeader>
                            <div className="w-12 h-12 rounded-xl bg-[#00a884]/20 flex items-center justify-center mb-4">
                                <QrCode className="w-6 h-6 text-[#00a884]" />
                            </div>
                            <CardTitle className="text-[#e9edef]">Conexão Fácil</CardTitle>
                            <CardDescription className="text-[#8696a0]">
                                Conecte-se rapidamente escaneando o QR Code com seu celular
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className="bg-[#202c33]/50 border-[#2a3942] hover:bg-[#202c33] transition-colors">
                        <CardHeader>
                            <div className="w-12 h-12 rounded-xl bg-[#00a884]/20 flex items-center justify-center mb-4">
                                <TrendingUp className="w-6 h-6 text-[#00a884]" />
                            </div>
                            <CardTitle className="text-[#e9edef]">Multi-mídia</CardTitle>
                            <CardDescription className="text-[#8696a0]">
                                Envie e receba imagens, vídeos, documentos e áudios
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>

                {/* Quick Actions */}
                {!isConnected && (
                    <div className="mt-12 text-center">
                        <Card className="bg-gradient-to-r from-[#00a884]/10 to-[#25d366]/10 border-[#00a884]/30 max-w-xl mx-auto">
                            <CardContent className="pt-8 pb-8">
                                <QrCode className="w-16 h-16 text-[#00a884] mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-[#e9edef] mb-2">
                                    Pronto para começar?
                                </h3>
                                <p className="text-[#8696a0] mb-6">
                                    Conecte seu WhatsApp em menos de 1 minuto
                                </p>
                                <Link href={'/whatsapp/connect'}>
                                    <Button size="lg" className="bg-[#00a884] hover:bg-[#00a884]/90 text-white">
                                        Conectar agora
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-[#2a3942]/50 mt-auto">
                <div className="max-w-6xl mx-auto px-6 py-6 text-center text-[#8696a0] text-sm">
                    <p>WhatsApp Business Module • Criptografia de ponta a ponta</p>
                </div>
            </footer>
        </div>
    );
}