"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertCircle, Info, CheckCircle, AlertTriangle, Send, Building2, Globe } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';

/**
 * Página de Notificações do Módulo Sistema
 * Sistema completo de envio de notificações com diferentes tipos e alvos
 */
export default function SistemaNotificacaoPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    tipo: 'info' as 'info' | 'success' | 'warning' | 'error',
    alvo: 'tenant-atual' as 'tenant-atual' | 'todos-tenants' | 'especifico',
    titulo: '',
    mensagem: '',
    critica: false,
  });

  // Configurações de tipo de notificação
  const tiposNotificacao = [
    { value: 'info', label: 'Informação', icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
    { value: 'success', label: 'Sucesso', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { value: 'warning', label: 'Aviso', icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { value: 'error', label: 'Erro', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  // Opções de alvo
  const alvosNotificacao = [
    { value: 'tenant-atual', label: 'Tenant Atual', icon: Building2, description: 'Apenas usuários do tenant atual' },
    { value: 'todos-tenants', label: 'Todos os Tenants', icon: Globe, description: 'Todos os usuários do sistema' },
  ];

  const tipoAtual = tiposNotificacao.find(t => t.value === formData.tipo);
  const IconeTipo = tipoAtual?.icon || Info;

  // Handler para enviar notificação
  const handleEnviarNotificacao = async () => {
    // Validação
    if (!formData.titulo.trim()) {
      toast({
        title: '❌ Erro de validação',
        description: 'O título é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.mensagem.trim()) {
      toast({
        title: '❌ Erro de validação',
        description: 'A mensagem é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Monta o payload seguindo o padrão do backend
      const payload = {
        titulo: formData.titulo,
        mensagem: formData.mensagem,
        tipo: formData.tipo,
        destino: formData.alvo === 'tenant-atual' ? 'tenant_atual' : 'todos_tenants',
        critica: formData.critica,
      };

      console.log('📤 [NotificacaoPage] Enviando notificação:', payload);

      // Envia para o backend do módulo sistema
      const response = await api.post('/api/sistema/notificacoes/enviar', payload);

      console.log('✅ [NotificacaoPage] Resposta do servidor:', response.data);

      // Feedback de sucesso
      toast({
        title: '✅ Notificação enviada!',
        description: `Notificação do tipo "${tipoAtual?.label}" enviada para ${formData.alvo === 'tenant-atual' ? 'o tenant atual' : 'todos os tenants'}. Confira no ícone de notificações!`,
      });

      // Limpa o formulário
      setFormData({
        tipo: 'info',
        alvo: 'tenant-atual',
        titulo: '',
        mensagem: '',
        critica: false,
      });

      console.log('✅ [NotificacaoPage] Notificação enviada com sucesso');

    } catch (error: any) {
      console.error('❌ [NotificacaoPage] Erro ao enviar notificação:', error);
      
      toast({
        title: '❌ Erro ao enviar notificação',
        description: error.response?.data?.message || 'Ocorreu um erro ao processar a notificação',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Sistema de Notificações</h1>
          <p className="text-muted-foreground mt-1">Envie notificações personalizadas para usuários do sistema</p>
        </div>
      </div>

      {/* Badge de status */}
      <div className="mb-6 flex items-center gap-3">
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Sistema de Notificações Ativo
        </Badge>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Bell className="h-3 w-3 mr-1" />
          Integrado com TopBar
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Envio */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Enviar Notificação</CardTitle>
              <CardDescription>
                Configure e envie notificações personalizadas para os usuários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tipo de Notificação */}
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Notificação</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposNotificacao.map((tipo) => {
                      const Icon = tipo.icon;
                      return (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${tipo.color}`} />
                            <span>{tipo.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Alvo da Notificação */}
              <div className="space-y-2">
                <Label htmlFor="alvo">Destino</Label>
                <Select
                  value={formData.alvo}
                  onValueChange={(value: any) => setFormData({ ...formData, alvo: value })}
                >
                  <SelectTrigger id="alvo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {alvosNotificacao.map((alvo) => {
                      const Icon = alvo.icon;
                      return (
                        <SelectItem key={alvo.value} value={alvo.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <div>
                              <div>{alvo.label}</div>
                              <div className="text-xs text-muted-foreground">{alvo.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">Título da Notificação</Label>
                <Input
                  id="titulo"
                  placeholder="Digite o título..."
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.titulo.length}/100 caracteres
                </p>
              </div>

              {/* Mensagem */}
              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea
                  id="mensagem"
                  placeholder="Digite a mensagem da notificação..."
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.mensagem.length}/500 caracteres
                </p>
              </div>

              {/* Notificação Crítica */}
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="critica"
                  checked={formData.critica}
                  onChange={(e) => setFormData({ ...formData, critica: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1">
                  <Label htmlFor="critica" className="cursor-pointer">
                    Notificação Crítica
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notificações críticas têm prioridade alta e podem gerar alertas sonoros
                  </p>
                </div>
                {formData.critica && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    CRÍTICA
                  </Badge>
                )}
              </div>

              {/* Botão de Envio */}
              <Button
                onClick={handleEnviarNotificacao}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Notificação
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Preview da Notificação */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>Como a notificação aparecerá</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`p-4 rounded-lg border-2 ${tipoAtual?.bg} ${tipoAtual && 'border-' + tipoAtual.value + '-200'}`}>
                <div className="flex items-start gap-3">
                  <IconeTipo className={`h-5 w-5 ${tipoAtual?.color} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-sm">
                        {formData.titulo || 'Título da notificação'}
                      </h4>
                      {formData.critica && (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          !
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      {formData.mensagem || 'Sua mensagem aparecerá aqui...'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {tipoAtual?.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Agora
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações de destino */}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  {formData.alvo === 'tenant-atual' ? (
                    <>
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs">Tenant Atual</span>
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      <span className="text-xs">Todos os Tenants</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Estatísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline" className="bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ativo
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Módulo</span>
                <span className="text-sm font-medium">Sistema</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Integração</span>
                <Badge variant="outline">
                  Conectado
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
