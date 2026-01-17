import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  X, 
  Phone, 
  Mail, 
  Building2, 
  Tag,
  Star,
  Bell,
  BellOff,
  Archive,
  Trash2,
  Ban,
  Edit2,
  Save,
  Plus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ContactProfile({ 
  contact, 
  conversation,
  tags = [],
  isOpen,
  onClose,
  onUpdate,
  onBlock,
  onArchive,
  onDelete
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContact, setEditedContact] = useState(contact || {});
  const [showTagDialog, setShowTagDialog] = useState(false);

  const handleSave = () => {
    onUpdate?.(editedContact);
    setIsEditing(false);
  };

  const toggleTag = (tagId) => {
    const currentTags = editedContact.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(t => t !== tagId)
      : [...currentTags, tagId];
    setEditedContact({ ...editedContact, tags: newTags });
  };

  if (!isOpen) return null;

  return (
    <div className="w-[400px] bg-[#111b21] border-l border-[#2a3942] flex flex-col h-full">
      {/* Header */}
      <div className="h-16 bg-[#202c33] flex items-center justify-between px-4 border-b border-[#2a3942]">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className="text-[#aebac1] hover:text-[#e9edef] hover:bg-transparent"
          >
            <X className="w-5 h-5" />
          </Button>
          <h3 className="text-[#e9edef] font-medium">Dados do contato</h3>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="text-[#aebac1] hover:text-[#e9edef] hover:bg-transparent"
        >
          {isEditing ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Section */}
        <div className="p-6 flex flex-col items-center bg-[#202c33]">
          <Avatar className="w-32 h-32 mb-4">
            <AvatarImage src={contact?.profile_picture} />
            <AvatarFallback className="bg-[#6b7c85] text-white text-4xl">
              {contact?.name?.charAt(0) || contact?.phone?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          {isEditing ? (
            <Input
              value={editedContact.name || ''}
              onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
              className="text-center bg-[#2a3942] border-none text-[#e9edef] text-xl font-medium"
              placeholder="Nome do contato"
            />
          ) : (
            <h2 className="text-xl font-medium text-[#e9edef]">
              {contact?.name || contact?.phone}
            </h2>
          )}
          
          <p className="text-[#8696a0] mt-1">{contact?.phone}</p>
          
          {contact?.is_business && (
            <Badge className="mt-2 bg-[#00a884]/20 text-[#00a884]">
              <Building2 className="w-3 h-3 mr-1" />
              Conta Business
            </Badge>
          )}
        </div>

        {/* Tags Section */}
        <div className="p-4 border-t border-[#2a3942]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[#8696a0] text-sm font-medium flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Etiquetas
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTagDialog(true)}
              className="text-[#00a884] hover:text-[#00a884]/80 hover:bg-transparent h-auto p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {tags
              .filter(tag => editedContact.tags?.includes(tag.id))
              .map(tag => (
                <Badge 
                  key={tag.id}
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  className="border-none"
                >
                  {tag.name}
                  {isEditing && (
                    <button 
                      onClick={() => toggleTag(tag.id)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))
            }
            {(!editedContact.tags || editedContact.tags.length === 0) && (
              <span className="text-[#8696a0] text-sm">Nenhuma etiqueta</span>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="p-4 border-t border-[#2a3942]">
          <h4 className="text-[#8696a0] text-sm font-medium mb-3">Observações</h4>
          {isEditing ? (
            <Textarea
              value={editedContact.notes || ''}
              onChange={(e) => setEditedContact({ ...editedContact, notes: e.target.value })}
              className="bg-[#2a3942] border-none text-[#e9edef] resize-none"
              placeholder="Adicionar observações..."
              rows={4}
            />
          ) : (
            <p className="text-[#e9edef] text-sm">
              {contact?.notes || <span className="text-[#8696a0]">Nenhuma observação</span>}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#2a3942] space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-[#e9edef] hover:bg-[#202c33]"
            onClick={() => conversation?.is_muted ? null : null}
          >
            {conversation?.is_muted ? (
              <>
                <Bell className="w-5 h-5 mr-3 text-[#8696a0]" />
                Ativar notificações
              </>
            ) : (
              <>
                <BellOff className="w-5 h-5 mr-3 text-[#8696a0]" />
                Silenciar notificações
              </>
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-[#e9edef] hover:bg-[#202c33]"
            onClick={() => conversation && onArchive?.(conversation)}
          >
            <Archive className="w-5 h-5 mr-3 text-[#8696a0]" />
            Arquivar conversa
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-400 hover:bg-[#202c33] hover:text-red-400"
            onClick={() => contact && onBlock?.(contact)}
          >
            <Ban className="w-5 h-5 mr-3" />
            Bloquear contato
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-400 hover:bg-[#202c33] hover:text-red-400"
            onClick={() => conversation && onDelete?.(conversation)}
          >
            <Trash2 className="w-5 h-5 mr-3" />
            Apagar conversa
          </Button>
        </div>
      </div>

      {/* Tag Selection Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="bg-[#202c33] border-[#2a3942] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>Selecionar Etiquetas</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border transition-colors",
                  editedContact.tags?.includes(tag.id)
                    ? "border-[#00a884] bg-[#00a884]/10"
                    : "border-[#2a3942] hover:bg-[#2a3942]"
                )}
              >
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm">{tag.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}