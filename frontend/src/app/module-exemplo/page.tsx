/**
 * PÁGINA PRINCIPAL DO MODULE EXEMPLO
 * 
 * Demonstra integração completa com sistema de notificações
 */

"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Bell, 
  Send, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  Loader2,
  Sparkles
} from "lucide-react";
import { notificationsService } from "@/services/notifications.service";

export default function ModuleExemploPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estados para formulário de notificação
  const [notificationForm, setNotificationForm] = useState({
    type: 'task_completed',
    title: '',
    message: '',
    severity: 'info' as 'info' | 'warning' | 'critical',
    audience: 'user' as 'user' | 'tenant' | 'global',
  });
  
  const [sending, setSending] = useState(false);

  // Tipos de notificação disponíveis
  const notificationTypes = [
    { value: 'task_completed', label: 'Tarefa Concluída', icon: CheckCircle },
    { value: 'task_failed', label: 'Falha na Tarefa', icon: AlertTriangle },
    { value: 'data_exported', label: 'Dados Exportados', icon: Package },
    { value: 'integration_warning', label: 'Aviso de Integração', icon: AlertTriangle },
    { value: 'quota_exceeded', label: 'Cota Excedida', icon: AlertTriangle },
  ];

  const severityOptions = [
    { value: 'info', label: 'Informação', color: 'bg-blue-100 text-blue-800' },
    { value: 'warning', label: 'Aviso', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'critical', label: 'Crítica', color: 'bg-red-100 text-red-800' },
  ];

  const audienceOptions = [
    { value: 'user', label: 'Apenas para mim', description: 'Notificação pessoal' },
    { value: 'tenant', label: 'Para toda empresa', description: 'Todos os admins da empresa verão' },
    { value: 'global', label: 'Global (Super Admin)', description: 'Apenas super admins verão' },
  ];

  /**
   * Envia notificação de teste
   */
  const handleSendNotification = async () => {
    if (!notificationForm.title || !notificationForm.message) {
      toast({
        title: "Erro",
        description: "Título e mensagem são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      // Determina targeting baseado na audiência
      let tenantId: string | null = null;
      let userId: string | null = null;

      if (notificationForm.audience === 'user') {
        userId = user?.id || null;
        tenantId = user?.tenantId || null;
      } else if (notificationForm.audience === 'tenant') {
        tenantId = user?.tenantId || null;
      }
      // global = ambos null

      // Emite evento de notificação
      await notificationsService.emitEvent({
        type: `module-exemplo.${notificationForm.type}`,
        source: 'module',
        module: 'module-exemplo',
        severity: notificationForm.severity,
        tenantId,
        userId,
        payload: {
          title: notificationForm.title,
          message: notificationForm.message,
          context: '/module-exemplo',
          data: {
            generatedBy: user?.name,
            generatedAt: new Date().toISOString(),
            testNotification: true,
          },
        },
      });

      toast({
        title: "Notificação Enviada!",
        description: "A notificação foi criada com sucesso.",
      });

      // Limpa formulário
      setNotificationForm({
        type: 'task_completed',
        title: '',
        message: '',
        severity: 'info',
        audience: 'user',
      });

      // Dispara evento para atualizar dropdown
      window.dispatchEvent(new CustomEvent('newNotification'));

    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar notificação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  /**
   * Gera notificações de exemplo
   */
  const generateExampleNotifications = async () => {
    setSending(true);

    try {
      const examples = [
        {
          type: 'task_completed',
          title: 'Relatório Mensal Gerado',
          message: 'O relatório mensal de vendas foi processado com sucesso.',
          severity: 'info' as const,
        },
        {
          type: 'integration_warning',
          title: 'Aviso de Integração',
          message: 'A integração com o sistema externo está com lentidão.',
          severity: 'warning' as const,
        },
        {
          type: 'data_exported',
          title: 'Exportação Concluída',
          message: 'Arquivo de clientes exportado com 1.234 registros.',
          severity: 'info' as const,
        },
      ];

      for (const example of examples) {
        await notificationsService.emitEvent({
          type: `module-exemplo.${example.type}`,
          source: 'module',
          module: 'module-exemplo',
          severity: example.severity,
          tenantId: user?.tenantId || null,
          userId: user?.id || null,
          payload: {
            title: example.title,
            message: example.message,
            context: '/module-exemplo',
            data: {
              generatedBy: user?.name,
              generatedAt: new Date().toISOString(),
              exampleNotification: true,
            },
          },
        });

        // Pequeno delay entre notificações
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: "Notificações de Exemplo Criadas!",
        description: `${examples.length} notificações foram geradas.`,
      });

      // Dispara evento para atualizar dropdown
      window.dispatchEvent(new CustomEvent('newNotification'));

    } catch (error) {
      console.error('Erro ao gerar notificações de exemplo:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar notificações de exemplo.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Module Exemplo</h1>
            <p className="text-gray-600">Demonstração do sistema de notificações modular</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Ativo
          </Badge>
          <Badge variant="outline">
            v1.0.0
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gerador de Notificações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Gerador de Notificações
            </CardTitle>
            <CardDescription>
              Crie notificações personalizadas para testar o sistema
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Tipo de Notificação */}
            <div>
              <Label htmlFor="type">Tipo de Notificação</Label>
              <select
                id="type"
                value={notificationForm.type}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {notificationTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={notificationForm.title}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Digite o título da notificação"
                maxLength={100}
              />
              <p className="text-xs text-gray-500 mt-1">
                {notificationForm.title.length}/100 caracteres
              </p>
            </div>

            {/* Mensagem */}
            <div>
              <Label htmlFor="message">Mensagem</Label>
              <textarea
                id="message"
                value={notificationForm.message}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Digite a mensagem da notificação"
                rows={3}
                maxLength={500}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {notificationForm.message.length}/500 caracteres
              </p>
            </div>

            {/* Severidade */}
            <div>
              <Label>Severidade</Label>
              <div className="flex gap-2 mt-1">
                {severityOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setNotificationForm(prev => ({ ...prev, severity: option.value as any }))}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      notificationForm.severity === option.value
                        ? option.color
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audiência */}
            <div>
              <Label>Audiência</Label>
              <div className="space-y-2 mt-1">
                {audienceOptions.map(option => (
                  <label key={option.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="audience"
                      value={option.value}
                      checked={notificationForm.audience === option.value}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, audience: e.target.value as any }))}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-gray-500">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSendNotification}
                disabled={sending || !notificationForm.title || !notificationForm.message}
                className="flex-1"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar Notificação
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ações Rápidas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Ações Rápidas
            </CardTitle>
            <CardDescription>
              Demonstrações e testes do sistema de notificações
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Informações do Usuário */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm text-gray-900 mb-2">Informações do Usuário</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <p><strong>Nome:</strong> {user?.name}</p>
                <p><strong>Email:</strong> {user?.email}</p>
                <p><strong>Role:</strong> {user?.role}</p>
                {user?.tenant && (
                  <p><strong>Empresa:</strong> {user.tenant.nomeFantasia}</p>
                )}
              </div>
            </div>

            {/* Botão de Notificações de Exemplo */}
            <Button
              onClick={generateExampleNotifications}
              disabled={sending}
              variant="outline"
              className="w-full"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Gerar Notificações de Exemplo
            </Button>

            {/* Informações sobre o Sistema */}
            <div className="space-y-3 pt-2">
              <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 mb-1">Como Funciona</p>
                    <p className="text-blue-700">
                      As notificações são processadas pelo backend e aparecem no dropdown da topbar. 
                      Cada usuário vê apenas as notificações relevantes para seu perfil.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded">
                  <Info className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-blue-900">Info</p>
                  <p className="text-xs text-blue-700">Usuários</p>
                </div>
                <div className="p-2 bg-yellow-50 rounded">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-yellow-900">Aviso</p>
                  <p className="text-xs text-yellow-700">Admins</p>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <AlertTriangle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-red-900">Crítica</p>
                  <p className="text-xs text-red-700">Super Admin</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funcionalidades do Módulo */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Funcionalidades do Módulo</CardTitle>
          <CardDescription>
            Este módulo demonstra a integração completa com o sistema de notificações
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">✅ Implementado</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Emissão de notificações personalizadas</li>
                <li>• Integração com sistema de audiência</li>
                <li>• Notificações de ativação/desativação</li>
                <li>• Validação de permissões</li>
                <li>• Persistência no banco de dados</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">🔄 Automático</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Notificação ao ativar módulo</li>
                <li>• Notificação ao desativar módulo</li>
                <li>• Filtragem por perfil de usuário</li>
                <li>• Isolamento por tenant</li>
                <li>• Limpeza automática de notificações antigas</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}