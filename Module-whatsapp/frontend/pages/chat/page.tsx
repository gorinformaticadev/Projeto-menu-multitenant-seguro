"use client";

import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import ConversationList from '../../components/ConversationList';
import ChatArea from '../../components/ChatArea';
import ContactProfile from '../../components/ContactProfile';
import NewChatDialog from '../../components/NewChatDialog';
import SettingsPanel from '../../components/SettingsPanel';
import QRCodeScanner from '../../components/QrCodeScanner';

export default function WhatsAppPage() {
    const [activeMenu, setActiveMenu] = useState('chats');
    const [selectedConversation, setSelectedConversation] = useState<any>(null);
    const [showContactProfile, setShowContactProfile] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [showMobileConversations, setShowMobileConversations] = useState(true);

    // Mock Data
    const currentSession = { id: '1', status: 'connected', phone_number: '+55 11 99999-9999', qr_code: '' };

    const conversations = [
        { id: '1', contact_name: 'João Silva', contact_phone: '+55 11 98888-8888', unread_count: 2, last_message: 'Olá, tudo bem?', last_message_time: new Date().toISOString(), status: 'open' },
        { id: '2', contact_name: 'Maria Oliveira', contact_phone: '+55 11 97777-7777', unread_count: 0, last_message: 'Obrigado!', last_message_time: new Date().toISOString(), status: 'resolved' },
    ];

    const messages = [
        { id: '1', content: 'Olá!', is_from_me: false, timestamp: new Date().toISOString() },
        { id: '2', content: 'Como posso ajudar?', is_from_me: true, timestamp: new Date().toISOString() },
    ];

    const contacts = [
        { phone: '+55 11 98888-8888', name: 'João Silva' },
        { phone: '+55 11 97777-7777', name: 'Maria Oliveira' },
    ];

    const quickReplies: any[] = [];
    const tags: any[] = [];

    // Handlers
    const handleSendMessage = (messageData: any) => {
        console.log('Send message:', messageData);
    };

    const handleSelectContact = (contact: any) => {
        console.log('Select contact:', contact);
        setShowNewChat(false);
    };

    return (
        <div className="h-screen flex bg-[#111b21] overflow-hidden">
            {/* Left Sidebar */}
            <Sidebar
                activeMenu={activeMenu}
                onMenuChange={setActiveMenu}
                unreadCount={2}
                connectionStatus={currentSession.status}
            />

            {/* Main Content */}
            {activeMenu === 'settings' ? (
                <SettingsPanel
                    session={currentSession}
                    quickReplies={quickReplies}
                    tags={tags}
                    onAddQuickReply={() => { }}
                    onDeleteQuickReply={() => { }}
                    onAddTag={() => { }}
                    onDeleteTag={() => { }}
                    onDisconnect={() => setShowQRScanner(true)}
                    onConnectQR={() => setShowQRScanner(true)}
                />
            ) : (
                <>
                    {/* Conversation List */}
                    <ConversationList
                        conversations={conversations}
                        selectedId={selectedConversation?.id}
                        onSelect={(conv: any) => {
                            setSelectedConversation(conv);
                            setShowMobileConversations(false);
                        }}
                        isLoading={false}
                        onNewChat={() => setShowNewChat(true)}
                        isMobileOpen={showMobileConversations}
                        onCloseMobile={() => setShowMobileConversations(false)}
                    />

                    {/* Chat Area */}
                    <ChatArea
                        conversation={selectedConversation}
                        messages={messages}
                        isLoading={false}
                        onSendMessage={handleSendMessage}
                        onArchive={() => { }}
                        onPin={() => { }}
                        onMute={() => { }}
                        onViewContact={() => setShowContactProfile(true)}
                        quickReplies={quickReplies}
                        onBack={() => setShowMobileConversations(true)}
                    />

                    {/* Contact Profile Panel */}
                    {selectedConversation && (
                        <ContactProfile
                            contact={contacts.find(c => c.phone === selectedConversation.contact_phone)}
                            conversation={selectedConversation}
                            tags={tags}
                            isOpen={showContactProfile}
                            onClose={() => setShowContactProfile(false)}
                            onArchive={() => { }}
                        />
                    )}
                </>
            )}

            {/* New Chat Dialog */}
            <NewChatDialog
                isOpen={showNewChat}
                onClose={() => setShowNewChat(false)}
                contacts={contacts}
                onSelectContact={handleSelectContact}
            />
        </div>
    );
}
