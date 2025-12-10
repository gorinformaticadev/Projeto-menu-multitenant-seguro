# Checklist Semanal de Segurança

**Responsável**: Equipe de DevOps/Segurança  
**Frequência**: Toda segunda-feira  
**Tempo estimado**: 30-45 minutos

## 📋 Tarefas Semanais

### 1. Análise de Logs de Auditoria
- [ ] Acessar painel de auditoria (`GET /audit/logs?severity=CRITICAL`)
- [ ] Filtrar eventos da última semana
- [ ] Revisar ações críticas:
  - [ ] Tentativas de login falhadas em massa (> 10 por IP)
  - [ ] Mudanças em configurações de segurança
  - [ ] Criação/exclusão de usuários ADMIN/SUPER_ADMIN
  - [ ] Acessos fora do horário comercial (se aplicável)
- [ ] Documentar anomalias encontradas no registro de incidentes

### 2. Contas Bloqueadas
- [ ] Listar contas bloqueadas: `GET /users?isLocked=true`
- [ ] Verificar razão do bloqueio (logs de auditoria)
- [ ] Identificar padrões:
  - [ ] Mesmo IP tentando múltiplas contas?
  - [ ] Horários específicos?
  - [ ] Contas legítimas ou ataques?
- [ ] Desbloquear contas legítimas se necessário
- [ ] Reportar tentativas de ataque identificadas

### 3. Validação de Backups
- [ ] Verificar último backup do banco de dados
  - [ ] Data/hora do último backup < 24 horas
  - [ ] Arquivo de backup existe e não está corrompido
  - [ ] Checksum SHA-256 validado
- [ ] Verificar espaço em disco para backups
- [ ] Testar restore em ambiente de teste (1x por mês)

### 4. Análise de Vulnerabilidades
- [ ] Executar `npm audit` no backend:
  ```powershell
  cd backend
  npm audit
  ```
- [ ] Executar `npm audit` no frontend:
  ```powershell
  cd frontend
  npm audit
  ```
- [ ] Revisar vulnerabilidades encontradas:
  - [ ] CRITICAL: Corrigir imediatamente
  - [ ] HIGH: Planejar correção para a semana
  - [ ] MODERATE/LOW: Adicionar ao backlog
- [ ] Documentar vulnerabilidades e plano de ação

### 5. Monitoramento Sentry
- [ ] Acessar dashboard do Sentry
- [ ] Revisar erros da última semana:
  - [ ] Erros de autenticação/autorização
  - [ ] Erros 500 (Internal Server Error)
  - [ ] Erros de validação recorrentes
- [ ] Identificar padrões ou regressões
- [ ] Criar issues para erros críticos recorrentes

### 6. Certificados SSL
- [ ] Verificar validade do certificado SSL (se em produção):
  ```powershell
  # PowerShell
  $cert = (New-Object Net.Sockets.TcpClient("seudominio.com", 443)).GetStream().AuthenticateAsClient("seudominio.com", $null, "Tls12", $false)
  $cert.RemoteCertificate.GetExpirationDateString()
  ```
- [ ] Se expira em < 30 dias: Renovar certificado
- [ ] Testar HTTPS e redirecionamento HTTP → HTTPS

### 7. Sessões Ativas Anormais
- [ ] Listar sessões (refresh tokens) ativas > 7 dias:
  ```sql
  SELECT userId, COUNT(*) as sessions, MAX(createdAt) as lastSession
  FROM refresh_tokens
  WHERE createdAt < NOW() - INTERVAL '7 days'
  GROUP BY userId
  HAVING COUNT(*) > 5
  ```
- [ ] Investigar usuários com muitas sessões antigas
- [ ] Revogar sessões suspeitas se necessário

### 8. Rate Limiting
- [ ] Verificar logs de rate limiting bloqueado
- [ ] Identificar IPs frequentemente bloqueados
- [ ] Analisar se é ataque ou uso legítimo
- [ ] Ajustar configurações se necessário

## 📊 Registro de Execução

### Semana de [DATA]

| Tarefa | Status | Observações | Ações Tomadas |
|--------|--------|-------------|---------------|
| Logs de Auditoria | ☑️ | 3 tentativas de ataque em /admin | IPs bloqueados via Cloudflare |
| Contas Bloqueadas | ☑️ | 2 contas legítimas desbloqueadas | Usuários notificados por email |
| Backups | ☑️ | Último backup: 23h atrás | ✓ OK |
| npm audit | ☑️ | 1 vulnerabilidade HIGH encontrada | Atualizado bcrypt para 5.1.2 |
| Sentry | ☑️ | Erro recorrente em /users/profile | Issue #123 criada |
| Certificados SSL | ☑️ | Expira em 45 dias | ✓ OK |
| Sessões Anormais | ☑️ | Nenhuma sessão suspeita | ✓ OK |
| Rate Limiting | ☑️ | IP 203.0.113.50 bloqueado 50x | IP adicionado à blocklist |

**Executor**: [Nome]  
**Data de Execução**: [DD/MM/YYYY]  
**Tempo Gasto**: [XX minutos]

## 🚨 Incidentes Identificados

### Incidente #[NÚMERO] - [TÍTULO]
- **Data**: DD/MM/YYYY
- **Severidade**: Critical / High / Medium / Low
- **Descrição**: [Descrição detalhada]
- **Impacto**: [Sistemas/usuários afetados]
- **Ação Imediata**: [O que foi feito]
- **Ação Preventiva**: [Como evitar recorrência]
- **Status**: Resolvido / Em andamento / Pendente

## ✅ Checklist de Qualidade

Antes de finalizar o checklist semanal:
- [ ] Todas as 8 tarefas foram executadas
- [ ] Registro de execução preenchido
- [ ] Incidentes documentados (se houver)
- [ ] Ações críticas foram tomadas
- [ ] Equipe notificada de problemas identificados
- [ ] Checklist salvo no repositório de documentação

## 📌 Notas Importantes

- **Escalação**: Vulnerabilidades CRITICAL devem ser escaladas imediatamente para o Tech Lead
- **Comunicação**: Incidentes de severidade HIGH ou superior devem ser comunicados ao time
- **Documentação**: Manter histórico de checklists para análise de tendências

## 📞 Contatos de Emergência

- **Tech Lead**: [Nome] - [Email] - [Telefone]
- **DevOps**: [Nome] - [Email] - [Telefone]
- **Segurança**: [Nome] - [Email] - [Telefone]

---

**Última atualização**: 10/12/2024
