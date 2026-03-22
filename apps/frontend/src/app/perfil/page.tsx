"use client";

import type { ReactNode } from "react";
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
import {
  Building2,
  Camera,
  Edit,
  Key,
  Mail,
  Palette,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { resolveTenantLogoSrc } from "@/lib/tenant-logo";

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

  const userAvatarSrc = resolveTenantLogoSrc(user?.avatarUrl, {
    cacheBuster: avatarCacheBuster,
  });
  const currentAvatarSrc = avatarPreview || userAvatarSrc;
  const userInitial = user?.name?.trim().charAt(0).toUpperCase() || "U";

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
    if (!file) return;

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
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUploadAvatar() {
    if (!avatarFile) return;

    try {
      setAvatarSubmitting(true);
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const response = await api.post("/users/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      updateUser({ avatarUrl: response.data?.avatarUrl || null });
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
        description: "A conta voltou a exibir apenas suas iniciais no menu do usuario",
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

  const userRoleLabel = user?.role || "Nao informado";
  const tenantName = user?.tenant?.nomeFantasia || "Sem empresa vinculada";

  return (
    <div className="space-y-6 p-6">
      <Card className="overflow-hidden border-skin-border/80 bg-skin-surface shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-skin-border/70 bg-[radial-gradient(circle_at_top_left,rgba(var(--color-primary),0.18),transparent_45%),linear-gradient(135deg,rgba(var(--color-surface-hover),0.9),rgba(var(--color-surface),1))] px-6 py-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-skin-border bg-skin-background-elevated shadow-sm">
                  {currentAvatarSrc ? (
                    <Image
                      src={currentAvatarSrc}
                      alt="Avatar do usuario"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-skin-primary text-3xl font-semibold text-skin-text-inverse">
                      {userInitial}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-skin-text-muted">
                    <Sparkles className="h-4 w-4" />
                    <span>Conta, seguranca e aparencia</span>
                  </div>
                  <div>
                    <h1 className="flex items-center gap-2 text-3xl font-bold text-skin-text">
                      <User className="h-7 w-7" />
                      Meu Perfil
                    </h1>
                    <p className="mt-2 max-w-2xl text-skin-text-muted">
                      Centralize aqui suas informacoes pessoais, senha, 2FA e tema do sistema.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-skin-border bg-skin-surface px-3 py-1 text-sm text-skin-text">
                      <Mail className="h-3.5 w-3.5 text-skin-text-muted" />
                      {user?.email || "Email nao informado"}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-skin-border bg-skin-surface px-3 py-1 text-sm text-skin-text">
                      <Shield className="h-3.5 w-3.5 text-skin-text-muted" />
                      {userRoleLabel}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-skin-border bg-skin-surface px-3 py-1 text-sm text-skin-text">
                      <Building2 className="h-3.5 w-3.5 text-skin-text-muted" />
                      {tenantName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatusCard label="Conta" value={user?.name || "Usuario"} hint="Dados e avatar" />
                <StatusCard label="Seguranca" value={twoFactorEnabled ? "2FA ativo" : "2FA inativo"} hint="Senha e autenticacao" />
                <StatusCard label="Aparencia" value="Tema do shell" hint="Claro, escuro ou sistema" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Conta
              </CardTitle>
              <CardDescription>
                Atualize seus dados pessoais e a imagem usada no menu do usuario.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <CardBlock
                title="Imagem do menu do usuario"
                description={
                  user?.avatarUrl
                    ? "Imagem personalizada ativa no TopBar."
                    : "Sem imagem personalizada. O sistema exibe apenas suas iniciais."
                }
                aside="Formatos aceitos: JPG, PNG, GIF e WEBP (maximo 5MB)."
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-skin-border bg-skin-surface">
                      {currentAvatarSrc ? (
                        <Image
                          src={currentAvatarSrc}
                          alt="Avatar do usuario"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-skin-primary text-2xl font-semibold text-skin-text-inverse">
                          {userInitial}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-skin-text">
                      <Camera className="h-4 w-4 text-skin-text-muted" />
                      A imagem aparece no dropdown do usuario.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleUploadAvatar} disabled={!avatarFile || avatarSubmitting}>
                      <Upload className="mr-2 h-4 w-4" />
                      {avatarSubmitting ? "Enviando..." : "Salvar Imagem"}
                    </Button>
                    {user?.avatarUrl && (
                      <Button type="button" variant="destructive" onClick={handleRemoveAvatar} disabled={avatarSubmitting}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {avatarSubmitting ? "Removendo..." : "Remover Imagem"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="avatar-upload">Selecionar nova imagem</Label>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    disabled={avatarSubmitting}
                  />
                </div>
              </CardBlock>

              <CardBlock
                title="Informacoes pessoais"
                description="Atualize nome e email usando a mesma integracao ja existente."
              >
                {!showEditProfile ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoTile icon={<User className="h-4 w-4 text-skin-text-muted" />} label="Nome" value={user?.name} />
                      <InfoTile icon={<Mail className="h-4 w-4 text-skin-text-muted" />} label="Email" value={user?.email} />
                      <InfoTile
                        icon={<Shield className="h-4 w-4 text-skin-text-muted" />}
                        label="Funcao"
                        value={<span className="rounded bg-skin-primary/15 px-2 py-1 text-sm text-skin-primary">{userRoleLabel}</span>}
                      />
                      {user?.tenant && (
                        <InfoTile
                          icon={<Building2 className="h-4 w-4 text-skin-text-muted" />}
                          label="Empresa"
                          value={user.tenant.nomeFantasia}
                        />
                      )}
                    </div>
                    <Button onClick={() => setShowEditProfile(true)}>Editar Informacoes</Button>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        type="text"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
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
              </CardBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Seguranca
              </CardTitle>
              <CardDescription>
                Gerencie senha e autenticacao de dois fatores no mesmo lugar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <CardBlock
                title="Senha da conta"
                description="A validacao da nova senha e a persistencia continuam as mesmas."
              >
                {!showChangePassword ? (
                  <Button onClick={() => setShowChangePassword(true)}>Alterar Senha</Button>
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
              </CardBlock>

              <TwoFactorSetup
                isEnabled={twoFactorEnabled}
                onStatusChange={handleTwoFactorStatusChange}
              />
            </CardContent>
          </Card>

          {user?.role === "ADMIN" && user?.tenant && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Informacoes da Empresa
                </CardTitle>
                <CardDescription>
                  Gerencie os dados da empresa usando a mesma integracao atual.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!showEditTenant ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoTile icon={<User className="h-4 w-4 text-skin-text-muted" />} label="Nome Fantasia" value={user.tenant.nomeFantasia} />
                      <InfoTile icon={<Shield className="h-4 w-4 text-skin-text-muted" />} label="CNPJ/CPF" value={user.tenant.cnpjCpf} />
                      <InfoTile icon={<Mail className="h-4 w-4 text-skin-text-muted" />} label="Telefone" value={user.tenant.telefone || "Nao informado"} />
                    </div>
                    <Button onClick={() => setShowEditTenant(true)}>
                      <Edit className="mr-2 h-4 w-4" />
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
                        onChange={(e) => setTenantData({ ...tenantData, nomeFantasia: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnpjCpf">CNPJ/CPF</Label>
                      <Input
                        id="cnpjCpf"
                        type="text"
                        value={tenantData.cnpjCpf}
                        onChange={(e) => setTenantData({ ...tenantData, cnpjCpf: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        type="text"
                        value={tenantData.telefone}
                        onChange={(e) => setTenantData({ ...tenantData, telefone: e.target.value })}
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
        </div>

        <div className="space-y-6">
          <Card id="aparencia">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Aparencia
              </CardTitle>
              <CardDescription>
                O tema do sistema agora fica centralizado dentro do perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-skin-border bg-skin-background-elevated/70 p-4">
                <p className="text-sm font-medium text-skin-text">Tema e aparencia</p>
                <p className="mt-1 text-sm text-skin-text-muted">
                  Esta selecao usa o provider atual, respeita o dark mode existente e salva em `/users/preferences`.
                </p>
                <p className="mt-2 text-xs text-skin-text-muted">
                  Opcoes reais disponiveis: claro, escuro e sistema.
                </p>
              </div>
              <ThemeToggle className="rounded-2xl border border-skin-border bg-skin-surface" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-skin-border/80 bg-skin-surface/90 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-skin-text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-skin-text">{value}</p>
      <p className="mt-1 text-xs text-skin-text-muted">{hint}</p>
    </div>
  );
}

function CardBlock({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-skin-border bg-skin-background-elevated/45 p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-skin-text">{title}</h2>
        <p className="mt-1 text-sm text-skin-text-muted">{description}</p>
        {aside && <p className="mt-1 text-xs text-skin-text-muted">{aside}</p>}
      </div>
      {children}
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-skin-border bg-skin-surface p-4">
      <Label>{label}</Label>
      <div className="mt-2 flex items-center gap-2 text-skin-text">
        {icon}
        <div>{value}</div>
      </div>
    </div>
  );
}
