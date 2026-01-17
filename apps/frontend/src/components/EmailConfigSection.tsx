"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Mail, Send, Play } from "lucide-react";

interface EmailProvider {
  providerName: string;
  smtpHost: string;
  smtpPort: number;
  encryption: string;
  authMethod: string;
  description?: string;
}

interface EmailConfig {
  id: string;
  providerName: string;
  smtpHost: string;
  smtpPort: number;
  encryption: string;
  authMethod: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SecurityConfig {
  smtpUsername?: string;
  smtpPassword?: string;
}

export default function EmailConfigSection() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<EmailProvider[]>([]);
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<EmailConfig | null>(null);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showTestInput, setShowTestInput] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [formData, setFormData] = useState({
    smtpHost: "",
    smtpPort: 587,
    encryption: "STARTTLS",
    authMethod: "PLAIN",
    smtpUser: "",
    smtpPass: "",
  });

  // Load providers and configs
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get predefined providers
        const providersRes = await api.get("/email-config/providers");
        setProviders(providersRes.data);

        // Get all configs
        const configsRes = await api.get("/email-config");
        setConfigs(configsRes.data);

        // Get active config
        const activeRes = await api.get("/email-config/active");
        setActiveConfig(activeRes.data);

        // Get SMTP credentials from security config
        const credentialsRes = await api.get("/email-config/smtp-credentials");
        setSecurityConfig(credentialsRes.data);

        // If there's an active config, populate the form
        if (activeRes.data) {
          setFormData({
            smtpHost: activeRes.data.smtpHost,
            smtpPort: activeRes.data.smtpPort,
            encryption: activeRes.data.encryption,
            authMethod: activeRes.data.authMethod,
            smtpUser: credentialsRes.data.smtpUsername || "",
            smtpPass: "", // Don't load password for security
          });
          setSelectedProvider(activeRes.data.providerName);
        } else {
          // If no active config but credentials exist, populate only credentials
          setFormData(prev => ({
            ...prev,
            smtpUser: credentialsRes.data.smtpUsername || "",
            smtpPass: "", // Don't load password for security
          }));
        }
      } catch (error: any) {
        toast({
          title: "Erro ao carregar configurações de email",
          description: error.response?.data?.message || "Erro desconhecido",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  // Handle provider selection
  const handleProviderSelect = (providerName: string) => {
    setSelectedProvider(providerName);

    // If "custom" is selected, don't prefill the form
    if (providerName === "custom") {
      return;
    }

    const provider = providers.find(p => p.providerName === providerName);
    if (provider) {
      setFormData({
        ...formData,
        smtpHost: provider.smtpHost,
        smtpPort: provider.smtpPort,
        encryption: provider.encryption,
        authMethod: provider.authMethod,
      });
    }
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: string | number) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  // Save email configuration
  const handleSave = async () => {
    try {
      setSaving(true);

      // Save SMTP credentials in security config
      if (formData.smtpUser || formData.smtpPass) {
        await api.put("/security-config", {
          smtpUsername: formData.smtpUser,
          smtpPassword: formData.smtpPass
        });
      }

      // Prepare data for saving email configuration (without credentials for security)
      const saveData = {
        providerName: selectedProvider || "Custom",
        smtpHost: formData.smtpHost,
        smtpPort: formData.smtpPort,
        encryption: formData.encryption,
        authMethod: formData.authMethod,
      };

      // Create new configuration
      const response = await api.post("/email-config", saveData);

      // Update local state
      const newConfigs = [...configs, response.data];
      setConfigs(newConfigs);
      setActiveConfig(response.data);

      toast({
        title: "Configuração salva",
        description: "As configurações de email foram salvas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar configuração",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete SMTP credentials
  const handleDeleteCredentials = async () => {
    try {
      // We're not implementing this anymore since we're using SecurityConfig
    } catch (error: any) {
      // Handle error silently
    }
  };

  // Test email configuration
  const handleTestConnection = () => {
    setShowTestInput(true);
  };

  // Send test email
  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Email necessário",
        description: "Por favor, informe um email para envio do teste",
        variant: "destructive",
      });
      return;
    }

    try {
      setTesting(true);

      // Send test email with credentials
      await api.post("/email-config/test", {
        email: testEmail,
        smtpUser: formData.smtpUser,
        smtpPass: formData.smtpPass
      });

      toast({
        title: "Email de teste enviado",
        description: `Email de teste enviado com sucesso para ${testEmail}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email de teste",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
      setShowTestInput(false);
      setTestEmail("");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configurações de Email
          </CardTitle>
          <CardDescription>
            Carregando configurações de email...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Configurações de Email
        </CardTitle>
        <CardDescription>
          Configure o servidor de email padrão da plataforma.
          <strong>Apenas uma configuração de email pode estar ativa por vez.</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Informações importantes */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Configuração de Email Principal</p>
              <ul className="text-xs space-y-1">
                <li>• Esta é a configuração de email principal da aplicação</li>
                <li>• Apenas <strong>uma configuração</strong> pode existir por vez</li>
                <li>• Ao salvar uma nova configuração, a anterior será substituída</li>
                <li>• As credenciais (usuário e senha) são armazenadas de forma segura</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="provider-select">
              Provedor de Email Pré-configurado
            </Label>
            <Select value={selectedProvider} onValueChange={handleProviderSelect}>
              <SelectTrigger id="provider-select">
                <SelectValue placeholder="Selecione um provedor (Gmail, Hotmail/Outlook, Titan)" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.providerName} value={provider.providerName}>
                    <div className="flex flex-col">
                      <span>{provider.providerName}</span>
                      {provider.description && (
                        <span className="text-xs text-muted-foreground">{provider.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  <div className="flex flex-col">
                    <span>Personalizado</span>
                    <span className="text-xs text-muted-foreground">Configure manualmente</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>Gmail, Hotmail/Outlook e Titan</strong> já estão pré-configurados.
              Selecione um provedor e informe apenas suas credenciais de acesso.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="smtp-host">
                Servidor SMTP
              </Label>
              <Input
                id="smtp-host"
                value={formData.smtpHost}
                onChange={(e) => handleInputChange("smtpHost", e.target.value)}
                placeholder="smtp.exemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="smtp-port">
                Porta SMTP
              </Label>
              <Input
                id="smtp-port"
                type="number"
                value={formData.smtpPort}
                onChange={(e) => handleInputChange("smtpPort", parseInt(e.target.value))}
                min="1"
                max="65535"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="encryption">
                Tipo de Criptografia
              </Label>
              <Select
                value={formData.encryption}
                onValueChange={(value: string) => handleInputChange("encryption", value)}
              >
                <SelectTrigger id="encryption">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTTLS">STARTTLS</SelectItem>
                  <SelectItem value="SSL">SSL</SelectItem>
                  <SelectItem value="TLS">TLS</SelectItem>
                  <SelectItem value="NONE">Nenhuma</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="auth-method">
                Método de Autenticação
              </Label>
              <Input
                id="auth-method"
                value={formData.authMethod}
                onChange={(e) => handleInputChange("authMethod", e.target.value)}
                placeholder="Método de autenticação"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="smtp-user">
                Usuário SMTP
              </Label>
              <Input
                id="smtp-user"
                value={formData.smtpUser}
                onChange={(e) => handleInputChange("smtpUser", e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <Label htmlFor="smtp-pass">
                Senha SMTP
              </Label>
              <Input
                id="smtp-pass"
                type="password"
                value={formData.smtpPass}
                onChange={(e) => handleInputChange("smtpPass", e.target.value)}
                placeholder="Senha do email"
              />
            </div>
          </div>


        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-between">
          <Button onClick={handleTestConnection} variant="secondary">
            <Play className="h-4 w-4 mr-2" />
            Testar Conexão
          </Button>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>

        {showTestInput && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <div>
              <Label htmlFor="test-email">
                Email de destino para teste
              </Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="destino@teste.com"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSendTestEmail} disabled={testing}>
                <Send className="h-4 w-4 mr-2" />
                {testing ? "Enviando..." : "Enviar Email de Teste"}
              </Button>
            </div>
          </div>
        )}

        {activeConfig && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium mb-1">Configuração Ativa</p>
                <p><strong>Provedor:</strong> {activeConfig.providerName}</p>
                <p><strong>Servidor:</strong> {activeConfig.smtpHost}:{activeConfig.smtpPort}</p>
                <p><strong>Criptografia:</strong> {activeConfig.encryption}</p>
                {securityConfig.smtpUsername && (
                  <p><strong>Usuário:</strong> {securityConfig.smtpUsername}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!activeConfig && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Nenhuma Configuração Ativa</p>
                <p>Configure um provedor de email para que o sistema possa enviar mensagens.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}