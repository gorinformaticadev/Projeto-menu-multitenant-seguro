# Plano de Resposta a Incidentes de Segurança

**Versão**: 1.0  
**Data**: 10/12/2024  
**Responsável**: Equipe de Segurança e DevOps  
**Última Revisão**: 10/12/2024

## 📋 Índice

1. [Objetivo](#objetivo)
2. [Classificação de Incidentes](#classificação-de-incidentes)
3. [Equipe de Resposta](#equipe-de-resposta)
4. [Procedimentos por Severidade](#procedimentos-por-severidade)
5. [Fluxo de Resposta](#fluxo-de-resposta)
6. [Comunicação](#comunicação)
7. [Pós-Incidente](#pós-incidente)

---

## 🎯 Objetivo

Este documento define procedimentos padronizados para identificar, responder e recuperar de incidentes de segurança, minimizando impacto e prevenindo recorrências.

---

## 🔴 Classificação de Incidentes

### P0 - Crítico
**Tempo de Resposta**: Imediato (< 1 hora)  
**Exemplos**:
- Breach de dados confirmado
- Acesso não autorizado a dados sensíveis
- Ransomware ou malware ativo
- Sistema completamente comprometido
- Vazamento de credenciais de admin

**Indicadores**:
- Dados de usuários expostos
- Acesso root/admin comprometido
- Sistema indisponível por ataque

### P1 - Alto
**Tempo de Resposta**: < 4 horas  
**Exemplos**:
- Tentativa ativa de ataque (DDoS, brute force massivo)
- Vulnerabilidade crítica descoberta (CVE critical)
- Suspeita de breach (logs suspeitos)
- Múltiplas falhas de autenticação de origem desconhecida

**Indicadores**:
- > 100 tentativas de login falhadas do mesmo IP
- Tráfego anormal (10x do normal)
- Alerts do Sentry sobre erros críticos de segurança

### P2 - Médio
**Tempo de Resposta**: < 24 horas  
**Exemplos**:
- Vulnerabilidade conhecida com patch disponível
- Comportamento suspeito de usuário
- Configuração de segurança incorreta descoberta
- Acesso a rotas sensíveis de IP não autorizado

**Indicadores**:
- npm audit com vulnerabilidades HIGH
- Usuário acessando recursos fora do horário normal
- Taxa de erro elevada em endpoints de autenticação

### P3 - Baixo
**Tempo de Resposta**: < 72 horas  
**Exemplos**:
- Anomalias menores de segurança
- Alertas informativos
- Melhorias de segurança sugeridas
- Vulnerabilidades de severidade LOW

---

## 👥 Equipe de Resposta a Incidentes

### Estrutura da Equipe

| Papel | Responsabilidades | Contato de Emergência |
|-------|-------------------|----------------------|
| **Coordenador de Incidentes** | Gerenciar resposta, comunicação | [Nome] - [Telefone] |
| **Tech Lead** | Decisões técnicas, análise de código | [Nome] - [Telefone] |
| **DevOps** | Infraestrutura, logs, rollback | [Nome] - [Telefone] |
| **DBA** | Backup, restore, análise de banco | [Nome] - [Telefone] |
| **Comunicação** | Stakeholders, usuários | [Nome] - [Telefone] |

### Escalação

**P0/P1**: Ativar toda a equipe imediatamente  
**P2**: Coordenador + Tech Lead + área afetada  
**P3**: Área afetada apenas

---

## 🚨 Procedimentos por Severidade

### P0 - Procedimento de Emergência Crítica

#### Fase 1: Contenção Imediata (0-15 minutos)

1. **Declarar incidente P0**
   ```powershell
   # Enviar alerta para toda equipe
   # Criar canal de comunicação dedicado (Slack/Teams)
   ```

2. **Isolar sistema afetado** (se breach confirmado)
   ```powershell
   # Opção 1: Bloquear tráfego no firewall
   # Opção 2: Ativar "I'm Under Attack" Mode no Cloudflare
   # Opção 3: Desativar servidor temporariamente
   ```

3. **Preservar evidências**
   ```powershell
   # Capturar logs antes de qualquer ação
   cd backend
   Get-Content .\logs\*.log > "incident_logs_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
   
   # Backup do banco atual (mesmo se comprometido)
   pg_dump multitenant_db > "incident_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
   ```

4. **Documentar linha do tempo**
   ```
   [HH:MM] Incidente detectado
   [HH:MM] Equipe ativada
   [HH:MM] Sistema isolado
   [HH:MM] Evidências preservadas
   ```

#### Fase 2: Investigação Urgente (15-60 minutos)

1. **Análise de logs de auditoria**
   ```sql
   -- Últimas ações suspeitas
   SELECT * FROM audit_logs 
   WHERE created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC
   LIMIT 100;
   
   -- Logins de IPs desconhecidos
   SELECT DISTINCT ip_address, user_id, action 
   FROM audit_logs 
   WHERE action LIKE 'LOGIN%' 
   AND created_at > NOW() - INTERVAL '24 hours';
   ```

2. **Identificar vetor de ataque**
   - Acesso direto ao banco?
   - Exploração de vulnerabilidade?
   - Credenciais comprometidas?
   - Injeção de código?

3. **Determinar extensão do comprometimento**
   - Quais dados foram acessados?
   - Quais usuários afetados?
   - Sistemas adicionais comprometidos?

#### Fase 3: Erradicação (1-4 horas)

1. **Aplicar correção imediata**
   ```powershell
   # Se vulnerabilidade conhecida
   git pull origin hotfix/security-patch
   npm install
   npm run build
   
   # Reiniciar com correção
   pm2 restart backend
   ```

2. **Revogar acessos comprometidos**
   ```sql
   -- Invalidar todos os refresh tokens
   DELETE FROM refresh_tokens WHERE user_id = 'USER_ID_COMPROMETIDO';
   
   -- Bloquear conta se necessário
   UPDATE users SET is_locked = true WHERE id = 'USER_ID';
   ```

3. **Bloquear IPs maliciosos**
   ```
   # Via Cloudflare Dashboard
   Security → WAF → Tools → IP Access Rules
   Adicionar IP com ação "Block"
   ```

4. **Verificar integridade do sistema**
   ```powershell
   # Verificar arquivos modificados
   git status
   
   # Scan de malware (se aplicável)
   # Verificar processos suspeitos
   ```

#### Fase 4: Recuperação (4-24 horas)

1. **Restaurar serviços gradualmente**
   ```powershell
   # 1. Ambiente de staging primeiro
   # 2. Monitorar intensamente
   # 3. Produção quando estável
   ```

2. **Forçar reset de senhas (se credenciais comprometidas)**
   ```sql
   UPDATE users SET 
     password_must_change = true,
     last_password_change = NULL
   WHERE role IN ('ADMIN', 'SUPER_ADMIN');
   ```

3. **Monitoramento intensivo (24-48h)**
   - Logs em tempo real
   - Alerts no Sentry
   - Métricas de performance
   - Tentativas de login

4. **Comunicar usuários afetados**
   ```
   Assunto: Notificação de Incidente de Segurança
   
   Detectamos e resolvemos um incidente de segurança.
   Ação necessária: [se houver]
   Dados afetados: [especificar]
   Medidas tomadas: [detalhar]
   ```

### P1 - Procedimento de Alta Prioridade

#### Fase 1: Avaliação Rápida (0-30 minutos)

1. **Confirmar severidade**
2. **Ativar equipe central** (Coordenador + Tech Lead + DevOps)
3. **Capturar evidências** iniciais
4. **Implementar mitigação temporária** se possível

#### Fase 2: Análise e Resposta (30 min - 4h)

1. **Análise detalhada**
2. **Desenvolver plano de ação**
3. **Implementar correção**
4. **Testar em staging**
5. **Deploy em produção**
6. **Monitorar resultados**

### P2/P3 - Procedimento Padrão

1. **Criar ticket** no sistema de gestão
2. **Analisar** em até 24h (P2) ou 72h (P3)
3. **Planejar correção** para próximo sprint
4. **Implementar** seguindo processo normal de deploy
5. **Documentar** lições aprendidas

---

## 📞 Comunicação

### Comunicação Interna

**Canais**:
- **P0/P1**: Telefone + Slack/Teams dedicado
- **P2**: Slack/Teams + Email
- **P3**: Email

**Frequência de Updates**:
- **P0**: A cada 30 minutos durante resposta ativa
- **P1**: A cada 2 horas
- **P2/P3**: Daily update

### Comunicação Externa

**Usuários Afetados**:
- **P0**: Email + Notificação in-app (24h após contenção)
- **P1**: Email se dados afetados
- **P2/P3**: Não necessário, exceto se solicitado

**Stakeholders/Management**:
- **P0**: Imediato (telefone)
- **P1**: Dentro de 4 horas
- **P2**: Relatório semanal
- **P3**: Relatório mensal

**Conformidade Legal** (LGPD):
- **Breach de dados pessoais**: Notificar ANPD em até 72 horas
- **Documentar**: Data/hora, dados afetados, medidas tomadas

---

## 📊 Pós-Incidente

### Relatório Pós-Incidente (obrigatório para P0/P1)

**Prazo**: 7 dias após resolução

**Estrutura**:

```markdown
# Relatório de Incidente #[NÚMERO]

## Resumo Executivo
- Tipo de incidente
- Data/hora de detecção
- Severidade
- Status (Resolvido)

## Linha do Tempo
[HH:MM] Evento 1
[HH:MM] Evento 2
...

## Causa Raiz
- O que falhou?
- Por que falhou?
- Como foi possível?

## Impacto
- Usuários afetados: [número]
- Dados comprometidos: [tipo e quantidade]
- Tempo de indisponibilidade: [se houver]
- Custo estimado: [se aplicável]

## Ações Tomadas
1. Contenção
2. Erradicação
3. Recuperação

## Lições Aprendidas
- O que funcionou bem?
- O que pode ser melhorado?
- Gaps identificados?

## Ações Preventivas
1. [ ] Ação 1 (Responsável: [Nome], Prazo: [Data])
2. [ ] Ação 2 (Responsável: [Nome], Prazo: [Data])
```

### Análise de Causa Raiz (RCA)

Utilizar método "5 Porquês":

**Exemplo**:
1. **Por que o incidente ocorreu?** → Vulnerabilidade explorada
2. **Por que a vulnerabilidade existia?** → Dependência desatualizada
3. **Por que a dependência estava desatualizada?** → npm audit não rodando regularmente
4. **Por que não rodava regularmente?** → Não estava no CI/CD
5. **Por que não estava no CI/CD?** → Não priorizado anteriormente

**Causa Raiz**: Falta de automação de verificação de segurança

**Ação**: Adicionar npm audit ao pipeline CI/CD

### Atualização de Procedimentos

Após cada incidente P0/P1:
- [ ] Revisar este documento
- [ ] Atualizar runbooks
- [ ] Treinar equipe em gaps identificados
- [ ] Atualizar ferramentas/automação

---

## 🧰 Ferramentas e Recursos

### Ferramentas de Análise

| Ferramenta | Uso | Acesso |
|------------|-----|--------|
| Sentry | Monitoramento de erros | https://sentry.io/your-org |
| Cloudflare | Logs de WAF, DDoS | https://dash.cloudflare.com |
| PostgreSQL | Logs de banco | Via psql |
| Audit Logs | Logs de aplicação | `SELECT * FROM audit_logs` |

### Comandos Úteis

```powershell
# Logs do backend (últimas 100 linhas)
Get-Content .\logs\backend.log -Tail 100

# Conexões ativas no PostgreSQL
SELECT * FROM pg_stat_activity;

# Sessões ativas de usuários
SELECT COUNT(*) FROM refresh_tokens WHERE expires_at > NOW();

# Últimos logins
SELECT * FROM audit_logs WHERE action = 'LOGIN_SUCCESS' ORDER BY created_at DESC LIMIT 10;
```

### Contatos Externos

- **Cloudflare Support**: https://support.cloudflare.com
- **ANPD** (LGPD): https://www.gov.br/anpd
- **CERT.br**: https://www.cert.br/

---

## ✅ Checklist de Preparação

- [ ] Equipe de resposta definida e treinada
- [ ] Contatos de emergência atualizados
- [ ] Procedimentos testados (simulação de incidente)
- [ ] Ferramentas de análise configuradas
- [ ] Backups automatizados e testados
- [ ] Monitoramento 24/7 ativo (Sentry)
- [ ] Plano de comunicação definido
- [ ] Templates de email preparados
- [ ] Acesso de emergência documentado

---

## 🔄 Simulações e Treinamento

**Frequência**: Trimestral

**Tipos de Simulação**:
1. **Tabletop Exercise**: Discussão teórica de cenário
2. **Simulação Técnica**: Ataque controlado em staging
3. **Full Drill**: Simulação completa com toda equipe

**Próxima Simulação Agendada**: [DATA]

---

**Aprovação**:  
- Tech Lead: [Nome] - [Data]  
- Segurança: [Nome] - [Data]  
- Management: [Nome] - [Data]

**Última Revisão**: 10/12/2024  
**Próxima Revisão Agendada**: 10/03/2025
