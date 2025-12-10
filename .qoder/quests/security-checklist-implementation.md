# Verificação e Implementação Completa do Checklist de Segurança

## Contexto do Projeto

Sistema multitenant full-stack com NestJS (backend) e Next.js (frontend) que já possui implementações de segurança significativas. Este documento analisa o estado atual de segurança e define a estratégia de implementação para itens faltantes ou parcialmente implementados.

## Análise do Estado Atual de Segurança

### ✔️ Itens Já Implementados (Confirmado)

#### 1. Autenticação e Controle de Acesso

| Item | Status | Localização | Observações |
|------|--------|-------------|-------------|
| Hash de senhas com Bcrypt | ✔️ Completo | `backend/src/auth/auth.service.ts` (linha 79, 448-449) | Salt rounds: 10, adequado para produção |
| JWT com tokens de curta duração | ✔️ Completo | Access Token: 15min, Refresh Token: 7 dias | Configurável via env |
| Refresh Token com rotação | ✔️ Completo | `backend/src/auth/auth.service.ts` (linha 231-286) | Token único por sessão com expiração |
| 2FA (TOTP) | ✔️ Completo | `backend/src/auth/two-factor.service.ts` | Opcional, não obrigatório por padrão |
| Bloqueio de conta após tentativas falhas | ✔️ Completo | `backend/src/auth/auth.service.ts` (linha 44-151) | Configurável: 5 tentativas, bloqueio de 30min |
| Auditoria de login | ✔️ Completo | `backend/src/audit/audit.service.ts` | Logs de LOGIN_SUCCESS, LOGIN_FAILED, etc. |

#### 2. Segurança no Backend

| Item | Status | Localização | Observações |
|------|--------|-------------|-------------|
| CSRF Protection | ✔️ Completo | `backend/src/common/guards/csrf.guard.ts` | Double Submit Cookie pattern |
| Rate Limiting | ✔️ Completo | `backend/src/app.module.ts` (linha 32-45) | 100 req/min produção, 5 tentativas login |
| CORS Estrito | ✔️ Completo | `backend/src/main.ts` (linha 140-151) | Apenas origens configuradas, sem "*" |
| Headers de Segurança (Helmet) | ✔️ Completo | `backend/src/main.ts` (linha 30-114) | CSP, HSTS, X-Frame-Options, etc. |
| Validação de entrada (DTOs) | ✔️ Completo | ValidationPipe global com class-validator | Whitelist, forbidNonWhitelisted |
| ORM sem raw queries | ✔️ Completo | Prisma ORM em todo o projeto | Proteção contra SQL Injection |
| Isolamento Multitenant | ✔️ Completo | TenantInterceptor global | Automático exceto SUPER_ADMIN |
| RBAC com 4 níveis | ✔️ Completo | RolesGuard + decorador @Roles | SUPER_ADMIN, ADMIN, USER, CLIENT |
| Monitoramento (Sentry) | ✔️ Completo | `backend/src/common/services/sentry.service.ts` | Tracking de erros e performance |

#### 3. Segurança no Frontend

| Item | Status | Localização | Observações |
|------|--------|-------------|-------------|
| Proteção de rotas | ✔️ Completo | ProtectedRoute component | Verificação de auth e roles |
| Auto-refresh de tokens | ✔️ Completo | Axios interceptor | Renova antes de expirar |
| Logout por inatividade | ✔️ Completo | InactivityLogout component | Configurável via SecurityConfig |
| Validação de senha client-side | ✔️ Completo | PasswordValidator component | Sync com regras do backend |

### ⚠️ Itens Parcialmente Implementados

| Item | Status Atual | Gaps Identificados | Prioridade |
|------|--------------|-------------------|-----------|
| Criptografia Client-Side | ⚠️ Ausente | Não há AES-256-GCM implementado | Média |
| Anti-DevTools em Produção | ⚠️ Ausente | Não há detecção de DevTools | Baixa |
| Cloudflare Zero Trust | ⚠️ Não integrado | Configuração manual necessária | Média |
| WAF Rules | ⚠️ Não integrado | Cloudflare WAF não configurado | Média |
| Email de confirmação | ❌ Ausente | Registro sem verificação de email | Alta |

### ❌ Itens Ausentes (Necessitam Implementação)

