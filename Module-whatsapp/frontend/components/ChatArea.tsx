"use client";

import React, { useEffect, useRef } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ChatHeader from './ChatHeader';
import { FileText, UserPlus, Bot, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

const DateDivider = ({ date }) => (
    <div className="flex items-center justify-center my-4">
        <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1 rounded-lg shadow">
            {format(parseISO(date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </span>
    </div>
);

const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-[#8696a0]">
        <div className="flex gap-4 mb-6">
            <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-[#202c33] hover:bg-[#2a3942] transition-colors cursor-pointer">
                <div className="w-14 h-14 rounded-full bg-[#2a3942] flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                </div>
                <span className="text-sm">Enviar documento</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-[#202c33] hover:bg-[#2a3942] transition-colors cursor-pointer">
                <div className="w-14 h-14 rounded-full bg-[#2a3942] flex items-center justify-center">
                    <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-sm">Adicionar contato</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-[#202c33] hover:bg-[#2a3942] transition-colors cursor-pointer">
                <div className="w-14 h-14 rounded-full bg-[#0084ff] flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm">Perguntar à Meta AI</span>
            </div>
        </div>
    </div>
);

export default function ChatArea({
    conversation,
    messages = [],
    isLoading,
    onSendMessage,
    onClose,
    onArchive,
    onPin,
    onMute,
    onDelete,
    onViewContact,
    quickReplies = [],
    onBack
}) {
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!conversation) {
        return (
            <div className="flex-1 bg-[#0b141a] flex-col hidden md:flex">
                <div
                    className="flex-1 flex items-center justify-center"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23202c33' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                    }}
                >
                    <EmptyState />
                </div>
            </div>
        );
    }

    // Group messages by date
    const groupedMessages = messages.reduce((groups, message) => {
        const date = message.timestamp ? format(parseISO(message.timestamp), 'yyyy-MM-dd') : 'unknown';
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(message);
        return groups;
    }, {});

    return (
        <div className="flex-1 bg-[#0b141a] flex flex-col">
            <ChatHeader
                conversation={conversation}
                onClose={onClose}
                onArchive={onArchive}
                onPin={onPin}
                onMute={onMute}
                onDelete={onDelete}
                onViewContact={onViewContact}
                onBack={onBack}
            />

            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 md:px-16 py-4"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23202c33' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {Object.entries(groupedMessages).map(([date, msgs]) => (
                            <div key={date}>
                                <DateDivider date={date} />
                                {msgs.map((message) => (
                                    <MessageBubble key={message.id} message={message} />
                                ))}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <ChatInput
                onSend={onSendMessage}
                onAttachment={(att) => console.log('Attachment:', att)}
                quickReplies={quickReplies}
            />
        </div>
    );
}