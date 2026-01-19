"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { User, Mail, Shield, Key, Edit } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";

export default function PerfilPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isNewPasswordValid, setIsNewPasswordValid] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  const [showEditTenant, setShowEditTenant] = useState(false);
  const [tenantData, setTenantData] = useState({
    nomeFantasia: "",
    cnpjCpf: "",
    telefone: "",
  });

  const loadUserData = useCallback(async (force = false) => {
    if (!user?.id) return;

    const cacheKey = `user-profile-${user.id}`;
    const cacheTTL = 2 * 60 * 1000; // 2 minutos

    // Verificar cache se não for forçado
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTTL) {
            setTwoFactorEnabled(data.twoFactorEnabled || false);
            setProfileData({
              name: data.name || "",
              email: data.email || "",
            });
            return;
          }
        } catch (e) {
          // Cache inválido, continua
        }
      }
    }

    try {
      const response = await api.get(`/users/${user.id}`);
      const userData = response.data;

      setTwoFactorEnabled(userData.twoFactorEnabled || false);
      setProfileData({
        name: userData.name || "",
        email: userData.email || "",
      });

      // Cache o resultado
      localStorage.setItem(cacheKey, JSON.stringify({
        data: userData,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadUserData();
      setProfileData({
        name: user.name || "",
        email: user.email || "",
      });

      // Inicializar dados da tenant se for ADMIN
      if (user.role === "ADMIN" && user.tenant) {
        setTenantData({
          nomeFantasia: user.tenant.nomeFantasia || "",
          cnpjCpf: user.tenant.cnpjCpf || "",
          telefone: user.tenant.telefone || "",
        });
      }
    }
  }, [user?.id, user?.name, user?.email, user?.role, user?.tenant, loadUserData]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();

    if (!profileData.name || !profileData.email) {
      toast({
        title: "Erro",
        description: "Nome e email são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await api.put('/users/profile', {
        name: profileData.name,
        email: profileData.email,
      });
      // Atualizar contexto de autenticação
      updateUser({
        name: profileData.name,
        email: profileData.email,
      });

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram atualizadas com sucesso",
      });
      setShowEditProfile(false);
      // Recarregar dados do usuário (forçar refresh do cache)
      await loadUserData(true);
    } catch (error: unknown) {
      toast({
        title: "Erro ao atualizar perfil",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!isNewPasswordValid) {
      toast({
        title: "Erro",
        description: "A nova senha não atende aos requisitos de segurança",
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

    try {
      setLoading(true);
      await api.put("/users/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast({
        title: "Senha alterada!",
        description: "Sua senha foi alterada com sucesso",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsNewPasswordValid(false);
      setPasswordsMatch(false);
      setShowChangePassword(false);
    } catch (error: unknown) {
      toast({
        title: "Erro ao alterar senha",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTenant(e: React.FormEvent) {
    e.preventDefault();

    if (!tenantData.nomeFantasia || !tenantData.cnpjCpf) {
      toast({
        title: "Erro",
        description: "Nome fantasia e CNPJ/CPF são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!user?.tenant) return;

    try {
      setLoading(true);
      await api.put('/tenants/my-tenant', {
        nomeFantasia: tenantData.nomeFantasia,
        cnpjCpf: tenantData.cnpjCpf,
        telefone: tenantData.telefone,
      });

      // Atualizar contexto de autenticação
      updateUser({
        tenant: {
          ...user.tenant,
          nomeFantasia: tenantData.nomeFantasia,
          cnpjCpf: tenantData.cnpjCpf,
          telefone: tenantData.telefone,
        },
      });

      toast({
        title: "Empresa atualizada!",
        description: "Os dados da empresa foram atualizados com sucesso",
      });
      setShowEditTenant(false);
    } catch (error: unknown) {
      toast({
        title: "Erro ao atualizar empresa",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <User className="h-8 w-8" />
          Meu Perfil
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie suas informações e configurações de segurança
        </p>
      </div>

      {/* Informações do Usuário */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
          <CardDescription>
            Atualize seu nome e email
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showEditProfile ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Nome</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{user?.name}</span>
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{user?.email}</span>
                  </div>
                </div>
                <div>
                  <Label>Função</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                      {user?.role}
                    </span>
                  </div>
                </div>
                {user?.tenant && (
                  <div>
                    <Label>Empresa</Label>
                    <div className="mt-1">
                      <span>{user.tenant.nomeFantasia}</span>
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={() => setShowEditProfile(true)}>
                Editar Informações
              </Button>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) =>
                    setProfileData({ ...profileData, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditProfile(false);
                    setProfileData({
                      name: user?.name || "",
                      email: user?.email || "",
                    });
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Mantenha sua senha segura e atualizada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showChangePassword ? (
            <Button onClick={() => setShowChangePassword(true)}>
              Alterar Senha
            </Button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Senha Atual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  required
                />
              </div>
              <PasswordInput
                id="newPassword"
                label="Nova Senha"
                value={passwordData.newPassword}
                onChange={(value, isValid) => {
                  setPasswordData({ ...passwordData, newPassword: value });
                  setIsNewPasswordValid(isValid);
                }}
                showValidation={true}
                showStrengthMeter={true}
                showConfirmation={true}
                confirmPassword={passwordData.confirmPassword}
                onConfirmChange={(value, matches) => {
                  setPasswordData({ ...passwordData, confirmPassword: value });
                  setPasswordsMatch(matches);
                }}
                placeholder="Digite sua nova senha"
                required
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setIsNewPasswordValid(false);
                    setPasswordsMatch(false);
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || !isNewPasswordValid || !passwordsMatch}>
                  {loading ? "Salvando..." : "Salvar Nova Senha"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Editar Empresa (apenas para ADMIN) */}
      {user?.role === "ADMIN" && user?.tenant && (
        <Card>
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
            <CardDescription>
              Gerencie os dados da sua empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showEditTenant ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Nome Fantasia</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{user.tenant.nomeFantasia}</span>
                    </div>
                  </div>
                  <div>
                    <Label>CNPJ/CPF</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span>{user.tenant.cnpjCpf}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{user.tenant.telefone || "Não informado"}</span>
                    </div>
                  </div>
                </div>
                <Button onClick={() => setShowEditTenant(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Empresa
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdateTenant} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                  <Input
                    id="nomeFantasia"
                    type="text"
                    value={tenantData.nomeFantasia}
                    onChange={(e) =>
                      setTenantData({ ...tenantData, nomeFantasia: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpjCpf">CNPJ/CPF</Label>
                  <Input
                    id="cnpjCpf"
                    type="text"
                    value={tenantData.cnpjCpf}
                    onChange={(e) =>
                      setTenantData({ ...tenantData, cnpjCpf: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    type="text"
                    value={tenantData.telefone}
                    onChange={(e) =>
                      setTenantData({ ...tenantData, telefone: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditTenant(false);
                      setTenantData({
                        nomeFantasia: user.tenant?.nomeFantasia || "",
                        cnpjCpf: user.tenant?.cnpjCpf || "",
                        telefone: user.tenant?.telefone || "",
                      });
                    }}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2FA Setup */}
      <TwoFactorSetup
        isEnabled={twoFactorEnabled}
        onStatusChange={loadUserData}
      />
    </div>
  );
}
