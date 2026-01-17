import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  User, 
  Bell, 
  Lock, 
  Palette,
  MessageSquare,
  QrCode,
  LogOut,
  Plus,
  Trash2,
  Save,
  Smartphone
} from 'lucide-react';

export default function SettingsPanel({ 
  session,
  quickReplies = [],
  tags = [],
  onUpdateSession,
  onAddQuickReply,
  onDeleteQuickReply,
  onAddTag,
  onDeleteTag,
  onDisconnect,
  onConnectQR
}) {
  const [newQuickReply, setNewQuickReply] = useState({ shortcut: '', title: '', content: '' });
  const [newTag, setNewTag] = useState({ name: '', color: '#00a884' });

  const handleAddQuickReply = () => {
    if (newQuickReply.shortcut && newQuickReply.content) {
      onAddQuickReply?.(newQuickReply);
      setNewQuickReply({ shortcut: '', title: '', content: '' });
    }
  };

  const handleAddTag = () => {
    if (newTag.name) {
      onAddTag?.(newTag);
      setNewTag({ name: '', color: '#00a884' });
    }
  };

  return (
    <div className="flex-1 bg-[#111b21] overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[#e9edef] mb-6">Configurações</h1>

        <Tabs defaultValue="connection" className="space-y-6">
          <TabsList className="bg-[#202c33] border-[#2a3942]">
            <TabsTrigger value="connection" className="data-[state=active]:bg-[#2a3942] data-[state=active]:text-[#e9edef] text-[#8696a0]">
              <Smartphone className="w-4 h-4 mr-2" />
              Conexão
            </TabsTrigger>
            <TabsTrigger value="quickreplies" className="data-[state=active]:bg-[#2a3942] data-[state=active]:text-[#e9edef] text-[#8696a0]">
              <MessageSquare className="w-4 h-4 mr-2" />
              Respostas Rápidas
            </TabsTrigger>
            <TabsTrigger value="tags" className="data-[state=active]:bg-[#2a3942] data-[state=active]:text-[#e9edef] text-[#8696a0]">
              <Palette className="w-4 h-4 mr-2" />
              Etiquetas
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-[#2a3942] data-[state=active]:text-[#e9edef] text-[#8696a0]">
              <Bell className="w-4 h-4 mr-2" />
              Notificações
            </TabsTrigger>
          </TabsList>

          {/* Connection Tab */}
          <TabsContent value="connection">
            <Card className="bg-[#202c33] border-[#2a3942]">
              <CardHeader>
                <CardTitle className="text-[#e9edef]">Status da Conexão</CardTitle>
                <CardDescription className="text-[#8696a0]">
                  Gerencie sua conexão com o WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-[#182229] rounded-lg">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    session?.status === 'connected' ? "bg-green-500/20" : "bg-red-500/20"
                  )}>
                    <Smartphone className={cn(
                      "w-6 h-6",
                      session?.status === 'connected' ? "text-green-500" : "text-red-500"
                    )} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#e9edef]">
                      {session?.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </p>
                    {session?.phone_number && (
                      <p className="text-sm text-[#8696a0]">{session.phone_number}</p>
                    )}
                  </div>
                  {session?.status === 'connected' ? (
                    <Button 
                      variant="destructive"
                      onClick={onDisconnect}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Desconectar
                    </Button>
                  ) : (
                    <Button 
                      onClick={onConnectQR}
                      className="bg-[#00a884] hover:bg-[#00a884]/90"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Conectar via QR Code
                    </Button>
                  )}
                </div>

                {session?.business_name && (
                  <div className="space-y-2">
                    <Label className="text-[#8696a0]">Nome do Negócio</Label>
                    <Input
                      value={session.business_name}
                      onChange={(e) => onUpdateSession?.({ business_name: e.target.value })}
                      className="bg-[#2a3942] border-none text-[#e9edef]"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Replies Tab */}
          <TabsContent value="quickreplies">
            <Card className="bg-[#202c33] border-[#2a3942]">
              <CardHeader>
                <CardTitle className="text-[#e9edef]">Respostas Rápidas</CardTitle>
                <CardDescription className="text-[#8696a0]">
                  Crie atalhos para mensagens frequentes. Digite / no chat para usar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Quick Reply */}
                <div className="p-4 bg-[#182229] rounded-lg space-y-4">
                  <h4 className="font-medium text-[#e9edef]">Adicionar nova resposta</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[#8696a0]">Atalho</Label>
                      <Input
                        value={newQuickReply.shortcut}
                        onChange={(e) => setNewQuickReply({ ...newQuickReply, shortcut: e.target.value })}
                        placeholder="ex: ola"
                        className="bg-[#2a3942] border-none text-[#e9edef]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#8696a0]">Título (opcional)</Label>
                      <Input
                        value={newQuickReply.title}
                        onChange={(e) => setNewQuickReply({ ...newQuickReply, title: e.target.value })}
                        placeholder="ex: Saudação"
                        className="bg-[#2a3942] border-none text-[#e9edef]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8696a0]">Mensagem</Label>
                    <Input
                      value={newQuickReply.content}
                      onChange={(e) => setNewQuickReply({ ...newQuickReply, content: e.target.value })}
                      placeholder="Olá! Como posso ajudar?"
                      className="bg-[#2a3942] border-none text-[#e9edef]"
                    />
                  </div>
                  <Button 
                    onClick={handleAddQuickReply}
                    className="bg-[#00a884] hover:bg-[#00a884]/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {/* Quick Replies List */}
                <div className="space-y-2">
                  {quickReplies.length === 0 ? (
                    <p className="text-center text-[#8696a0] py-4">
                      Nenhuma resposta rápida cadastrada
                    </p>
                  ) : (
                    quickReplies.map(reply => (
                      <div 
                        key={reply.id}
                        className="flex items-center justify-between p-3 bg-[#182229] rounded-lg"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#00a884] font-medium">/{reply.shortcut}</span>
                            {reply.title && (
                              <span className="text-[#8696a0]">- {reply.title}</span>
                            )}
                          </div>
                          <p className="text-sm text-[#e9edef] mt-1 truncate max-w-md">
                            {reply.content}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteQuickReply?.(reply.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-transparent"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tags Tab */}
          <TabsContent value="tags">
            <Card className="bg-[#202c33] border-[#2a3942]">
              <CardHeader>
                <CardTitle className="text-[#e9edef]">Etiquetas</CardTitle>
                <CardDescription className="text-[#8696a0]">
                  Organize seus contatos com etiquetas coloridas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Tag */}
                <div className="flex items-end gap-4 p-4 bg-[#182229] rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Label className="text-[#8696a0]">Nome da etiqueta</Label>
                    <Input
                      value={newTag.name}
                      onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                      placeholder="ex: Cliente VIP"
                      className="bg-[#2a3942] border-none text-[#e9edef]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8696a0]">Cor</Label>
                    <input
                      type="color"
                      value={newTag.color}
                      onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                  <Button 
                    onClick={handleAddTag}
                    className="bg-[#00a884] hover:bg-[#00a884]/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {/* Tags List */}
                <div className="grid grid-cols-2 gap-2">
                  {tags.length === 0 ? (
                    <p className="col-span-2 text-center text-[#8696a0] py-4">
                      Nenhuma etiqueta cadastrada
                    </p>
                  ) : (
                    tags.map(tag => (
                      <div 
                        key={tag.id}
                        className="flex items-center justify-between p-3 bg-[#182229] rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-[#e9edef]">{tag.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteTag?.(tag.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-transparent h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="bg-[#202c33] border-[#2a3942]">
              <CardHeader>
                <CardTitle className="text-[#e9edef]">Notificações</CardTitle>
                <CardDescription className="text-[#8696a0]">
                  Configure como você recebe notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[#182229] rounded-lg">
                  <div>
                    <p className="font-medium text-[#e9edef]">Som de notificação</p>
                    <p className="text-sm text-[#8696a0]">Reproduzir som ao receber mensagem</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 bg-[#182229] rounded-lg">
                  <div>
                    <p className="font-medium text-[#e9edef]">Pré-visualização</p>
                    <p className="text-sm text-[#8696a0]">Mostrar conteúdo da mensagem na notificação</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 bg-[#182229] rounded-lg">
                  <div>
                    <p className="font-medium text-[#e9edef]">Notificações na área de trabalho</p>
                    <p className="text-sm text-[#8696a0]">Mostrar notificações do sistema</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}