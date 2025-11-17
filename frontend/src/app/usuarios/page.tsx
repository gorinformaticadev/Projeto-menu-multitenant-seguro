"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Plus, User, Mail, Shield, Edit, Trash2, Building2 } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  tenant?: {
    id: string;
    nomeFantasia: string;
  } | null;
  createdAt: string;
}

interface Tenant {
  id: string;
  nomeFantasia: string;
  email: string;
  ativo: boolean;
}

export default function UsuariosPage() {
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "USER",
    password: "",
  });

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    const tenantIdFromUrl = searchParams.get("tenantId");
    if (tenantIdFromUrl) {
      setSelectedTenantId(tenantIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedTenantId) {
      loadUsers();
    } else {
      setUsers([]);
    }
  }, [selectedTenantId]);

  async function loadTenants() {
    try {
      const response = await api.get("/tenants");
      setTenants(response.data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar empresas",
        description: error.response?.data?.message || "Ocorreu um erro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    if (!selectedTenantId) return;
    
    setLoadingUsers(true);
    try {
      const response = await api.get(`/users/tenant/${selectedTenantId}`);
      setUsers(response.data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.response?.data?.message || "Ocorreu um erro",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedTenantId) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa primeiro",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const dataToSend = {
        ...formData,
        tenantId: selectedTenantId,
      };

      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, formData);
        toast({ title: "Usuário atualizado com sucesso!" });
      } else {
        await api.post("/users", dataToSend);
        toast({ title: "Usuário criado com sucesso!" });
      }
      
      setShowDialog(false);
      setEditingUser(null);
      setFormData({ email: "", name: "", role: "USER", password: "" });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.message || "Ocorreu um erro",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja deletar este usuário?")) return;

    try {
      await api.delete(`/users/${id}`);
      toast({ title: "Usuário deletado com sucesso!" });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar",
        description: error.response?.data?.message || "Ocorreu um erro",
        variant: "destructive",
      });
    }
  }

  function openEditDialog(user: UserData) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      password: "",
    });
    setShowDialog(true);
  }

  function openCreateDialog() {
    if (!selectedTenantId) {
      toast({
        title: "Atenção",
        description: "Selecione uma empresa primeiro",
        variant: "destructive",
      });
      return;
    }
    setEditingUser(null);
    setFormData({ email: "", name: "", role: "USER", password: "" });
    setShowDialog(true);
  }

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
            <p className="text-muted-foreground">Selecione uma empresa para gerenciar seus usuários</p>
          </div>
          <Button onClick={openCreateDialog} disabled={!selectedTenantId}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Seletor de Tenant */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Selecione a Empresa
            </CardTitle>
            <CardDescription>
              Escolha a empresa para visualizar e gerenciar seus usuários
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione uma empresa...</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.nomeFantasia} {!tenant.ativo && "(Inativa)"}
                  </option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>

        {/* Lista de Usuários */}
        {selectedTenantId && (
          <>
            {selectedTenant && (
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold">Empresa Selecionada:</h3>
                <p className="text-sm text-muted-foreground">{selectedTenant.nomeFantasia}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {users.length} {users.length === 1 ? "usuário" : "usuários"}
                </p>
              </div>
            )}

            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : users.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum usuário cadastrado nesta empresa</p>
                  <Button className="mt-4" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Usuário
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {users.map((user) => (
                  <Card key={user.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary rounded-full w-10 h-10 flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{user.name}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </CardDescription>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                          <Shield className="h-3 w-3 mr-1" />
                          {user.role}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Deletar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Dialog de Criar/Editar */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "Atualize as informações do usuário" : `Criar novo usuário para ${selectedTenant?.nomeFantasia}`}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="CLIENT">CLIENT</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingUser ? "Nova Senha (deixe em branco para não alterar)" : "Senha"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
