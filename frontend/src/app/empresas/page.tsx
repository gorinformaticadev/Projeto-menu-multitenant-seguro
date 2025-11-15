"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Plus, Building2, Mail, Phone, User, FileText } from "lucide-react";

interface Tenant {
  id: string;
  email: string;
  cnpjCpf: string;
  nomeFantasia: string;
  nomeResponsavel: string;
  telefone: string;
  createdAt: string;
  _count?: {
    users: number;
  };
}

export default function EmpresasPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    cnpjCpf: "",
    nomeFantasia: "",
    nomeResponsavel: "",
    telefone: "",
  });

  useEffect(() => {
    loadTenants();
  }, []);

  async function loadTenants() {
    try {
      const response = await api.get("/tenants");
      setTenants(response.data);
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

    // Validação do lado do cliente
    if (!formData.email || !formData.cnpjCpf || !formData.nomeFantasia || 
        !formData.nomeResponsavel || !formData.telefone) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Erro",
        description: "Email inválido",
        variant: "destructive",
      });
      return;
    }

    // Validação de telefone
    const phoneRegex = /^[\d\s\(\)\-\+]+$/;
    if (!phoneRegex.test(formData.telefone)) {
      toast({
        title: "Erro",
        description: "Telefone inválido",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/tenants", formData);
      
      toast({
        title: "Sucesso",
        description: "Empresa cadastrada com sucesso!",
      });

      setFormData({
        email: "",
        cnpjCpf: "",
        nomeFantasia: "",
        nomeResponsavel: "",
        telefone: "",
      });
      setShowForm(false);
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

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Cadastrar Nova Empresa</CardTitle>
              <CardDescription>
                Preencha os dados da empresa para criar um novo tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="empresa@example.com"
                        className="pl-10"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cnpjCpf">CNPJ/CPF</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cnpjCpf"
                        placeholder="00.000.000/0000-00"
                        className="pl-10"
                        value={formData.cnpjCpf}
                        onChange={(e) => setFormData({ ...formData, cnpjCpf: e.target.value })}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="nomeFantasia"
                        placeholder="Empresa LTDA"
                        className="pl-10"
                        value={formData.nomeFantasia}
                        onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
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
                    <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-3 shadow-sm">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-bold truncate">
                        {tenant.nomeFantasia}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono mt-1">
                        {tenant.cnpjCpf}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5 group">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 group-hover:text-primary transition-colors" />
                      <span className="text-sm text-muted-foreground truncate group-hover:text-foreground transition-colors">
                        {tenant.email}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 group">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 group-hover:text-primary transition-colors" />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {tenant.nomeResponsavel}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 group">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 group-hover:text-primary transition-colors" />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
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
      </div>
    </ProtectedRoute>
  );
}
