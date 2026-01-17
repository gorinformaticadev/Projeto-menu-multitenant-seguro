import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function NewChatDialog({ 
  isOpen, 
  onClose, 
  contacts = [],
  onSelectContact,
  onCreateContact
}) {
  const [search, setSearch] = useState('');
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ phone: '', name: '' });

  const filteredContacts = contacts.filter(contact => 
    contact.name?.toLowerCase().includes(search.toLowerCase()) ||
    contact.phone?.includes(search)
  );

  const handleCreateContact = () => {
    if (newContact.phone) {
      onCreateContact?.(newContact);
      setNewContact({ phone: '', name: '' });
      setShowNewContact(false);
    }
  };

  const handleStartChat = () => {
    if (search && search.match(/^\+?[\d\s-]+$/)) {
      onSelectContact?.({ phone: search.replace(/\s|-/g, ''), name: '' });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#202c33] border-[#2a3942] text-[#e9edef] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Nova conversa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search / Phone Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ou digitar número"
              className="pl-10 bg-[#2a3942] border-none text-[#e9edef] placeholder:text-[#8696a0]"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewContact(true)}
              className="flex-1 bg-transparent border-[#2a3942] text-[#e9edef] hover:bg-[#2a3942]"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Novo contato
            </Button>
            {search && search.match(/^\+?[\d\s-]+$/) && (
              <Button
                onClick={handleStartChat}
                className="flex-1 bg-[#00a884] hover:bg-[#00a884]/90 text-white"
              >
                Iniciar chat
              </Button>
            )}
          </div>

          {/* New Contact Form */}
          {showNewContact && (
            <div className="bg-[#182229] p-4 rounded-lg space-y-3">
              <h4 className="font-medium">Adicionar novo contato</h4>
              <div className="space-y-2">
                <Label className="text-[#8696a0] text-sm">Telefone</Label>
                <Input
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="+55 11 99999-9999"
                  className="bg-[#2a3942] border-none text-[#e9edef]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8696a0] text-sm">Nome (opcional)</Label>
                <Input
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Nome do contato"
                  className="bg-[#2a3942] border-none text-[#e9edef]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowNewContact(false)}
                  className="flex-1 bg-transparent border-[#2a3942] text-[#e9edef] hover:bg-[#2a3942]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateContact}
                  className="flex-1 bg-[#00a884] hover:bg-[#00a884]/90 text-white"
                >
                  Salvar e iniciar
                </Button>
              </div>
            </div>
          )}

          {/* Contact List */}
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredContacts.length === 0 ? (
              <p className="text-center text-[#8696a0] py-8">
                {search ? 'Nenhum contato encontrado' : 'Seus contatos aparecerão aqui'}
              </p>
            ) : (
              filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => {
                    onSelectContact?.(contact);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a3942] transition-colors"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={contact.profile_picture} />
                    <AvatarFallback className="bg-[#6b7c85] text-white">
                      {contact.name?.charAt(0) || contact.phone?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-medium">{contact.name || contact.phone}</p>
                    {contact.name && (
                      <p className="text-sm text-[#8696a0]">{contact.phone}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}