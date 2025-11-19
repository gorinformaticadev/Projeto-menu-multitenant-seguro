"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Building2, Save, Upload, X } from "lucide-react";
import { API_URL } from "@/lib/api";

interface TenantData {
  id: string;
  nomeFantasia: string;
  cnpjCpf: string;
  telefone: string;
  email: string;
  logoUrl?: string;
}

export default function EmpresaConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [formData, setFormData] = useState({
    nomeFantasia: "",
    cnpjCpf: "",
    telefone: "",
    email: "",
  });

  // Verificar se usuário tem permissão (ADMIN ou SUPER_ADMIN)
  useEffect(() => {
    if (user && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      window.location.href = "/dashboard";
      return;
    }

    if (user?.tenantId || user?.role === "SUPER_ADMIN") {
      loadTenantData();
    }
  }, [user]);

  async function loadTenantData() {
    if (!user) return;

    try {
      setLoading(true);
      let tenantId: string;

      if (user.role === "SUPER_ADMIN") {
        // SUPER_ADMIN precisa selecionar uma empresa (por enquanto, vamos usar a primeira)
        // TODO: Implementar seletor de empresa
        return;
      } else {
        // ADMIN usa endpoint específico
        const response = await api.get('/tenants/my-tenant');
        const tenantData = response.data;
        setTenant(tenantData);

        setFormData({
          nomeFantasia: tenantData.nomeFantasia || "",
          cnpjCpf: tenantData.cnpjCpf || "",
          telefone: tenantData.telefone || "",
          email: tenantData.email || "",
        });
        setLoading(false);
        return;
      }

      const response = await api.get(`/tenants/${tenantId}`);
      const tenantData = response.data;
      setTenant(tenantData);

      setFormData({
        nomeFantasia: tenantData.nomeFantasia || "",
        cnpjCpf: tenantData.cnpjCpf || "",
        telefone: tenantData.telefone || "",
        email: tenantData.email || "",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados da empresa",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!tenant) return;

    try {
      setSaving(true);

      if (user?.role === "ADMIN") {
        // ADMIN usa endpoint específico
        await api.put('/tenants/my-tenant', formData);
      } else {
        // SUPER_ADMIN usa endpoint geral
        await api.put(`/tenants/${tenant.id}`, formData);
      }

      toast({
        title: "Empresa atualizada",
        description: "Os dados da empresa foram salvos com sucesso",
      });

      // Recarregar dados
      loadTenantData();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !tenant) return;

    // Validar tipo do arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Selecione apenas arquivos de imagem",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingLogo(true);

      const formDataUpload = new FormData();
      formDataUpload.append('logo', file);

      const uploadEndpoint = user?.role === "ADMIN" ? '/tenants/my-tenant/upload-logo' : `/tenants/${tenant.id}/upload-logo`;

      await api.post(uploadEndpoint, formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: "Logo atualizado",
        description: "O logo da empresa foi atualizado com sucesso",
      });

      // Recarregar dados para mostrar novo logo
      loadTenantData();
    } catch (error: any) {
      toast({
        title: "Erro ao fazer upload",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    if (!tenant) return;

    try {
      const removeEndpoint = user?.role === "ADMIN" ? '/tenants/my-tenant/remove-logo' : `/tenants/${tenant.id}/remove-logo`;
      await api.patch(removeEndpoint);

      toast({
        title: "Logo removido",
        description: "O logo da empresa foi removido com sucesso",
      });

      // Recarregar dados
      loadTenantData();
    } catch (error: any) {
      toast({
        title: "Erro ao remover logo",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  }

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return null;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">Carregando dados da empresa...</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          Empresa não encontrada
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Configurações da Empresa
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie as informações da sua empresa
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      {/* Logo da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Logo da Empresa</CardTitle>
          <CardDescription>
            Faça upload de um logo para representar sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
              {tenant.logoUrl ? (
                <img
                  src={`${API_URL}/uploads/logos/${tenant.logoUrl}`}
                  alt="Logo da empresa"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <label htmlFor="logo-upload">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingLogo}
                    className="cursor-pointer"
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingLogo ? "Enviando..." : "Alterar Logo"}
                    </span>
                  </Button>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {tenant.logoUrl && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 5MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Empresa</CardTitle>
          <CardDescription>
            Atualize os dados cadastrais da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
              <Input
                id="nomeFantasia"
                value={formData.nomeFantasia}
                onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpjCpf">CNPJ/CPF</Label>
              <Input
                id="cnpjCpf"
                value={formData.cnpjCpf}
                onChange={(e) => setFormData({ ...formData, cnpjCpf: e.target.value })}
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@empresa.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Todas as Alterações"}
        </Button>
      </div>
    </div>
  );
}