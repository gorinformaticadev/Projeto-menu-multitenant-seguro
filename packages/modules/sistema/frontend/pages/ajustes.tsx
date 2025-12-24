
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bell, Save } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function SistemaAjustesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({
    title: '',
    content: '',
    audience: 'all',
    cronExpression: '0 0 * * *',
    enabled: true
  });

  // Helpers
  const getFrequencyType = (cron: string) => {
    if (!cron) return 'daily';
    if (cron.startsWith('*/')) return 'interval';
    const parts = cron.split(' ');
    if (parts.length < 5) return 'custom';

    // Daily: "MINUTE HOUR * * *"
    if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') return 'daily';
    // Weekly: "MINUTE HOUR * * WEEKDAY"
    if (parts[2] === '*' && parts[3] === '*' && parts[4] !== '*') return 'weekly';
    // Monthly: "MINUTE HOUR DAY * *"
    if (parts[2] !== '*' && parts[3] === '*' && parts[4] === '*') return 'monthly';

    return 'custom';
  };

  const getTimeFromCron = (cron: string) => {
    try {
      const parts = cron.split(' ');
      if (parts.length < 2) return '09:00';
      const minute = parts[0].padStart(2, '0');
      const hour = parts[1].padStart(2, '0');
      return `${hour}:${minute}`;
    } catch {
      return '09:00';
    }
  };

  const generateCron = (type: string, time: string, day: string = '1', interval: string = '15') => {
    const [hour, minute] = time.split(':');
    const safeHour = hour || '09';
    const safeMinute = minute || '00';

    switch (type) {
      case 'daily':
        return `${parseInt(safeMinute)} ${parseInt(safeHour)} * * *`;
      case 'weekly':
        return `${parseInt(safeMinute)} ${parseInt(safeHour)} * * ${day}`;
      case 'monthly':
        return `${parseInt(safeMinute)} ${parseInt(safeHour)} ${day} * *`;
      case 'interval':
        return `*/${interval} * * * *`;
      default:
        return '0 9 * * *';
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/modules/sistema/config/notifications');
      setConfig(response.data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/modules/sistema/config/notifications', config);
      toast({
        title: 'Sucesso',
        description: 'Configurações de notificação salvas.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Bell className="h-8 w-8" />
        Ajustes do Sistema
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Notificações Automáticas</CardTitle>
          <CardDescription>
            Configure a rotina de envio de notificações automáticas do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
            <Label htmlFor="enabled">Ativar tarefa automática</Label>
          </div>

          <div className="space-y-2">
            <Label>Título da Notificação</Label>
            <Input
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder="Ex: Lembrete de Sistema"
            />
          </div>

          <div className="space-y-2">
            <Label>Conteúdo da Mensagem</Label>
            <Input
              value={config.content}
              onChange={(e) => setConfig({ ...config, content: e.target.value })}
              placeholder="Ex: Não esqueça de verificar os logs..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Público Alvo</Label>
              <Select
                value={config.audience}
                onValueChange={(val) => setConfig({ ...config, audience: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Geral (Todos)</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="super_admin">Super Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frequency Selector Block */}
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={getFrequencyType(config.cronExpression)}
                onValueChange={(type) => {
                  // Set default values when switching type
                  const newCron = generateCron(type, '09:00', '1', '30');
                  setConfig({ ...config, cronExpression: newCron });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário (Todo dia)</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="interval">Intervalo (Minutos)</SelectItem>
                  <SelectItem value="custom">Personalizado (Avançado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dynamic Frequency Inputs */}
          <div className="pl-4 border-l-2 border-slate-200 mt-4 space-y-4">
            {getFrequencyType(config.cronExpression) === 'daily' && (
              <div className="space-y-2 max-w-xs">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={getTimeFromCron(config.cronExpression)}
                  onChange={(e) => {
                    const time = e.target.value;
                    if (!time) return;
                    const [hour, minute] = time.split(':');
                    setConfig({ ...config, cronExpression: `${parseInt(minute)} ${parseInt(hour)} * * *` });
                  }}
                />
              </div>
            )}

            {getFrequencyType(config.cronExpression) === 'weekly' && (
              <div className="flex gap-4">
                <div className="space-y-2 w-1/2">
                  <Label>Dia da Semana</Label>
                  <Select
                    value={config.cronExpression.split(' ')[4] || '1'}
                    onValueChange={(day) => {
                      const parts = config.cronExpression.split(' ');
                      // Ensure we have enough parts
                      while (parts.length < 5) parts.push('*');
                      parts[4] = day;
                      setConfig({ ...config, cronExpression: parts.join(' ') });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Segunda-feira</SelectItem>
                      <SelectItem value="2">Terça-feira</SelectItem>
                      <SelectItem value="3">Quarta-feira</SelectItem>
                      <SelectItem value="4">Quinta-feira</SelectItem>
                      <SelectItem value="5">Sexta-feira</SelectItem>
                      <SelectItem value="6">Sábado</SelectItem>
                      <SelectItem value="0">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-1/2">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={getTimeFromCron(config.cronExpression)}
                    onChange={(e) => {
                      const time = e.target.value;
                      if (!time) return;
                      const [hour, minute] = time.split(':');
                      const parts = config.cronExpression.split(' ');
                      parts[0] = String(parseInt(minute));
                      parts[1] = String(parseInt(hour));
                      setConfig({ ...config, cronExpression: parts.join(' ') });
                    }}
                  />
                </div>
              </div>
            )}

            {getFrequencyType(config.cronExpression) === 'monthly' && (
              <div className="flex gap-4">
                <div className="space-y-2 w-1/2">
                  <Label>Dia do Mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={config.cronExpression.split(' ')[2] || '1'}
                    onChange={(e) => {
                      const day = e.target.value;
                      const parts = config.cronExpression.split(' ');
                      parts[2] = day;
                      setConfig({ ...config, cronExpression: parts.join(' ') });
                    }}
                  />
                </div>
                <div className="space-y-2 w-1/2">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={getTimeFromCron(config.cronExpression)}
                    onChange={(e) => {
                      const time = e.target.value;
                      if (!time) return;
                      const [hour, minute] = time.split(':');
                      const parts = config.cronExpression.split(' ');
                      parts[0] = String(parseInt(minute));
                      parts[1] = String(parseInt(hour));
                      setConfig({ ...config, cronExpression: parts.join(' ') });
                    }}
                  />
                </div>
              </div>
            )}

            {getFrequencyType(config.cronExpression) === 'interval' && (
              <div className="space-y-2 max-w-xs">
                <Label>Executar a cada (minutos)</Label>
                <Input
                  type="number"
                  min={1}
                  value={config.cronExpression.split('/')[1]?.split(' ')[0] || '15'}
                  onChange={(e) => {
                    const minutes = e.target.value;
                    setConfig({ ...config, cronExpression: `*/${minutes} * * * *` });
                  }}
                />
              </div>
            )}

            {getFrequencyType(config.cronExpression) === 'custom' && (
              <div className="space-y-2">
                <Label>Cron Expression (Manual)</Label>
                <Input
                  value={config.cronExpression}
                  onChange={(e) => setConfig({ ...config, cronExpression: e.target.value })}
                  placeholder="Ex: 0 0 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Formato: <code>minuto hora dia_mês mês dia_semana</code>
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}