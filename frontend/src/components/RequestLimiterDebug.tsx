"use client";

import { useState, useEffect } from 'react';
import { globalRequestLimiter } from '@/lib/request-limiter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

export function RequestLimiterDebug() {
  const [stats, setStats] = useState<Record<string, any>>({});
  const [isVisible, setIsVisible] = useState(false);

  const refreshStats = () => {
    setStats(globalRequestLimiter.getStats());
  };

  const clearAll = () => {
    globalRequestLimiter.clearAll();
    refreshStats();
  };

  const clearKey = (key: string) => {
    globalRequestLimiter.clearKey(key);
    refreshStats();
  };

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 2000);
    return () => clearInterval(interval);
  }, []);

  // Só mostra em desenvolvimento
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Rate Limiter Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="bg-background/95 backdrop-blur-sm border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Rate Limiter Status</CardTitle>
              <CardDescription className="text-xs">
                Monitoramento de requisições
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                onClick={refreshStats}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                onClick={clearAll}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                ×
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 max-h-80 overflow-y-auto">
          {Object.keys(stats).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma requisição registrada</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats).map(([key, data]) => (
                <div key={key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium truncate" title={key}>
                      {key}
                    </h4>
                    <Button
                      onClick={() => clearKey(key)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Req/min:</span>
                      <Badge variant={data.requestsLastMinute > 5 ? "destructive" : "secondary"}>
                        {data.requestsLastMinute}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Falhas:</span>
                      <Badge variant={data.failures > 0 ? "destructive" : "secondary"}>
                        {data.failures}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Circuit:</span>
                      {data.circuitBreakerOpen ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Aberto
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Fechado
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Cache:</span>
                      {data.hasCachedData ? (
                        <Badge variant="secondary">
                          {data.cacheAge ? `${Math.round(data.cacheAge / 1000)}s` : 'Sim'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Não</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}