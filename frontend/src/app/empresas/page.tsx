"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import api, { API_URL } from "@/lib/api";
import { Plus, Building2, Mail, Phone, User, FileText, Eye, Edit, Power, Lock, UserPlus, Image as ImageIcon, Upload, X, Users, Trash2, Package } from "lucide-react";
import { CPFCNPJInput } from "@/components/ui/cpf-cnpj-input";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TestForm } from "@/components/TestForm";
import { ModulesTab } from "./components/ModulesTab";


interface Tenant {
  id: string;
  email: string;
  cnpjCpf: string;
  nomeFantasia: string;
  nomeResponsavel: string;
  telefone: string;
  logoUrl?: string | null;
  ativo: boolean;
  createdAt: string;
  _count?: {
    users: number;
  };
}

export default function EmpresasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoTimestamp, setLogoTimestamp] = useState<number>(Date.now());
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isAdminPasswordValid, setIsAdminPasswordValid] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const { toast } = useToast();

  // Debug: Log do estado submitting
  useEffect(() => {
    console.log('🔍 Estado submitting alterado:', submitting);
  }, [submitting]);

  const [formData, setFormData] = useState({
    email: "",
    cnpjCpf: "",
    nomeFantasia: "",
    nomeResponsavel: "",
    telefone: "",
    adminEmail: "",
    adminPassword: "",
    adminName: "",
  });

  // Debug: Log das mudanças no formData
  useEffect(() => {
    console.log('📝 FormData atualizado:', formData);
  }, [formData]);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(false);

  useEffect(() => {
    // Garante que o estado submitting seja false na inicialização
    setSubmitting(false);
    
    // Debounce para evitar múltiplas chamadas em React StrictMode
    const timeoutId = setTimeout(() => {
      loadTenants();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  async function loadTenants() {
    try {
      // Cache simples para evitar múltiplas chamadas
      const cacheKey = 'tenants-list-cache';
      const cacheTTL = 2 * 60 * 1000; // 2 minutos
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTTL) {
          console.log('🎯 Usando cache de tenants');
          setTenants(data);
          setLoading(false);
          return;
        }
      }
      
      const response = await api.get("/tenants");
      console.log('Tenants carregados:', response.data);
      console.log('API_URL:', API_URL);
      setTenants(response.data);
      
      // Salvar no cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));
      
    } catch (error: any) {
      toast({
        title: "Erro ao carregar empresas",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.email || !formData.cnpjCpf || !formData.nomeFantasia || 
        !formData.nomeResponsavel || !formData.telefone ||
        !formData.adminEmail || !formData.adminPassword || !formData.adminName) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email) || !emailRegex.test(formData.adminEmail)) {
      toast({
        title: "Erro",
        description: "Email inválido",
        variant: "destructive",
      });
      return;
    }

    if (!isAdminPasswordValid) {
      toast({
        title: "Erro",
        description: "A senha do administrador não atende aos requisitos de segurança",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/tenants", formData);
      
      toast({
        title: "Sucesso",
        description: "Empresa e administrador cadastrados com sucesso!",
      });

      setFormData({
        email: "",
        cnpjCpf: "",
        nomeFantasia: "",
        nomeResponsavel: "",
        telefone: "",
        adminEmail: "",
        adminPassword: "",
        adminName: "",
      });
      setIsAdminPasswordValid(false);
      setShowForm(false);
      // Invalidar cache antes de recarregar
      localStorage.removeItem('tenants-list-cache');
      loadTenants();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar empresa",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant) return;

    setSubmitting(true);

    try {
      await api.put(`/tenants/${selectedTenant.id}`, {
        email: formData.email,
        cnpjCpf: formData.cnpjCpf,
        nomeFantasia: formData.nomeFantasia,
        nomeResponsavel: formData.nomeResponsavel,
        telefone: formData.telefone,
      });
      
      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso!",
      });

      setShowEditDialog(false);
      setSelectedTenant(null);
      // Invalidar cache antes de recarregar
      localStorage.removeItem('tenants-list-cache');
      loadTenants();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar empresa",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant) return;

    if (!isPasswordValid) {
      toast({
        title: "Erro",
        description: "A senha não atende aos requisitos de segurança",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      await api.patch(`/tenants/${selectedTenant.id}/change-admin-password`, {
        newPassword: passwordData.newPassword,
      });
      
      toast({
        title: "Sucesso",
        description: "Senha do administrador alterada com sucesso!",
      });

      setShowPasswordDialog(false);
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setIsPasswordValid(false);
      setPasswordsMatch(false);
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(tenant: Tenant) {
    try {
      await api.patch(`/tenants/${tenant.id}/toggle-status`);
      
      toast({
        title: "Sucesso",
        description: `Empresa ${tenant.ativo ? 'desativada' : 'ativada'} com sucesso!`,
      });

      // Invalidar cache antes de recarregar
      localStorage.removeItem('tenants-list-cache');
      loadTenants();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
  }

  function openDeleteDialog(tenant: Tenant) {
    setSelectedTenant(tenant);
    setDeleteConfirmText("");
    setShowDeleteDialog(true);
  }

  async function handleDelete() {
    if (!selectedTenant) return;

    if (deleteConfirmText !== selectedTenant.nomeFantasia) {
      toast({
        title: "Erro",
        description: "O nome da empresa não confere",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      await api.delete(`/tenants/${selectedTenant.id}`);
      
      toast({
        title: "Sucesso",
        description: "Empresa deletada com sucesso!",
      });

      setShowDeleteDialog(false);
      setSelectedTenant(null);
      setDeleteConfirmText("");
      // Invalidar cache antes de recarregar
      localStorage.removeItem('tenants-list-cache');
      loadTenants();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar empresa",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function openViewDialog(tenant: Tenant, tab: string = "details") {
    setSelectedTenant(tenant);
    setActiveTab(tab);
    setShowViewDialog(true);
  }

  function openModulesDialog(tenant: Tenant) {
    openViewDialog(tenant, "modules");
  }

  function openEditDialog(tenant: Tenant) {
    setSelectedTenant(tenant);
    setFormData({
      email: tenant.email,
      cnpjCpf: tenant.cnpjCpf,
      nomeFantasia: tenant.nomeFantasia,
      nomeResponsavel: tenant.nomeResponsavel,
      telefone: tenant.telefone,
      adminEmail: "",
      adminPassword: "",
      adminName: "",
    });
    setShowEditDialog(true);
  }

  function openPasswordDialog(tenant: Tenant) {
    setSelectedTenant(tenant);
    setPasswordData({ newPassword: "", confirmPassword: "" });
    setIsPasswordValid(false);
    setPasswordsMatch(false);
    setShowPasswordDialog(true);
  }

  function openLogoDialog(tenant: Tenant) {
    setSelectedTenant(tenant);
    setLogoFile(null);
    setLogoPreview(null);
    setShowLogoDialog(true);
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Erro",
          description: "Apenas arquivos de imagem são permitidos",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "O arquivo deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleUploadLogo() {
    if (!selectedTenant || !logoFile) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('logo', logoFile);

    try {
      await api.post(`/tenants/${selectedTenant.id}/upload-logo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast({
        title: "Sucesso",
        description: "Logo atualizado com sucesso!",
      });

      setShowLogoDialog(false);
      setLogoFile(null);
      setLogoPreview(null);
      // Forçar atualização do timestamp para reload da imagem
      setLogoTimestamp(Date.now());
      // Invalidar cache antes de recarregar
      localStorage.removeItem('tenants-list-cache');
      loadTenants();
    } catch (error: any) {
      toast({
        title: "Erro ao fazer upload do logo",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveLogo() {
    if (!selectedTenant) return;

    setSubmitting(true);

    try {
      await api.patch(`/tenants/${selectedTenant.id}/remove-logo`);
      
      toast({
        title: "Sucesso",
        description: "Logo removido com sucesso!",
      });

      setShowLogoDialog(false);
      // Forçar atualização do timestamp para reload da imagem
      setLogoTimestamp(Date.now());
      // Invalidar cache antes de recarregar
      localStorage.removeItem('tenants-list-cache');
      loadTenants();
    } catch (error: any) {
      toast({
        title: "Erro ao remover logo",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Empresas</h1>
            <p className="text-muted-foreground">
              Gerencie as empresas (tenants) do sistema
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>

        {/* Componente de teste para debug */}
        {showForm && (
          <div className="mb-8">
            <TestForm />
          </div>
        )}

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Cadastrar Nova Empresa</CardTitle>
              <CardDescription>
                Preencha os dados da empresa e do administrador
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados da Empresa */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Dados da Empresa
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email da Empresa</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="empresa@example.com"
                          className="pl-10"
                          value={formData.email}
                          onChange={(e) => {
                            console.log('📧 Email alterado:', e.target.value);
                            setFormData({ ...formData, email: e.target.value });
                          }}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <CPFCNPJInput
                      id="cnpjCpf"
                      label="CNPJ/CPF"
                      value={formData.cnpjCpf}
                      onChange={(value, isValid) => setFormData({ ...formData, cnpjCpf: value })}
                      disabled={submitting}
                      showValidation={true}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="nomeFantasia"
                          placeholder="Empresa LTDA"
                          className="pl-10"
                          value={formData.nomeFantasia}
                          onChange={(e) => {
                            console.log('🏢 Nome fantasia alterado:', e.target.value);
                            setFormData({ ...formData, nomeFantasia: e.target.value });
                          }}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nomeResponsavel">Nome do Responsável</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="nomeResponsavel"
                          placeholder="João Silva"
                          className="pl-10"
                          value={formData.nomeResponsavel}
                          onChange={(e) => setFormData({ ...formData, nomeResponsavel: e.target.value })}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="telefone"
                          placeholder="(11) 98765-4321"
                          className="pl-10"
                          value={formData.telefone}
                          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dados do Administrador */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Dados do Administrador
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="adminName">Nome do Administrador</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="adminName"
                          placeholder="Maria Santos"
                          className="pl-10"
                          value={formData.adminName}
                          onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Email do Administrador</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="adminEmail"
                          type="email"
                          placeholder="admin@empresa.com"
                          className="pl-10"
                          value={formData.adminEmail}
                          onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adminPassword">Senha do Administrador</Label>
                      <div className="relative">
                        <Input
                          id="adminPassword"
                          type="password"
                          placeholder="Digite a senha do administrador"
                          value={formData.adminPassword}
                          onChange={(e) => {
                            console.log('🔑 Senha alterada:', e.target.value);
                            setFormData({ ...formData, adminPassword: e.target.value });
                            setIsAdminPasswordValid(e.target.value.length >= 8);
                          }}
                          disabled={submitting}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Esta será a senha de acesso do administrador da empresa (mínimo 8 caracteres)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Cadastrando..." : "Cadastrar Empresa"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      console.log('🧪 Teste de formulário:');
                      console.log('- Submitting:', submitting);
                      console.log('- FormData:', formData);
                      console.log('- Inputs disabled:', document.querySelectorAll('input[disabled]').length);
                      
                      // Força habilitar todos os inputs para teste
                      document.querySelectorAll('input').forEach(input => {
                        input.disabled = false;
                      });
                      
                      toast({
                        title: "Debug",
                        description: "Verifique o console para informações de debug",
                      });
                    }}
                  >
                    🧪 Debug
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tenants.map((tenant) => (
              <Card key={tenant.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-full shadow-sm ${tenant.ativo ? 'bg-gradient-to-br from-primary to-primary/80' : 'bg-gray-400'} relative overflow-hidden flex items-center justify-center w-12 h-12 p-0`}>
                      {tenant.logoUrl ? (
                        <>
                          <img 
                            src={`${API_URL}/uploads/logos/${tenant.logoUrl}?t=${Date.now()}`} 
                            alt={tenant.nomeFantasia}
                            className="w-full h-full object-cover rounded-full logo-image"
                            onLoad={() => {
                              console.log(`Logo carregado: ${tenant.nomeFantasia} - ${tenant.logoUrl}`);
                            }}
                            onError={(e) => {
                              console.error(`Erro ao carregar logo: ${tenant.nomeFantasia} - ${API_URL}/uploads/logos/${tenant.logoUrl}`);
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const fallback = target.parentElement?.querySelector('.fallback-icon');
                              if (fallback) {
                                fallback.classList.remove('hidden');
                              }
                            }}
                          />
                          <Building2 className="h-6 w-6 text-white fallback-icon hidden absolute" />
                        </>
                      ) : (
                        <Building2 className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-bold truncate">
                        {tenant.nomeFantasia}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono mt-1">
                        {tenant.cnpjCpf}
                      </CardDescription>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          tenant.ativo 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tenant.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                        {tenant.email === 'empresa1@example.com' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            Padrão
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5 group">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground truncate">
                        {tenant.email}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 group">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {tenant.nomeResponsavel}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 group">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {tenant.telefone}
                      </span>
                    </div>
                  </div>
                  
                  {tenant._count && (
                    <div className="pt-3 mt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Usuários
                        </span>
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                          {tenant._count.users}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openViewDialog(tenant)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(tenant)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLogoDialog(tenant)}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Logo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPasswordDialog(tenant)}
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      Senha
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openModulesDialog(tenant)}
                      className="col-span-2 text-xs sm:text-sm"
                    >
                      <Package className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="truncate">Gerenciar Módulos</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/usuarios?tenantId=${tenant.id}`)}
                      className="col-span-2"
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Gerenciar Usuários ({tenant._count?.users || 0})
                    </Button>
                    <Button
                      variant={tenant.ativo ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleStatus(tenant)}
                      disabled={tenant.email === 'empresa1@example.com' && tenant.ativo}
                      title={tenant.email === 'empresa1@example.com' && tenant.ativo ? 'A empresa padrão não pode ser desativada' : ''}
                    >
                      <Power className="h-4 w-4 mr-1" />
                      {tenant.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(tenant)}
                      disabled={tenant.email === 'empresa1@example.com'}
                      title={tenant.email === 'empresa1@example.com' ? 'A empresa padrão não pode ser deletada' : ''}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Deletar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && tenants.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma empresa cadastrada</p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeira Empresa
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dialog de Visualização */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle>Detalhes da Empresa</DialogTitle>
              <DialogDescription>
                Informações completas da empresa e gerenciamento de módulos
              </DialogDescription>
            </DialogHeader>
            {selectedTenant && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-10">
                  <TabsTrigger value="details" className="text-xs sm:text-sm px-2">Detalhes</TabsTrigger>
                  <TabsTrigger value="modules" className="text-xs sm:text-sm px-2">Módulos</TabsTrigger>

                </TabsList>
                <TabsContent value="details" className="mt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">Nome Fantasia</Label>
                      <p className="font-medium text-sm sm:text-base break-words">{selectedTenant.nomeFantasia}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">CNPJ/CPF</Label>
                      <p className="font-medium text-sm sm:text-base font-mono">{selectedTenant.cnpjCpf}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground text-xs sm:text-sm">Email</Label>
                      <p className="font-medium text-sm sm:text-base break-all">{selectedTenant.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">Responsável</Label>
                      <p className="font-medium text-sm sm:text-base break-words">{selectedTenant.nomeResponsavel}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">Telefone</Label>
                      <p className="font-medium text-sm sm:text-base">{selectedTenant.telefone}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground text-xs sm:text-sm">Status</Label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          selectedTenant.ativo 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedTenant.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="modules" className="mt-4">
                  <div className="space-y-4">
                    <ModulesTab tenantId={selectedTenant.id} />
                    
                    {user?.role === "SUPER_ADMIN" && (
                      <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-blue-800">Gerenciamento Global de Módulos</h4>
                              <p className="text-sm text-blue-600 mt-1">
                                Instale, remova e gerencie módulos disponíveis para todo o sistema
                              </p>
                            </div>
                            <Button asChild variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                              <Link href="/configuracoes/sistema/modulos">
                                <Package className="h-4 w-4 mr-2" />
                                Gerenciar Módulos
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

              </Tabs>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Edição */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
              <DialogDescription>
                Atualize as informações da empresa
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <CPFCNPJInput
                id="edit-cnpjCpf"
                label="CNPJ/CPF"
                value={formData.cnpjCpf}
                onChange={(value, isValid) => setFormData({ ...formData, cnpjCpf: value })}
                disabled={submitting}
                showValidation={true}
              />
              <div className="space-y-2">
                <Label htmlFor="edit-nomeFantasia">Nome Fantasia</Label>
                <Input
                  id="edit-nomeFantasia"
                  value={formData.nomeFantasia}
                  onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nomeResponsavel">Nome do Responsável</Label>
                <Input
                  id="edit-nomeResponsavel"
                  value={formData.nomeResponsavel}
                  onChange={(e) => setFormData({ ...formData, nomeResponsavel: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-telefone">Telefone</Label>
                <Input
                  id="edit-telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Alteração de Senha */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar Senha do Administrador</DialogTitle>
              <DialogDescription>
                Digite a nova senha para o administrador da empresa
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <PasswordInput
                id="newPassword"
                label="Nova Senha do Administrador"
                value={passwordData.newPassword}
                onChange={(value, isValid) => {
                  setPasswordData({ ...passwordData, newPassword: value });
                  setIsPasswordValid(isValid);
                }}
                showValidation={true}
                showStrengthMeter={true}
                showConfirmation={true}
                confirmPassword={passwordData.confirmPassword}
                onConfirmChange={(value, matches) => {
                  setPasswordData({ ...passwordData, confirmPassword: value });
                  setPasswordsMatch(matches);
                }}
                disabled={submitting}
                placeholder="Digite a nova senha"
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPasswordDialog(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting || !isPasswordValid || !passwordsMatch}
                >
                  {submitting ? "Alterando..." : "Alterar Senha"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Gerenciamento de Logo */}
        <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar Logo da Empresa</DialogTitle>
              <DialogDescription>
                Faça upload ou remova o logo da empresa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedTenant?.logoUrl && !logoPreview && (
                <div className="space-y-2">
                  <Label>Logo Atual</Label>
                  <div className="flex items-center justify-center p-4 border rounded-lg bg-muted">
                    <img 
                      src={`${API_URL}/uploads/logos/${selectedTenant.logoUrl}?t=${logoTimestamp}`} 
                      alt="Logo atual"
                      className="max-h-32 object-contain"
                      onError={(e) => {
                        console.error('Erro ao carregar logo atual:', selectedTenant.logoUrl);
                        e.currentTarget.src = '/placeholder-logo.png';
                      }}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveLogo}
                    disabled={submitting}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {submitting ? "Removendo..." : "Remover Logo"}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="logo-upload">
                  {selectedTenant?.logoUrl ? "Novo Logo" : "Upload de Logo"}
                </Label>
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: JPG, PNG, GIF, WEBP (máx. 5MB)
                </p>
              </div>

              {logoPreview && (
                <div className="space-y-2">
                  <Label>Pré-visualização</Label>
                  <div className="flex items-center justify-center p-4 border rounded-lg bg-muted">
                    <img 
                      src={logoPreview} 
                      alt="Pré-visualização"
                      className="max-h-32 object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowLogoDialog(false);
                  setLogoFile(null);
                  setLogoPreview(null);
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              {logoFile && (
                <Button onClick={handleUploadLogo} disabled={submitting}>
                  <Upload className="h-4 w-4 mr-2" />
                  {submitting ? "Enviando..." : "Fazer Upload"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Deletar Empresa</DialogTitle>
              <DialogDescription>
                Esta ação é irreversível e deletará permanentemente a empresa.
              </DialogDescription>
            </DialogHeader>
            {selectedTenant && (
              <div className="space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-2">⚠️ Atenção!</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Todos os dados da empresa serão perdidos</li>
                    <li>Esta ação não pode ser desfeita</li>
                    <li>Certifique-se de que não há usuários vinculados</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmDelete">
                    Para confirmar, digite o nome da empresa: <strong>{selectedTenant.nomeFantasia}</strong>
                  </Label>
                  <Input
                    id="confirmDelete"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Digite o nome da empresa"
                    disabled={submitting}
                  />
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm"><strong>Empresa:</strong> {selectedTenant.nomeFantasia}</p>
                  <p className="text-sm"><strong>CNPJ/CPF:</strong> {selectedTenant.cnpjCpf}</p>
                  <p className="text-sm"><strong>Usuários:</strong> {selectedTenant._count?.users || 0}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText("");
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={submitting || deleteConfirmText !== selectedTenant?.nomeFantasia}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {submitting ? "Deletando..." : "Deletar Empresa"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
