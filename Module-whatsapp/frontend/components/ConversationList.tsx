import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { 
  Search, 
  Plus, 
  Filter,
  MoreVertical,
  Pin,
  VolumeX,
  Check,
  CheckCheck,
  Mic,
  Image,
  Video,
  FileText,
  Clock
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = parseISO(dateString);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ontem';
  return format(date, 'dd/MM/yyyy');
};

const getMessageIcon = (type, isFromMe) => {
  switch(type) {
    case 'audio': return <Mic className="w-3 h-3" />;
    case 'image': return <Image className="w-3 h-3" />;
    case 'video': return <Video className="w-3 h-3" />;
    case 'document': return <FileText className="w-3 h-3" />;
    default: return null;
  }
};

const getStatusIcon = (status) => {
  switch(status) {
    case 'sent': return <Check className="w-3 h-3 text-[#8696a0]" />;
    case 'delivered': return <CheckCheck className="w-3 h-3 text-[#8696a0]" />;
    case 'read': return <CheckCheck className="w-3 h-3 text-[#53bdeb]" />;
    case 'pending': return <Clock className="w-3 h-3 text-[#8696a0]" />;
    default: return null;
  }
};

export default function ConversationList({ 
  conversations = [], 
  selectedId, 
  onSelect, 
  isLoading,
  onNewChat,
  isMobileOpen,
  onCloseMobile
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('open'); // "Abertas" como padrão
  const [statusFilter, setStatusFilter] = useState('attending');

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !search || 
      conv.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      conv.contact_phone?.includes(search);
    
    let matchesFilter = true;
    if (filter === 'all') matchesFilter = true;
    if (filter === 'open') matchesFilter = conv.status !== 'resolved';
    if (filter === 'resolved') matchesFilter = conv.status === 'resolved';
    
    // Sub-filtro só se aplica quando "Abertas" está selecionado
    let matchesStatus = true;
    if (filter === 'open') {
      if (statusFilter === 'attending') matchesStatus = conv.status === 'attending' || conv.status === 'open';
      if (statusFilter === 'waiting') matchesStatus = conv.status === 'waiting';
    }
    
    return matchesSearch && matchesFilter && matchesStatus && !conv.is_archived;
  });

  return (
    <div className={cn(
      "bg-[#111b21] flex flex-col border-r border-[#2a3942]",
      "w-full md:w-[340px]",
      "fixed md:relative inset-0 z-30 md:z-auto",
      "transition-transform duration-300",
      isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      {/* Header Tabs */}
      <div className="px-4 pt-3 pb-2">
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="bg-transparent border-b border-[#2a3942] rounded-none w-full justify-start gap-2 h-auto p-0">
            <TabsTrigger 
              value="all" 
              className="rounded-full data-[state=active]:bg-[#00a884] data-[state=active]:text-white text-[#8696a0] px-4 py-1.5 text-sm"
            >
              Tudo
            </TabsTrigger>
            <TabsTrigger 
              value="open" 
              className="rounded-full data-[state=active]:bg-[#00a884] data-[state=active]:text-white text-[#8696a0] px-4 py-1.5 text-sm"
            >
              Abertas
            </TabsTrigger>
            <TabsTrigger 
              value="resolved" 
              className="rounded-full data-[state=active]:bg-[#00a884] data-[state=active]:text-white text-[#8696a0] px-4 py-1.5 text-sm"
            >
              Resolvido
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search and Actions */}
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar"
            className="pl-10 bg-[#202c33] border-none text-[#e9edef] placeholder:text-[#8696a0] h-9 rounded-lg focus-visible:ring-0"
          />
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]"
        >
          <Filter className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onNewChat}
          className="text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      {/* Status Filter Tabs - Só aparece quando "Abertas" está selecionado */}
      {filter === 'open' && (
        <div className="px-4 pb-2">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <TabsList className="bg-transparent rounded-none w-full justify-start gap-4 h-auto p-0">
              <TabsTrigger 
                value="attending" 
                className="rounded-none border-b-2 data-[state=active]:border-[#00a884] border-transparent data-[state=active]:bg-transparent bg-transparent text-[#8696a0] data-[state=active]:text-[#e9edef] px-0 py-2 text-sm"
              >
                Atendendo
              </TabsTrigger>
              <TabsTrigger 
                value="waiting" 
                className="rounded-none border-b-2 data-[state=active]:border-[#00a884] border-transparent data-[state=active]:bg-transparent bg-transparent text-[#8696a0] data-[state=active]:text-[#e9edef] px-0 py-2 text-sm"
              >
                Aguardando
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#8696a0]">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => {
                onSelect(conversation);
                if (onCloseMobile) onCloseMobile();
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors",
                selectedId === conversation.id 
                  ? "bg-[#2a3942]" 
                  : "hover:bg-[#202c33]"
              )}
            >
              <Avatar className="w-12 h-12 flex-shrink-0">
                <AvatarImage src={conversation.contact_picture} />
                <AvatarFallback className="bg-[#6b7c85] text-white text-lg">
                  {conversation.contact_name?.charAt(0) || conversation.contact_phone?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#e9edef] truncate">
                    {conversation.contact_name || conversation.contact_phone}
                  </span>
                  <span className={cn(
                    "text-xs flex-shrink-0",
                    conversation.unread_count > 0 ? "text-[#00a884]" : "text-[#8696a0]"
                  )}>
                    {formatTime(conversation.last_message_time)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="flex items-center gap-1 text-[#8696a0] text-sm truncate">
                    {conversation.is_from_me && getStatusIcon(conversation.message_status)}
                    {getMessageIcon(conversation.message_type)}
                    <span className="truncate">{conversation.last_message || 'Sem mensagens'}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {conversation.is_pinned && (
                      <Pin className="w-3 h-3 text-[#8696a0]" />
                    )}
                    {conversation.is_muted && (
                      <VolumeX className="w-3 h-3 text-[#8696a0]" />
                    )}
                    {conversation.unread_count > 0 && (
                      <Badge className="bg-[#00a884] text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5 hover:bg-[#00a884]">
                        {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Mobile close overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[-1] md:hidden"
          onClick={onCloseMobile}
        />
      )}
    </div>
  );
}

const MessageSquare = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);