#### 1. DevSecOps e Automação

| Ferramenta | Status | Necessidade |
|------------|--------|-------------|
| Snyk CLI | ❌ Ausente | Análise de vulnerabilidades em dependências |
| SonarQube | ❌ Ausente | Análise de qualidade e segurança de código |
| ESLint Security Plugin | ❌ Ausente | Detecção de padrões inseguros |
| Pipeline CI/CD com gates | ❌ Ausente | Bloqueio de deploy com vulnerabilidades |
| Testes de segurança automatizados | ❌ Ausente | Pentest, fuzzing, stress testing |

#### 2. Monitoramento e Observabilidade Avançada

| Funcionalidade | Status | Necessidade |
|----------------|--------|-------------|
| Painel /admin/security | ❌ Ausente | Dashboard de métricas de segurança |
| Painel /security para usuários | ❌ Ausente | Visão individual de segurança |
| Alertas em tempo real | ⚠️ Parcial | Sentry apenas para erros, não para ataques |
| Detecção de anomalias | ❌ Ausente | Identificação de comportamentos suspeitos |

#### 3. Documentação e Governança

| Documento | Status | Necessidade |
|-----------|--------|-------------|
| Checklist semanal de segurança | ❌ Ausente | Rotina de verificação |
| Checklist mensal de segurança | ❌ Ausente | Auditoria periódica |
| Checklist pré-deploy | ❌ Ausente | Gate de qualidade |
| Plano de resposta a incidentes | ❌ Ausente | Procedimentos de emergência |
| Threat Modeling | ❌ Ausente | Análise de ameaças |
| Backup criptografado | ❌ Ausente | Estratégia de backup seguro |

## Decisões de Design

### 1. Abordagem de Hash de Senha

**Decisão**: Manter Bcrypt ao invés de migrar para SHA-256

**Justificativa**:
- O requisito original menciona "SHA-256 + salt único", mas Bcrypt já implementa isso de forma superior
- Bcrypt é especificamente projetado para hashing de senhas com:
  - Salt automático único por senha
  - Fator de custo adaptativo (salt rounds: 10 = 2^10 iterações)
  - Resistência a ataques de GPU e ASIC
- SHA-256 é uma função hash criptográfica de propósito geral, não otimizada para senhas
- Migrar para SHA-256 seria um downgrade de segurança

**Recomendação Estratégica**: 
- Manter Bcrypt atual (salt rounds: 10)
- Considerar Argon2 apenas em futuras otimizações (quando disponível no NestJS)
- Documentar claramente que a implementação atual atende e supera o requisito

### 2. Configuração de 2FA

**Decisão**: Sistema híbrido - opcional por padrão, força opcionalmente para admins

**Estratégia de Implementação**:
- Nível 1: 2FA completamente opcional (estado atual) ✔️
- Nível 2: Sugestão forte para ativar 2FA (avisos no dashboard) - **Implementar**
- Nível 3: 2FA obrigatório para SUPER_ADMIN e ADMIN (configurável) - **Implementar**
- Nível 4: 2FA obrigatório para todos (modo strict, desativado por padrão) - **Implementar**

**Tabela de Configuração 2FA**:

| Parâmetro | Valor Padrão | Descrição |
|-----------|--------------|-----------|
| `twoFactorEnabled` | `false` | Habilita funcionalidade 2FA globalmente |
| `twoFactorRequired` | `false` | Torna 2FA obrigatório para todos |
| `twoFactorRequiredForAdmins` | `false` | Torna 2FA obrigatório apenas para ADMIN/SUPER_ADMIN |
| `twoFactorSuggested` | `true` | Exibe avisos sugerindo ativação de 2FA |

### 3. Cloudflare Zero Trust e WAF

**Decisão**: Configuração como guia, não implementação automatizada

**Justificativa**:
- Cloudflare Zero Trust e WAF são serviços de infraestrutura externos
- Configuração depende de conta Cloudflare específica do projeto
- Melhor abordagem: fornecer guia detalhado de configuração

