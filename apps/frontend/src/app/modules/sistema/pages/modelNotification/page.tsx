"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Bell, Send, CheckCircle, AlertTriangle, AlertCircle, Info, Shield, Users, Lock, Globe, Building, CheckSquare, Square, Search } from 'lucide-react';
import { notificationTestService, NotificationType, NotificationTarget, NotificationScope } from '../../services/notificationTestService';

export default function Page() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Data Sources
  const [availableTenants, setAvailableTenants] = useState<{ id: string, name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Form States
  const [title, setTitle] = useState('Aviso do Sistema');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<NotificationType>('info');
  const [target, setTarget] = useState<NotificationTarget>('all_users');
  const [scope, setScope] = useState<NotificationScope>('global');
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);

  useEffect(() => {
    // Carrega tenants ao montar
    notificationTestService.getTenants().then(setAvailableTenants);
  }, []);

  const handleSend = async () => {
    if (!title || !description) {
      toast({ title: 'Campos obrigatórios', description: 'Por favor, preencha o título e a mensagem.', variant: 'destructive' });
      return;
    }

    if (scope === 'tenants' && selectedTenantIds.length === 0) {
      toast({ title: 'Seleção Necessária', description: 'Por favor, selecione pelo menos uma empresa destinatária.', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      await notificationTestService.sendNotification({
        title,
        description,
        type,
        target,
        scope,
        tenantIds: scope === 'tenants' ? selectedTenantIds : undefined
      });

      const scopeName = scope === 'global' ? 'Sistema Global' : `${selectedTenantIds.length} Empresas`;

      toast({
        title: 'Aviso Enviado',
        description: `Enviado para: ${scopeName}`,
        className: "bg-green-50 border-green-200 text-green-800"
      });

      setDescription('');
    } catch (error: any) {
      console.error('Erro detalhado:', error.response?.data);
      const msg = error.response?.data?.message;
      toast({
        title: 'Erro no envio',
        description: Array.isArray(msg) ? msg.join(', ') : (msg || 'Falha ao processar solicitação.'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTenant = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedTenantIds(prev => [...prev, id]);
    } else {
      setSelectedTenantIds(prev => prev.filter(tid => tid !== id));
    }
  };

  const toggleAllTenants = () => {
    if (selectedTenantIds.length === filteredTenants.length) {
      setSelectedTenantIds([]);
    } else {
      setSelectedTenantIds(filteredTenants.map(t => t.id));
    }
  };

  const filteredTenants = availableTenants.filter(t =>
    (t.name || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="p-8 container mx-auto max-w-[1600px]">
      <div className="mb-8 border-b pb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          Gerenciador de Avisos
        </h1>
        <p className="text-gray-500 mt-2 text-lg">
          Envie notificações de transmissão para usuários de todo o sistema ou empresas específicas.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Coluna da Esquerda: Formulário (Maior Largura) */}
        <div className="xl:col-span-8 space-y-6">
          <Card className="shadow-md border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-xl">Configuração do Aviso</CardTitle>
              <CardDescription>Defina o conteúdo e o alcance da sua mensagem</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Título */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-base">Título do Aviso</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Manutenção Programada"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-11 text-lg"
                  />
                </div>

                {/* Tipo */}
                <div className="space-y-2">
                  <Label className="text-base">Nível de Importância</Label>
                  <Select value={type} onValueChange={(v: NotificationType) => setType(v)}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Informativo</SelectItem>
                      <SelectItem value="success">Sucesso / Novidade</SelectItem>
                      <SelectItem value="warning">Atenção / Alerta</SelectItem>
                      <SelectItem value="error">Crítico / Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mensagem */}
              <div className="space-y-2">
                <Label htmlFor="desc" className="text-base">Conteúdo da Mensagem</Label>
                <Textarea
                  id="desc"
                  placeholder="Digite a mensagem completa que aparecerá para os usuários..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="text-base resize-none"
                />
              </div>

              <hr className="border-gray-100" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coluna Audiência */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Audiência
                  </h3>

                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="space-y-2">
                      <Label>Escopo de Envio</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={scope === 'global' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setScope('global')}
                        >
                          <Globe className="mr-2 h-4 w-4" /> Global
                        </Button>
                        <Button
                          type="button"
                          variant={scope === 'tenants' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setScope('tenants')}
                        >
                          <Building className="mr-2 h-4 w-4" /> Por Empresa
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Quem recebe?</Label>
                      <Select value={target} onValueChange={(v: NotificationTarget) => setTarget(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_users">Todos os Usuários no escopo</SelectItem>
                          <SelectItem value="admins_only">Apenas Administradores</SelectItem>
                          <SelectItem value="super_admins">Apenas Super Admins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Coluna Seleção de Empresas (Condicional) */}
                {scope === 'tenants' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" /> Selecionar Empresas
                      </h3>
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {selectedTenantIds.length} selecionadas
                      </span>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col h-[280px]">
                      <div className="p-2 border-b border-gray-100 bg-gray-50 flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                          <Input
                            placeholder="Filtrar empresas..."
                            className="h-8 pl-8 text-xs bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs px-2"
                          onClick={toggleAllTenants}
                        >
                          {selectedTenantIds.length === filteredTenants.length ? 'Nenhuma' : 'Todas'}
                        </Button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredTenants.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            Nenhuma empresa encontrada
                          </div>
                        ) : (
                          filteredTenants.map(tenant => (
                            <label
                              key={tenant.id}
                              className={`flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors ${selectedTenantIds.includes(tenant.id) ? 'bg-primary/5' : ''
                                }`}
                            >
                              <Checkbox
                                checked={selectedTenantIds.includes(tenant.id)}
                                onCheckedChange={(checked) => toggleTenant(tenant.id, checked as boolean)}
                              />
                              <span className="text-sm font-medium text-gray-700">{tenant.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
            <CardFooter className="bg-gray-50 flex justify-end p-6 border-t rounded-b-lg">
              <Button onClick={handleSend} disabled={loading} size="lg" className="w-full md:w-auto gap-2 bg-primary hover:bg-primary/90 shadow-sm">
                {loading ? 'Enviando...' : (
                  <>
                    <Send className="h-5 w-5" /> Enviar Aviso Agora
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Coluna da Direita: Preview (Lateral) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-6">
            <Label className="text-gray-500 font-medium uppercase text-xs tracking-wider mb-4 block">
              Preview no Dispositivo
            </Label>

            {/* Card Preview Notification */}
            <div className="bg-white rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-4 relative overflow-hidden mb-6">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${type === 'error' ? 'bg-red-500' :
                type === 'warning' ? 'bg-yellow-500' :
                  type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                }`}></div>

              <div className="flex gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${type === 'error' ? 'bg-red-50 text-red-600' :
                  type === 'warning' ? 'bg-yellow-50 text-yellow-600' :
                    type === 'success' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                  {type === 'error' ? <AlertCircle className="h-6 w-6" /> :
                    type === 'warning' ? <AlertTriangle className="h-6 w-6" /> :
                      type === 'success' ? <CheckCircle className="h-6 w-6" /> : <Info className="h-6 w-6" />}
                </div>
                <div className="space-y-1.5 w-full min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-gray-900 truncate pr-2">{title || 'Título do Aviso'}</h4>
                    <span className="text-[10px] text-gray-400 font-medium">Agora</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-snug break-words">
                    {description || 'Sua mensagem aparecerá aqui com este visual para os usuários...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Resumo */}
            <div className="space-y-4 border-t border-gray-100 pt-6">
              <h4 className="font-medium text-sm text-gray-900">Resumo do Envio</h4>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Escopo:</span>
                <span className={`font-medium px-2 py-0.5 rounded text-xs ${scope === 'global' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                  {scope === 'global' ? 'GLOBAL' : 'POR EMPRESA'}
                </span>
              </div>

              {scope === 'tenants' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Empresas:</span>
                  <span className="font-medium text-gray-900">{selectedTenantIds.length} selecionadas</span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Destinatários:</span>
                <span className="font-medium text-gray-900">
                  {target === 'all_users' ? 'Todos os Usuários' :
                    target === 'admins_only' ? 'Apenas Admins' : 'Super Admins'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}