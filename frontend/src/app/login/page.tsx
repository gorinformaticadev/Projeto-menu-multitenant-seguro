"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [masterLogo, setMasterLogo] = useState<string | null>(null);
  const { login } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Busca o logo da tenant padrão (endpoint público)
    async function fetchMasterLogo() {
      try {
        const response = await fetch(`${API_URL}/tenants/public/master-logo`);
        if (response.ok) {
          const data = await response.json();
          if (data.logoUrl) {
            setMasterLogo(data.logoUrl);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar logo:", error);
      }
    }
    fetchMasterLogo();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Sucesso",
        description: "Login realizado com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            {masterLogo ? (
              <div className="w-32 h-20 flex items-center justify-center">
                <img 
                  src={`${API_URL}/uploads/logos/${masterLogo}`} 
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                    if (fallback) {
                      fallback.classList.remove('hidden');
                    }
                  }}
                />
                <div className="bg-primary rounded-full w-16 h-16 flex items-center justify-center fallback-icon hidden">
                  <Shield className="h-8 w-8 text-white" />
                </div>
              </div>
            ) : (
              <div className="bg-primary rounded-full w-16 h-16 flex items-center justify-center">
                <Shield className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl text-center">Sistema Multitenant</CardTitle>
          <CardDescription className="text-center">
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg text-sm">
            <p className="font-semibold mb-2">Credenciais de teste:</p>
            <div className="space-y-1 text-muted-foreground">
              <p><strong>SUPER_ADMIN:</strong> admin@system.com / admin123</p>
              <p><strong>ADMIN:</strong> admin@empresa1.com / admin123</p>
              <p><strong>USER:</strong> user@empresa1.com / user123</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
