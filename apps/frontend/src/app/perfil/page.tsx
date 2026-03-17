"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { User, Mail, Shield, Key, Edit, Upload, Trash2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { DEFAULT_TENANT_LOGO_PATH, resolveTenantLogoSrc } from "@/lib/tenant-logo";

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarSubmitting, setAvatarSubmitting] = useState(false);
  const [avatarCacheBuster, setAvatarCacheBuster] = useState<number>(() => Date.now());

  const tenantLogoFallbackSrc =
    resolveTenantLogoSrc(user?.tenant?.logoUrl, {
      tenantId: user?.tenantId,
      fallbackToDefault: true,
    }) || DEFAULT_TENANT_LOGO_PATH;
  const userAvatarSrc = resolveTenantLogoSrc(user?.avatarUrl, {
    cacheBuster: avatarCacheBuster,
  });
  const currentAvatarSrc = avatarPreview || userAvatarSrc || tenantLogoFallbackSrc;

  const getProfileCacheKey = useCallback(() => {
    if (!user?.id) return null;
    return `user-profile-${user.id}`;
  }, [user?.id]);

  const loadUserData = useCallback(async (force = false) => {
    if (!user?.id) return;

    const cacheKey = getProfileCacheKey();
    if (!cacheKey) return;
    const cacheTTL = 2 * 60 * 1000;

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
        } catch {
          // noop
        }
      }
    }

    try {
      const response = await api.get("/auth/me");
      const userData = response.data;

      setTwoFactorEnabled(userData.twoFactorEnabled || false);
      setProfileData({
        name: userData.name || "",
        email: userData.email || "",
      });
      updateUser({
        name: userData.name || "",
        email: userData.email || "",
        twoFactorEnabled: userData.twoFactorEnabled || false,
      });

      localStorage.setItem(cacheKey, JSON.stringify({
        data: userData,
        timestamp: Date.now(),
      }));
    } catch {
      // noop
    }
  }, [getProfileCacheKey, updateUser, user?.id]);

  const handleTwoFactorStatusChange = useCallback(async (enabled: boolean) => {
    const cacheKey = getProfileCacheKey();
    if (cacheKey) {
      localStorage.removeItem(cacheKey);
    }

    setTwoFactorEnabled(enabled);
    updateUser({ twoFactorEnabled: enabled });
    await loadUserData(true);
  }, [getProfileCacheKey, loadUserData, updateUser]);

  useEffect(() => {
    if (user?.id) {
      loadUserData();
      setProfileData({
        name: user.name || "",
        email: user.email || "",
      });

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
        description: "Nome e email sao obrigatorios",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await api.put("/users/profile", {
        name: profileData.name,
        email: profileData.email,
      });
      updateUser({
        name: profileData.name,
        email: profileData.email,
      });

      toast({
        title: "Perfil atualizado",
        description: "Suas informacoes foram atualizadas com sucesso",
      });
      setShowEditProfile(false);
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
        description: "A nova senha nao atende aos requisitos de seguranca",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Erro",
        description: "As senhas nao coincidem",
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
        title: "Senha alterada",
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
        description: "Nome fantasia e CNPJ/CPF sao obrigatorios",
        variant: "destructive",
      });
      return;
    }

    if (!user?.tenant) return;

    try {
      setLoading(true);
      await api.put("/tenants/my-tenant", {
        nomeFantasia: tenantData.nomeFantasia,
        cnpjCpf: tenantData.cnpjCpf,
        telefone: tenantData.telefone,
      });

      updateUser({
        tenant: {
          ...user.tenant,
          nomeFantasia: tenantData.nomeFantasia,
          cnpjCpf: tenantData.cnpjCpf,
          telefone: tenantData.telefone,
        },
      });

      toast({
        title: "Empresa atualizada",
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

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo invalido",
        description: "Selecione um arquivo de imagem",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no maximo 5MB",
        variant: "destructive",
      });
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleUploadAvatar() {
    if (!avatarFile) return;

    try {
      setAvatarSubmitting(true);
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const response = await api.post("/users/profile/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      updateUser({
        avatarUrl: response.data?.avatarUrl || null,
      });
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarCacheBuster(Date.now());

      toast({
        title: "Imagem atualizada",
        description: "A foto do menu do usuario foi atualizada com sucesso",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao atualizar imagem",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setAvatarSubmitting(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!user?.avatarUrl) return;

    try {
      setAvatarSubmitting(true);
      await api.patch("/users/profile/avatar/remove");

      updateUser({ avatarUrl: null });
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarCacheBuster(Date.now());

      toast({
        title: "Imagem removida",
        description: "Voltamos para a imagem padrao do tenant",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao remover imagem",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setAvatarSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <User className="h-8 w-8" />
          Meu Perfil
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie suas informacoes e configuracoes de seguranca
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Imagem do Menu de Usuario</CardTitle>
          <CardDescription>
            Esta imagem aparece no menu de usuario no TopBar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border bg-muted">
              <Image
                src={currentAvatarSrc}
                alt="Avatar do usuario"
                fill
                className="object-cover"
                unoptimized
                onError={(e) => {
                  e.currentTarget.src = tenantLogoFallbackSrc;
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                {user?.avatarUrl
                  ? "Imagem personalizada ativa"
                  : "Sem imagem personalizada. Usando fallback do tenant."}
              </p>
              <p>Formatos aceitos: JPG, PNG, GIF e WEBP (maximo 5MB)</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar-upload">Selecionar nova imagem</Label>
            <Input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              disabled={avatarSubmitting}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleUploadAvatar}
              disabled={!avatarFile || avatarSubmitting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {avatarSubmitting ? "Enviando..." : "Salvar Imagem"}
            </Button>

            {user?.avatarUrl && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemoveAvatar}
                disabled={avatarSubmitting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {avatarSubmitting ? "Removendo..." : "Remover Imagem"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informacoes Pessoais</CardTitle>
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
                  <Label>Funcao</Label>
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
                Editar Informacoes
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
                  {loading ? "Salvando..." : "Salvar Alteracoes"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

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

      {user?.role === "ADMIN" && user?.tenant && (
        <Card>
          <CardHeader>
            <CardTitle>Informacoes da Empresa</CardTitle>
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
                      <span>{user.tenant.telefone || "Nao informado"}</span>
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
                    {loading ? "Salvando..." : "Salvar Alteracoes"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <TwoFactorSetup
        isEnabled={twoFactorEnabled}
        onStatusChange={handleTwoFactorStatusChange}
      />
    </div>
  );
}
