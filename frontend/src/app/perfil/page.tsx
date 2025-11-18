"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { User, Mail, Shield, Key, Edit } from "lucide-react";

export default function PerfilPage() {
  const { user } = useAuth();
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

  useEffect(() => {
    if (user?.id) {
      loadUserData();
      setProfileData({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user?.id]);

  async function loadUserData() {
    if (!user?.id) return;
    
    try {
      const response = await api.get(`/users/${user.id}`);
      setTwoFactorEnabled(response.data.twoFactorEnabled || false);
      setProfileData({
        name: response.data.name || "",
        email: response.data.email || "",
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  }

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
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram atualizadas com sucesso",
      });
      setShowEditProfile(false);
      // Recarregar dados do usuário
      await loadUserData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
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
      setShowChangePassword(false);
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.response?.data?.message || "Erro desconhecido",
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
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    required
                  />
                </div>
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
                    }}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : "Salvar Nova Senha"}
                  </Button>
                </div>
              </form>
            )}
        </CardContent>
      </Card>

      {/* 2FA Setup */}
      <TwoFactorSetup
        isEnabled={twoFactorEnabled}
        onStatusChange={loadUserData}
      />
    </div>
  );
}
