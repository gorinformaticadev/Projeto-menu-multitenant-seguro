"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Activity, FileText, Search, User } from "lucide-react";
import {
  buildLogsQuery,
  buildLogsStatsQuery,
  type LogsFilters,
  resolveLogsDataSource,
} from "@/app/logs/logs.utils";

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
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const logsSource = useMemo(() => resolveLogsDataSource(user?.role), [user?.role]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [draftFilters, setDraftFilters] = useState<LogsFilters>({
    action: "",
    startDate: "",
    endDate: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<LogsFilters>({
    action: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!logsSource) {
      router.replace("/dashboard");
    }
  }, [authLoading, logsSource, router, user]);

  const fetchLogs = useCallback(async () => {
    if (!logsSource || !user) {
      return;
    }

    try {
      setLoading(true);
      const params = buildLogsQuery(page, appliedFilters);
      const response = await api.get(`${logsSource.listEndpoint}?${params}`);

      setLogs(response.data.data || []);
      setTotalPages(response.data.meta?.totalPages || 1);
    } catch (error: unknown) {
      toast({
        title: "Erro ao carregar logs",
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, logsSource, page, toast, user]);

  const fetchStats = useCallback(async () => {
    if (!logsSource?.statsEndpoint || !user) {
      setStats(null);
      return;
    }

    try {
      const params = buildLogsStatsQuery({
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
      });
      const endpoint = params ? `${logsSource.statsEndpoint}?${params}` : logsSource.statsEndpoint;
      const response = await api.get(endpoint);
      setStats(response.data);
    } catch (error) {
      console.error("Erro ao carregar estatisticas:", error);
      setStats(null);
    }
  }, [appliedFilters.endDate, appliedFilters.startDate, logsSource, user]);

  useEffect(() => {
    if (authLoading || !user || !logsSource) {
      return;
    }

    void fetchLogs();
    void fetchStats();
  }, [authLoading, fetchLogs, fetchStats, logsSource, user]);

  const handleSearch = () => {
    setPage(1);
    setAppliedFilters({ ...draftFilters });
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

  if (authLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Verificando acesso aos logs...</div>;
  }

  if (!user || !logsSource) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <FileText className="h-8 w-8" />
          {logsSource.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{logsSource.description}</p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de registros</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{logsSource.scopeLabel}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acao mais comum</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byAction[0]?.actionLabel || stats.byAction[0]?.action || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.byAction[0]?.count || 0} ocorrencias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuarios ativos</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byUser.length}</div>
              <p className="text-xs text-muted-foreground">Usuarios com atividade</p>
            </CardContent>
          </Card>
        </div>
      )}

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
              <Label htmlFor="action">Acao</Label>
              <Input
                id="action"
                placeholder="UPDATE_FAILED, RESTORE_FAILED..."
                value={draftFilters.action}
                onChange={(e) =>
                  setDraftFilters((current) => ({ ...current, action: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="startDate">Data inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={draftFilters.startDate}
                onChange={(e) =>
                  setDraftFilters((current) => ({ ...current, startDate: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="endDate">Data fim</Label>
              <Input
                id="endDate"
                type="date"
                value={draftFilters.endDate}
                onChange={(e) =>
                  setDraftFilters((current) => ({ ...current, endDate: e.target.value }))
                }
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
          <CardDescription>
            Pagina {page} de {totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center">Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhum registro encontrado</div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${getActionBadgeColor(log.action)}`}
                        >
                          {log.actionLabel || log.action}
                        </span>
                        <span className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</span>
                      </div>

                      {log.message && log.message !== (log.actionLabel || log.action) ? (
                        <p className="text-sm text-foreground">{log.message}</p>
                      ) : null}

                      {log.user ? (
                        <div className="text-sm">
                          <span className="font-medium">{log.user.name}</span>
                          <span className="text-muted-foreground"> ({log.user.email})</span>
                          <span className="ml-2 rounded bg-skin-background-elevated px-2 py-1 text-xs text-skin-text">
                            {log.user.role}
                          </span>
                        </div>
                      ) : null}

                      <div className="space-y-1 text-sm text-muted-foreground">
                        {log.ipAddress ? <div>IP: {log.ipAddress}</div> : null}
                        {log.userAgent ? <div className="truncate">User-Agent: {log.userAgent}</div> : null}
                        {log.details ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-primary hover:underline">
                              Ver detalhes
                            </summary>
                            <pre className="mt-2 overflow-auto rounded bg-skin-background-elevated p-2 text-xs text-skin-text">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-6 flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((current) => current - 1)}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="flex items-center px-4">
                Pagina {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={page === totalPages}
              >
                Proxima
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