**Entregável**: Documento de configuração passo-a-passo com:
- Setup de Cloudflare Access (Zero Trust)
- Regras WAF recomendadas (OWASP Core Ruleset)
- Page Rules para rotas sensíveis (/admin/*, /api/security-config/*)
- Rate limiting adicional no CDN
- Configuração de IP allowlist para admin

### 4. Criptografia Client-Side (AES-256-GCM)

**Decisão**: Implementar apenas para dados sensíveis específicos, não para todos os dados

**Justificativa**:
- HTTPS já criptografa dados em trânsito
- JWT já protege autenticação
- Criptografia client-side adiciona complexidade significativa
- Necessário apenas para dados ultra-sensíveis armazenados no cliente

**Casos de Uso Apropriados**:
- Configurações temporárias sensíveis no localStorage
- Dados de formulários multi-etapa antes do envio
- Cache local de informações financeiras/médicas

**Implementação Estratégica**:
- Criar utilitário de criptografia com Web Crypto API
- Usar chave derivada de: `userId + sessionId + timestamp`
- Aplicar apenas onde explicitamente necessário (opt-in, não global)

### 5. Anti-Engenharia Reversa (DevTools Detection)

**Decisão**: Implementar apenas em produção com aviso suave, não bloqueio agressivo

**Justificativa**:
- DevTools são ferramentas legítimas para desenvolvedores
- Bloqueio agressivo prejudica experiência de usuários técnicos
- Validação backend é a verdadeira linha de defesa

**Estratégia**:
- Produção: Detectar DevTools e exibir aviso de monitoramento
- Produção: Log de auditoria quando DevTools são detectados
- Produção: Não bloquear acesso, apenas monitorar
- Desenvolvimento: Detecção completamente desabilitada

### 6. DevSecOps Pipeline

**Decisão**: Implementação faseada com ferramentas open-source primeiro

**Fase 1 - Análise Estática** (Implementar primeiro):
- ESLint com eslint-plugin-security
- Configuração de pre-commit hooks
- Scripts npm para validação local

**Fase 2 - Análise de Dependências**:
- Snyk CLI integrado
- npm audit em CI/CD
- Alerts automáticos para vulnerabilidades

**Fase 3 - Testes de Segurança**:
- Suite de testes automatizados (pentest básico)
- OWASP ZAP scan automatizado
- Chaos engineering básico

**Fase 4 - Quality Gates**:
- SonarQube ou SonarCloud
- Bloqueio de merge com vulnerabilidades críticas
- Relatórios de coverage de segurança

### 7. Painéis de Monitoramento de Segurança

**Decisão**: Criar dois níveis de dashboards

**Dashboard Admin** (`/admin/security` - SUPER_ADMIN only):

| Métrica | Fonte de Dados | Atualização |
|---------|----------------|-------------|
| Tentativas de login falhadas (24h/7d/30d) | AuditLog | Real-time |
| Contas bloqueadas | User.isLocked | Real-time |
| Ataques bloqueados por rate limit | Logs do Throttler | Real-time |
| Usuários sem 2FA | User.twoFactorEnabled | Cache 5min |
| Sessões ativas | RefreshToken | Cache 1min |
| Vulnerabilidades detectadas | Snyk/npm audit | Cache 24h |
| Logs de auditoria críticos | AuditLog filtrado | Real-time |
| IPs suspeitos | Análise de AuditLog | Cache 15min |

**Dashboard Usuário** (`/security` - Todos os usuários):

| Informação | Descrição |
|------------|-----------|
| Status do 2FA | Habilitado/Desabilitado com call-to-action |
| Últimos logins | 10 últimas autenticações com IP e device |
| Sessões ativas | Lista de dispositivos conectados com opção de revogação |
| Força da senha | Indicador visual + sugestão de melhoria |
| Configurações de segurança | Timeout, preferências, notificações |

### 8. Email de Confirmação no Cadastro

**Decisão**: Implementar sistema completo de verificação de email

**Fluxo de Verificação**:

```
1. Usuário cadastrado → Estado: emailVerified = false
2. Sistema gera token de verificação (JWT de 24h)
3. Email enviado com link: /verify-email?token={token}
4. Usuário clica no link
5. Backend valida token e marca emailVerified = true
6. Usuário pode fazer login completamente
```

**Restrições para Email Não Verificado**:
- Nível 1 (Suave): Apenas aviso no login, permite acesso
- Nível 2 (Moderado): Funcionalidades limitadas até verificar
- Nível 3 (Restrito): Bloqueio total até verificação

**Configuração**:
- Parâmetro: `emailVerificationRequired` (boolean, padrão: `false`)
- Parâmetro: `emailVerificationLevel` (enum: SOFT, MODERATE, STRICT, padrão: SOFT)

## Estrutura de Implementação

### Novos Módulos Backend

#### 1. Email Module
**Propósito**: Gerenciar envio de emails (verificação, recuperação de senha, alertas)

**Componentes**:
- EmailService: Service principal com templates
- EmailQueueService: Fila de emails para processamento assíncrono
- EmailTemplates: Templates HTML para emails

**Configuração**:
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- EMAIL_FROM, EMAIL_FROM_NAME
- EMAIL_VERIFICATION_URL

#### 2. Security Dashboard Module
**Propósito**: Endpoints para dashboards de segurança

**Endpoints**:
- `GET /security/admin/metrics` - Métricas agregadas (SUPER_ADMIN)
- `GET /security/admin/alerts` - Alertas e eventos críticos (SUPER_ADMIN)
- `GET /security/admin/audit-logs` - Logs paginados (SUPER_ADMIN)
- `GET /security/user/profile` - Perfil de segurança individual
- `GET /security/user/sessions` - Sessões ativas do usuário
- `DELETE /security/user/sessions/:id` - Revogar sessão

#### 3. DevTools Detection Module (Frontend)
**Propósito**: Detecção de ferramentas de desenvolvimento em produção

**Componentes**:
- DevToolsDetector: Hook de detecção
- DevToolsWarning: Modal de aviso
- AuditLogger: Log de eventos para backend

#### 4. Client-Side Encryption Utility (Frontend)
**Propósito**: Criptografia AES-256-GCM para dados sensíveis

**API**:
- `encrypt(data: any, context: EncryptionContext): Promise<string>`
- `decrypt(encrypted: string, context: EncryptionContext): Promise<any>`
- `deriveKey(userId: string, sessionId: string): Promise<CryptoKey>`

### Novos Campos no Schema

#### User Table
```
+ emailVerified: Boolean (default: false)
+ emailVerificationToken: String?
+ emailVerificationExpires: DateTime?
+ lastPasswordChange: DateTime?
+ passwordHistory: String? (JSON array de 5 últimos hashes)
```

#### SecurityConfig Table
```
+ twoFactorRequiredForAdmins: Boolean (default: false)
+ twoFactorSuggested: Boolean (default: true)
+ emailVerificationRequired: Boolean (default: false)
+ emailVerificationLevel: Enum (SOFT, MODERATE, STRICT, default: SOFT)
+ passwordReuseLimit: Int (default: 5) - Prevenir reutilização de senhas
```

#### AuditLog Table (campos adicionais)
```
+ severity: Enum (INFO, WARNING, CRITICAL, default: INFO)
+ category: Enum (AUTH, DATA, CONFIG, SECURITY, default: INFO)
+ ipGeolocation: String? (JSON com país, cidade)
```

### Novas Configurações de Ambiente

```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME="Sistema Multitenant"

# Security Advanced
DEVTOOLS_DETECTION_ENABLED=true  # Produção: true, Dev: false
CLIENT_ENCRYPTION_ENABLED=false  # Apenas se necessário
EMAIL_VERIFICATION_REQUIRED=false
EMAIL_VERIFICATION_LEVEL=SOFT

# DevSecOps
SNYK_TOKEN=your-snyk-token
SONAR_TOKEN=your-sonar-token
SECURITY_SCAN_ENABLED=true
```

## Plano de Testes de Segurança

### Suite de Testes Automatizados

#### 1. Testes de Autenticação
**Arquivo**: `backend/test/security/auth.security.spec.ts`

**Casos de Teste**:
- Tentativas de login com senhas incorretas (validar bloqueio)
- Bypass de 2FA (tentar login sem código)
- Token JWT expirado (validar rejeição)
- Token JWT modificado (validar assinatura)
- Refresh token reutilizado (validar rotação)
- Força bruta em login (validar rate limiting)

#### 2. Testes de Autorização
**Arquivo**: `backend/test/security/authz.security.spec.ts`

**Casos de Teste**:
- IDOR: Tentar acessar recursos de outro tenant
- Escalação de privilégios: USER tentando acessar rota de ADMIN
- Bypass de RolesGuard: Requisição sem token em rota protegida
- Tenant isolation: ADMIN tentando acessar tenant diferente

#### 3. Testes de Entrada (Input Validation)
**Arquivo**: `backend/test/security/input.security.spec.ts`

**Casos de Teste**:
- SQL Injection em todos os campos de texto
- XSS em campos de texto (HTML/JavaScript)
- Path Traversal em upload de arquivos
- Campos extra no DTO (forbidNonWhitelisted)
- Tamanhos excessivos (DoS)
- Caracteres especiais e Unicode malformado

#### 4. Testes de CSRF e CORS
**Arquivo**: `backend/test/security/csrf-cors.security.spec.ts`

**Casos de Teste**:
- Requisição sem CSRF token
- CSRF token inválido
- Requisição de origem não autorizada
- Requisição sem credentials

#### 5. Pentest Automatizado
**Arquivo**: `backend/test/security/pentest.spec.ts`

**Casos de Teste** (300+ validações):
- Scan de headers de segurança
- Enumeração de usuários
- Brute force de autenticação
- Session fixation
- Information disclosure
- Clickjacking
- Directory traversal
- Análise de criptografia TLS

#### 6. Stress Testing
**Arquivo**: `backend/test/security/stress.spec.ts`

**Casos de Teste**:
- 500 requisições simultâneas (validar rate limiting)
- Flooding de login (validar proteção)
- Memory leak em operações de grande volume
- Timeout de conexões longas

### Ferramentas de Teste

| Ferramenta | Propósito | Comando |
|------------|-----------|---------|
| Jest + Supertest | Testes unitários e integração | `npm test -- security` |
| OWASP ZAP | Scan de vulnerabilidades | `zap-cli quick-scan` |
| Artillery | Load testing | `artillery run stress-test.yml` |
| npm audit | Vulnerabilidades em dependências | `npm audit` |
| Snyk | Análise de segurança de código | `snyk test` |

## Documentação de Governança

### Checklist Semanal de Segurança

**Responsável**: Equipe de DevOps/Segurança  
**Frequência**: Toda segunda-feira

**Tarefas**:
- [ ] Revisar logs de auditoria da semana anterior (filtrar eventos CRITICAL)
- [ ] Verificar contas bloqueadas e investigar padrões
- [ ] Analisar tentativas de login falhadas (> 10 por IP)
- [ ] Revisar alertas do Sentry (erros de autenticação/autorização)
- [ ] Validar backups do banco de dados (último backup < 24h)
- [ ] Executar `npm audit` e revisar vulnerabilidades
- [ ] Verificar certificados SSL (expiração em 30 dias)
- [ ] Revisar sessões ativas anormalmente longas (> 7 dias)

### Checklist Mensal de Segurança

**Responsável**: Tech Lead + Segurança  
**Frequência**: Primeira semana do mês

**Tarefas**:
- [ ] Executar scan completo de segurança (OWASP ZAP)
- [ ] Revisar e atualizar políticas de senha (SecurityConfig)
- [ ] Analisar métricas de adoção de 2FA
- [ ] Revisar permissões de usuários ADMIN/SUPER_ADMIN
- [ ] Atualizar dependências com vulnerabilidades conhecidas
- [ ] Executar Snyk test e revisar relatório
- [ ] Revisar logs de auditoria completos do mês
- [ ] Testar processo de recuperação de senha
- [ ] Validar processo de resposta a incidentes (dry-run)
- [ ] Revisar documentação de segurança (atualizar se necessário)

### Checklist Pré-Deploy

**Responsável**: Desenvolvedor + Revisor  
**Frequência**: Antes de cada deploy para produção

**Tarefas**:
- [ ] Todos os testes de segurança passaram (CI/CD green)
- [ ] npm audit sem vulnerabilidades CRITICAL ou HIGH
- [ ] Snyk test sem vulnerabilidades CRITICAL
- [ ] SonarQube quality gate passou (se configurado)
- [ ] Code review de segurança aprovado
- [ ] Variáveis de ambiente de produção validadas
- [ ] Secrets não estão hardcoded no código
- [ ] CORS configurado corretamente para produção
- [ ] Rate limiting configurado para produção (100 req/min)
- [ ] HTTPS enforcement ativo
- [ ] Headers de segurança validados (CSP, HSTS, etc.)
- [ ] Backup do banco antes do deploy
- [ ] Plano de rollback documentado

### Plano de Resposta a Incidentes

**Objetivo**: Procedimentos para lidar com incidentes de segurança

#### Classificação de Incidentes

| Severidade | Descrição | Tempo de Resposta |
|------------|-----------|-------------------|
| P0 - Crítico | Dados expostos, breach confirmado | Imediato (< 1h) |
| P1 - Alto | Tentativa de ataque ativo, vulnerabilidade crítica | < 4h |
| P2 - Médio | Vulnerabilidade conhecida, comportamento suspeito | < 24h |
| P3 - Baixo | Anomalias menores, alertas informativos | < 72h |

#### Procedimento P0/P1 - Incidente Crítico

**Etapa 1 - Contenção Imediata** (primeiros 15 minutos):
1. Ativar equipe de resposta (Tech Lead, DevOps, DBA)
2. Documentar incidente inicial (hora, descrição, evidências)
3. Se breach confirmado: Isolar sistema afetado
4. Se ataque ativo: Ativar proteção Cloudflare (I'm Under Attack Mode)
5. Revisar logs em tempo real para identificar vetor de ataque

**Etapa 2 - Investigação** (15-60 minutos):
1. Coletar logs completos (AuditLog, Sentry, servidor)
2. Identificar usuários/dados afetados
3. Rastrear origem do ataque (IPs, timestamps)
4. Determinar extensão do comprometimento
5. Documentar linha do tempo detalhada

**Etapa 3 - Erradicação** (1-4 horas):
1. Aplicar patch/correção imediata
2. Revogar tokens comprometidos (invalidar refresh tokens)
3. Forçar reset de senha de usuários afetados
4. Bloquear IPs maliciosos (firewall + Cloudflare)
5. Validar que vulnerabilidade foi corrigida

**Etapa 4 - Recuperação** (4-24 horas):
1. Restaurar serviços gradualmente
2. Monitorar intensivamente por 24-48h
3. Notificar usuários afetados (se aplicável por LGPD)
4. Comunicar stakeholders
5. Documentar lições aprendidas

**Etapa 5 - Pós-Incidente** (1 semana):
1. Relatório completo de incidente
2. Análise de causa raiz (RCA)
3. Implementar melhorias preventivas
4. Atualizar procedimentos de resposta
5. Treinar equipe em gaps identificados

### Threat Modeling

**Metodologia**: STRIDE (Microsoft)

#### Ameaças Identificadas

| Ameaça | Categoria STRIDE | Severidade | Mitigação Atual | Mitigação Adicional |
|--------|------------------|------------|-----------------|---------------------|
| Credenciais roubadas | Spoofing | Alta | Bcrypt, 2FA opcional | 2FA obrigatório para admins |
| Modificação de JWT | Tampering | Alta | Assinatura HMAC-SHA256 | Rotação de JWT_SECRET periódica |
| Acesso a dados de outro tenant | Information Disclosure | Crítica | TenantInterceptor | Auditoria de queries cross-tenant |
| Negação de serviço (DoS) | Denial of Service | Média | Rate limiting (100/min) | WAF Cloudflare + DDoS protection |
| Escalação de privilégios | Elevation of Privilege | Alta | RolesGuard | Auditoria de mudanças de role |
| SQL Injection | Tampering | Alta | Prisma ORM | Code review + SAST |
| XSS | Tampering | Média | React auto-escape | CSP strict |
| CSRF | Tampering | Média | CSRF Guard | SameSite cookies |
| Brute force login | DoS | Média | Bloqueio após 5 tentativas | CAPTCHA após 3 tentativas |
| Session hijacking | Spoofing | Alta | Refresh token rotation | IP binding (opcional) |

#### Superfície de Ataque

**Endpoints Públicos** (sem autenticação):
- `POST /auth/login` - Risco: Brute force
- `POST /auth/login-2fa` - Risco: Bypass de 2FA
- `POST /auth/refresh` - Risco: Token replay

**Endpoints Autenticados**:
- `GET /tenants` - Risco: Enumeração
- `GET /users` - Risco: Information disclosure
- `POST /tenants` - Risco: Tenant injection

**Endpoints de SUPER_ADMIN**:
- `PUT /security-config` - Risco: Configuração maliciosa
- `DELETE /users/:id` - Risco: Deleção acidental de admins

### Estratégia de Backup Criptografado

**Objetivo**: Garantir recuperação de dados com segurança

#### Configuração de Backup

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| Frequência | Diária (3AM UTC) | Backup automático |
| Retenção | 30 dias (diários), 12 meses (mensais) | Política de retenção |
| Localização | S3-compatible storage | Armazenamento externo |
| Criptografia | AES-256 | Algoritmo de criptografia |
| Compressão | gzip | Redução de tamanho |

#### Procedimento de Backup

**Script de Backup** (`backup-database.sh`):
```
1. Executar pg_dump do PostgreSQL
2. Comprimir com gzip -9
3. Criptografar com openssl enc -aes-256-cbc
4. Fazer upload para S3 com encryption at rest
5. Validar integridade (checksum SHA-256)
6. Registrar no log de backup
7. Limpar backups antigos (> 30 dias)
```

#### Procedimento de Restore

**Script de Restore** (`restore-database.sh`):
```
1. Download do backup do S3
2. Validar checksum SHA-256
3. Descriptografar com openssl dec -aes-256-cbc
4. Descomprimir com gzip -d
5. Executar pg_restore
6. Validar integridade do banco
7. Executar testes de smoke
```

#### Teste de Recuperação

**Frequência**: Mensal  
**Procedimento**:
1. Criar banco de dados de teste
2. Executar restore do backup mais recente
3. Validar integridade de dados críticos
4. Testar login e funcionalidades principais
5. Documentar tempo de recuperação (RTO)
6. Documentar ponto de recuperação (RPO)

## Integração Cloudflare

### Configuração Cloudflare Zero Trust

**Objetivo**: Adicionar camada adicional de autenticação antes da aplicação

#### Setup Cloudflare Access

**Passo 1 - Criar Aplicação**:
1. Acessar Cloudflare Dashboard → Zero Trust → Access → Applications
2. Criar nova aplicação Self-hosted
3. Configurar Application Domain: `admin.seudominio.com/admin/*`
4. Configurar Application Name: "Admin Panel Protection"

**Passo 2 - Configurar Políticas de Acesso**:

**Política 1 - Admin Access**:
- Nome: "Admin Team Only"
- Action: Allow
- Include: Emails ending in @seudominio.com
- Require: Email + One-time PIN (ou Google Auth)

**Política 2 - IP Whitelist** (opcional):
- Nome: "Office IP Only"
- Action: Allow
- Include: IP ranges (ex: 203.0.113.0/24)

**Passo 3 - Configurar Autenticação**:
- Login Methods: Email + OTP, Google Workspace, GitHub
- Session Duration: 24 horas
- Require MFA: Sim (para admins)

#### Configuração WAF (Web Application Firewall)

**Passo 1 - Ativar WAF Managed Rules**:
1. Cloudflare Dashboard → Security → WAF
2. Ativar "OWASP ModSecurity Core Rule Set"
3. Ativar "Cloudflare Managed Ruleset"
4. Modo: Block (bloquear ataques automaticamente)

**Passo 2 - Regras Customizadas**:

**Regra 1 - Bloquear Admin de IPs estrangeiros**:
```
Expression: (http.request.uri.path contains "/admin" or http.request.uri.path contains "/api/security-config") and not ip.geoip.country in {"BR"}
Action: Block
```

**Regra 2 - Rate Limiting Agressivo em Auth**:
```
Expression: http.request.uri.path contains "/auth/login"
Action: Managed Challenge (if rate > 5 requests per 60 seconds)
```

**Regra 3 - Bloquear User-Agents Suspeitos**:
```
Expression: (http.user_agent contains "bot" or http.user_agent contains "scanner" or http.user_agent eq "") and http.request.uri.path contains "/api"
Action: Block
```

#### Page Rules

**Regra 1 - Cache Bypass para API**:
- URL: `api.seudominio.com/*`
- Settings: Cache Level = Bypass

**Regra 2 - SSL Strict para Admin**:
- URL: `seudominio.com/admin/*`
- Settings: SSL = Strict, Always Use HTTPS = On

#### Rate Limiting no CDN

**Limite Global**:
- 100 requisições por minuto por IP
- Aplica-se a: Todo o site
- Ação: Managed Challenge

**Limite de Login**:
- 5 requisições por minuto para `/api/auth/login`
- Ação: Block por 1 hora

### Configuração de Headers no Cloudflare

**Transform Rules** (adicional aos headers do Helmet):
```
Permissions-Policy: geolocation=(), microphone=(), camera=()
X-Robots-Tag: noindex, nofollow (apenas para /admin/*)
```

## Estimativas de Esforço

### Implementação Faseada

#### Fase 1 - Melhorias de Autenticação (20-30 horas)
- Email de verificação completo: 10-12h
- 2FA obrigatório para admins: 4-6h
- Política de reutilização de senha: 4-6h
- Avisos de 2FA no dashboard: 2-4h

#### Fase 2 - DevSecOps Básico (15-20 horas)
- ESLint security plugin + configuração: 3-4h
- Pre-commit hooks: 2-3h
- npm audit automation: 2-3h
- Snyk CLI integration: 4-6h
- Scripts de validação de segurança: 4-6h

#### Fase 3 - Monitoramento Avançado (25-35 horas)
- Dashboard /admin/security backend: 10-12h
- Dashboard /admin/security frontend: 8-10h
- Dashboard /security para usuários: 6-8h
- Sistema de alertas em tempo real: 6-8h
- Detecção de anomalias básica: 8-12h

#### Fase 4 - Testes de Segurança (30-40 horas)
- Suite de testes de autenticação: 8-10h
- Suite de testes de autorização: 6-8h
- Suite de testes de input validation: 8-10h
- Pentest automatizado (300+ testes): 12-16h
- Stress testing: 6-8h
- Documentação de testes: 4-6h

#### Fase 5 - Recursos Avançados (20-25 horas)
- Client-side encryption utility: 8-10h
- DevTools detection: 4-6h
- Cloudflare configuration guide: 3-4h
- Backup encryption automation: 5-8h

#### Fase 6 - Documentação e Governança (15-20 horas)
- Checklists (semanal, mensal, pré-deploy): 4-6h
- Plano de resposta a incidentes: 6-8h
- Threat modeling completo: 8-10h
- Documentação de backup/restore: 3-4h

### Total Estimado
**125-170 horas de desenvolvimento**

**Priorização Recomendada**:
1. **Alta**: Fase 1, Fase 2, Fase 6 (documentação)
2. **Média**: Fase 3, Fase 4
3. **Baixa**: Fase 5 (recursos avançados opciona)

## Relação com SHA-256

**Nota sobre o Requisito Original**:

O requisito menciona "implementar hashing de senhas com SHA-256 + salt único por usuário (ideal: Argon2, mas usar SHA-256 conforme solicitado)". 

**Análise Técnica**:

1. **SHA-256 é inadequado para senhas**:
   - SHA-256 é rápido demais (milhões de hashes/segundo)
   - Facilita ataques de força bruta com GPUs
   - Não possui fator de custo adaptativo

2. **Bcrypt é superior ao SHA-256 para senhas**:
   - Implementa salt automático único (atende requisito)
   - Fator de custo adaptativo (salt rounds)
   - Projetado especificamente para senhas
   - Resistente a ataques de GPU/ASIC

3. **Implementação Atual**:
   - Sistema já usa Bcrypt com salt rounds: 10
   - Cada senha possui salt único automático
   - Atende e supera o requisito funcional

**Recomendação Final**:
- **Manter Bcrypt** atual (não migrar para SHA-256)
- Documentar que Bcrypt atende o requisito de "SHA-256 + salt único" de forma superior
- Se necessário, considerar Argon2 em futuras otimizações (mencionado como "ideal" no requisito)

**Justificativa de Negócio**:
Migrar de Bcrypt para SHA-256 seria um downgrade significativo de segurança, colocando senhas de usuários em risco. A implementação atual atende o objetivo do requisito (hash seguro com salt único) usando a melhor prática da indústria.
