import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Phone, 
  Video, 
  MoreVertical,
  X,
  Archive,
  Pin,
  VolumeX,
  Trash2,
  UserCircle,
  ArrowLeft
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ChatHeader({ 
  conversation, 
  onClose,
  onArchive,
  onPin,
  onMute,
  onDelete,
  onViewContact,
  onBack
}) {
  if (!conversation) return null;

  return (
    <div className="h-16 bg-[#202c33] flex items-center justify-between px-4 border-b border-[#2a3942]">
      <div className="flex items-center gap-3">
        {/* Botão voltar - só aparece no mobile */}
        {onBack && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onBack}
            className="text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942] md:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Avatar className="w-10 h-10 cursor-pointer" onClick={onViewContact}>
          <AvatarImage src={conversation.contact_picture} />
          <AvatarFallback className="bg-[#6b7c85] text-white">
            {conversation.contact_name?.charAt(0) || conversation.contact_phone?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        <div className="cursor-pointer" onClick={onViewContact}>
          <h3 className="font-medium text-[#e9edef]">
            {conversation.contact_name || conversation.contact_phone}
          </h3>
          <p className="text-xs text-[#8696a0]">
            {conversation.status === 'attending' ? 'Atendendo' : 
             conversation.status === 'waiting' ? 'Aguardando' : 
             'Online'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon"
          className="text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942]"
        >
          <Video className="w-5 h-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942]"
        >
          <Phone className="w-5 h-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942]"
        >
          <Search className="w-5 h-5" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942]"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="bg-[#233138] border-[#2a3942] text-[#e9edef] min-w-[200px]"
          >
            <DropdownMenuItem 
              onClick={onViewContact}
              className="hover:bg-[#2a3942] cursor-pointer"
            >
              <UserCircle className="w-4 h-4 mr-2" />
              Dados do contato
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onPin}
              className="hover:bg-[#2a3942] cursor-pointer"
            >
              <Pin className="w-4 h-4 mr-2" />
              {conversation.is_pinned ? 'Desafixar' : 'Fixar conversa'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onMute}
              className="hover:bg-[#2a3942] cursor-pointer"
            >
              <VolumeX className="w-4 h-4 mr-2" />
              {conversation.is_muted ? 'Ativar notificações' : 'Silenciar'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onArchive}
              className="hover:bg-[#2a3942] cursor-pointer"
            >
              <Archive className="w-4 h-4 mr-2" />
              Arquivar conversa
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2a3942]" />
            <DropdownMenuItem 
              onClick={onDelete}
              className="hover:bg-[#2a3942] cursor-pointer text-red-400"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Apagar conversa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onClose && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className="text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942] ml-2"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}