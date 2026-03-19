"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Search, Calendar, User, Activity } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  actionLabel?: string;
  message?: string | null;
  userId: string | null;
  tenantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: unknown;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface AuditStats {
  total: number;
  byAction: Array<{ action: string; actionLabel?: string; count: number }>;
  byUser: Array<{ userId: string; count: number }>;
}

export default function LogsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filtros
  const [filters, setFilters] = useState({
    action: "",
    userId: "",
    startDate: "",
    endDate: "",
  });

  // Redirecionar se não for SUPER_ADMIN
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      window.location.href = "/dashboard";
    }
  }, [user]);

  // Carregar logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...filters,
      });

      const response = await api.get(`/audit-logs?${params}`);
      setLogs(response.data.data);
      setTotalPages(response.data.meta.totalPages);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar logs",
        description: error.response?.data?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar estatísticas
  const fetchStats = async () => {
    try {
      const response = await api.get("/audit-logs/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      fetchLogs();
      fetchStats();
    }
  }, [page, user]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("SUCCESS")) return "bg-skin-success/10 text-skin-success";
    if (action.includes("FAILED")) return "bg-skin-danger/10 text-skin-danger";
    if (action.includes("CREATE")) return "bg-skin-info/10 text-skin-info";
    if (action.includes("UPDATE")) return "bg-skin-warning/10 text-skin-warning";
    if (action.includes("DELETE")) return "bg-skin-danger/10 text-skin-danger";
    return "bg-skin-background-elevated text-skin-text";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  if (user?.role !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Logs de Auditoria
        </h1>
        <p className="text-muted-foreground mt-2">
          Visualize todas as ações realizadas no sistema
        </p>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ação Mais Comum</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.byAction[0]?.actionLabel || stats.byAction[0]?.action || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.byAction[0]?.count || 0} ocorrências
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.byUser.length}</div>
                <p className="text-xs text-muted-foreground">
                  Usuários com atividade
                </p>
              </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label htmlFor="action">Ação</Label>
                <Input
                  id="action"
                  placeholder="LOGIN_SUCCESS, CREATE_TENANT..."
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="startDate">Data Início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="endDate">Data Fim</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={handleSearch} className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
          <CardHeader>
            <CardTitle>Registros de Auditoria</CardTitle>
            <CardDescription>
              Página {page} de {totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >

                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.actionLabel || log.action}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>

                        {log.message && log.message !== (log.actionLabel || log.action) ? (
                          <p className="text-sm text-foreground">
                            {log.message}
                          </p>
                        ) : null}

                        {log.user && (
                          <div className="text-sm">
                            <span className="font-medium">{log.user.name}</span>
                            <span className="text-muted-foreground"> ({log.user.email})</span>
                            <span className="ml-2 rounded bg-skin-background-elevated px-2 py-1 text-xs text-skin-text">
                              {log.user.role}
                            </span>
                          </div>
                        )}

                        <div className="text-sm text-muted-foreground space-y-1">
                          {log.ipAddress && (
                            <div>IP: {log.ipAddress}</div>
                          )}
                          {log.userAgent && (
                            <div className="truncate">User-Agent: {log.userAgent}</div>
                          )}
                          {log.details && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-primary hover:underline">
                                Ver detalhes
                              </summary>
                              <pre className="mt-2 overflow-auto rounded bg-skin-background-elevated p-2 text-xs text-skin-text">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <span className="flex items-center px-4">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Próxima
                </Button>
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
