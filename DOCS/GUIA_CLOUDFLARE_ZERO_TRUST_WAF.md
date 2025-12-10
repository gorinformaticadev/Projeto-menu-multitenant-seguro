# Guia Completo: Cloudflare Zero Trust + WAF

**Versão**: 1.0  
**Data**: 10/12/2024  
**Objetivo**: Configurar camada adicional de segurança com Cloudflare  
**Nível**: Intermediário a Avançado

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Cloudflare Zero Trust](#cloudflare-zero-trust)
4. [WAF (Web Application Firewall)](#waf)
5. [Page Rules](#page-rules)
6. [Rate Limiting](#rate-limiting)
7. [Monitoramento](#monitoramento)

---

## 🎯 Visão Geral

### O que é Cloudflare Zero Trust?

Cloudflare Zero Trust (anteriormente Cloudflare Access) adiciona uma camada de autenticação **antes** que requisições cheguem ao seu servidor. Mesmo com credenciais válidas da aplicação, usuários precisam passar pela autenticação do Cloudflare primeiro.

### O que é WAF?

Web Application Firewall (WAF) analisa e filtra requisições HTTP/HTTPS em tempo real, bloqueando ataques como:
- SQL Injection
- XSS (Cross-Site Scripting)
- DDoS
- Bots maliciosos
- Exploits conhecidos

### Arquitetura de Segurança com Cloudflare

```
Internet
   ↓
Cloudflare Edge (CDN + Zero Trust + WAF)
   ↓ (somente requisições autenticadas e seguras)
Seu Servidor (NestJS + PostgreSQL)
```

---

## ✅ Pré-requisitos

1. **Domínio próprio** (ex: `seudominio.com`)
2. **Conta Cloudflare** (grátis ou paga)
3. **DNS apontando para Cloudflare** (nameservers configurados)
4. **Certificado SSL/TLS** (Cloudflare fornece grátis)

---

## 🔐 Cloudflare Zero Trust

### Passo 1: Ativar Cloudflare Zero Trust

1. Acessar: https://one.dash.cloudflare.com/
2. Selecionar sua conta
3. `Zero Trust` → `Settings` → `Authentication`
4. Configurar provedor de autenticação

### Passo 2: Configurar Provedor de Autenticação

#### Opção A: Email + OTP (One-Time PIN)

**Melhor para**: Pequenas equipes, fácil de configurar

1. `Authentication` → `Login methods` → `Add new`
2. Selecionar `One-time PIN`
3. Configurar domínios permitidos:
   ```
   @seudominio.com
   @gmail.com (se necessário)
   ```
4. Salvar

#### Opção B: Google Workspace

**Melhor para**: Empresas que já usam Google

1. `Login methods` → `Add new` → `Google`
2. Criar credenciais OAuth no Google Cloud:
   - https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID
   - Authorized redirect URIs: `https://seudominio.cloudflareaccess.com/cdn-cgi/access/callback`
3. Copiar Client ID e Client Secret
4. Colar no Cloudflare
5. Salvar

#### Opção C: GitHub

**Melhor para**: Equipes de desenvolvimento

1. `Login methods` → `Add new` → `GitHub`
2. Criar OAuth App no GitHub:
   - https://github.com/settings/developers
   - Authorization callback URL: `https://seudominio.cloudflareaccess.com/cdn-cgi/access/callback`
3. Copiar Client ID e Client Secret
4. Configurar no Cloudflare

### Passo 3: Criar Aplicação Protegida

#### Proteger Painel Administrativo

1. `Access` → `Applications` → `Add an application`
2. Selecionar `Self-hosted`
3. Configurações:
   ```
   Application name: Admin Panel
   Session duration: 24 hours
   Application domain: admin.seudominio.com
   Path: /admin/*
   ```

4. **Criar Política de Acesso**:

**Política 1: Equipe de Administração**
```
Name: Admin Team Only
Action: Allow
Include: 
  - Emails ending in @seudominio.com
  - Email: admin@seudominio.com
Require:
  - Login method: Email + OTP (ou Google)
```

**Política 2: IP Whitelist** (opcional, mais seguro)
```
Name: Office IP Only
Action: Allow
Include:
  - IP ranges: 203.0.113.0/24 (seu IP público)
Require:
  - Login method: Email + OTP
```

5. Salvar aplicação

#### Proteger Endpoints Críticos de API

**Aplicação 2: Security Config API**
```
Application name: Security Config API
Path: api.seudominio.com/security-config*
Session duration: 1 hour
```

**Política**:
```
Name: Admins Only
Action: Allow
Include: Emails in list
  - admin@seudominio.com
  - techlead@seudominio.com
```

### Passo 4: Testar Zero Trust

1. Acessar `https://admin.seudominio.com/admin/`
2. Deve redirecionar para tela de login do Cloudflare
3. Autenticar com email + OTP (ou Google)
4. Após autenticação, acessar aplicação normalmente

**Cookie de sessão**: `CF_Authorization`  
**Validade**: Configurada (ex: 24h)

### Configurações Avançadas de Zero Trust

#### Bypass para IPs Internos (opcional)

```
Policy name: Internal Network Bypass
Action: Bypass
Include: IP ranges
  - 10.0.0.0/8 (rede interna)
  - 192.168.0.0/16 (rede local)
```

#### MFA Obrigatório

```
Policy: Admin with MFA
Require:
  - Authentication method: Google
  - Require MFA: Yes
```

---

## 🛡️ WAF (Web Application Firewall)

### Passo 1: Ativar WAF Managed Rules

1. Cloudflare Dashboard → `Security` → `WAF`
2. `Managed rules` → `Deploy`
3. Ativar rulesets:
   - ✅ **Cloudflare Managed Ruleset** (essencial)
   - ✅ **OWASP ModSecurity Core Rule Set** (recomendado)
   - ✅ **Cloudflare Exposed Credentials Check**

### Passo 2: Configurar Sensibilidade

**Rulesets → Cloudflare Managed Ruleset → Configure**

| Categoria | Ação Recomendada | Descrição |
|-----------|------------------|-----------|
| SQLi (SQL Injection) | **Block** | Bloquear tentativas de SQL injection |
| XSS (Cross-Site Scripting) | **Block** | Bloquear scripts maliciosos |
| Command Injection | **Block** | Bloquear execução de comandos |
| Log4j Vulnerability | **Block** | Proteger contra Log4Shell |
| File Inclusion | **Block** | Prevenir LFI/RFI |
| Anomaly:Header | **Log** | Apenas logar headers anômalos |
| Anomaly:Content | **Challenge** | CAPTCHA para conteúdo suspeito |

### Passo 3: Criar Regras Customizadas

#### Regra 1: Bloquear Admin de Países Não Autorizados

```
Expression:
(http.request.uri.path contains "/admin" or http.request.uri.path contains "/api/security-config") 
and not ip.geoip.country in {"BR" "US"}

Action: Block
```

**Resultado**: Apenas Brasil e EUA podem acessar `/admin/`

#### Regra 2: Rate Limiting Agressivo em Auth

```
Expression:
http.request.uri.path eq "/auth/login"

Action: Managed Challenge
When incoming requests match:
  - Rate: 5 requests
  - Period: 60 seconds
  - By: IP address
```

**Resultado**: Após 5 tentativas de login em 60s, exige CAPTCHA

#### Regra 3: Bloquear User-Agents Suspeitos

```
Expression:
(
  http.user_agent contains "bot" or 
  http.user_agent contains "scanner" or 
  http.user_agent contains "curl" or
  http.user_agent eq ""
) and http.request.uri.path contains "/api"

Action: Block
```

**Exceção**: Whitelist para monitoramento legítimo
```
Add Exception:
(ip.src in {203.0.113.50}) # IP do monitoramento
```

#### Regra 4: Proteger contra Path Traversal

```
Expression:
http.request.uri.path contains "../" or 
http.request.uri.path contains "..%2f" or
http.request.uri.path contains "%2e%2e"

Action: Block
```

### Passo 4: Configurar Ações de Bloqueio

**Security → Settings → Security Level**:
- **High**: Mais agressivo, pode ter falsos positivos
- **Medium** (recomendado): Balanceado
- **Essentially Off**: Apenas regras customizadas

**Challenge Passage**:
- 30 minutes (recomendado)
- Usuários que passam no CAPTCHA não são desafiados novamente por 30min

---

## 📄 Page Rules

Page Rules permitem configurações específicas por URL.

### Regra 1: Cache Bypass para API

```
URL: api.seudominio.com/*
Settings:
  - Cache Level: Bypass
  - Security Level: High
```

**Motivo**: APIs devem retornar dados em tempo real, sem cache

### Regra 2: Forçar HTTPS em Admin

```
URL: seudominio.com/admin/*
Settings:
  - Always Use HTTPS: On
  - Security Level: High
  - Browser Integrity Check: On
```

### Regra 3: Cache Agressivo para Assets Estáticos

```
URL: seudominio.com/uploads/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 week
```

---

## 🚦 Rate Limiting

### Ativar Rate Limiting Global

1. `Security` → `WAF` → `Rate limiting rules`
2. Criar regra:

**Regra 1: Limite Global de API**
```
Rule name: Global API Limit
If incoming requests match:
  - Field: URI Path
  - Operator: starts with
  - Value: /api

When rate exceeds:
  - Requests: 100
  - Period: 60 seconds
  - By: IP Address

Then take action:
  - Block for 1 hour
```

**Regra 2: Limite Agressivo de Login**
```
Rule name: Login Rate Limit
If incoming requests match:
  - URI Path: equals /auth/login
  - Method: POST

When rate exceeds:
  - Requests: 5
  - Period: 60 seconds
  - By: IP Address

Then take action:
  - Managed Challenge (CAPTCHA)
  - Duration: 10 minutes
```

**Regra 3: Limite de Registro de Usuários**
```
Rule name: Signup Rate Limit
URI Path: equals /auth/signup
Requests: 3
Period: 3600 seconds (1 hora)
By: IP Address
Action: Block for 24 hours
```

---

## 📊 Monitoramento

### Logs de Firewall

1. `Analytics` → `Security` → `Events`
2. Filtrar por:
   - **Action**: Block, Challenge, JS Challenge
   - **Service**: WAF, Firewall Rules
   - **Country**: Países específicos
   - **IP**: Endereços suspeitos

### Métricas Importantes

**Diariamente**:
- Requisições bloqueadas (deve ser < 1% do total)
- Top 10 IPs bloqueados
- Top 10 países de origem de ataques

**Semanalmente**:
- Tendências de tráfego
- Novos padrões de ataque
- Eficácia das regras customizadas

### Alertas

**Configurar em**: `Notifications` → `Add`

**Alerta 1: Spike de Bloqueios**
```
Type: Traffic Anomalies
Condition: HTTP requests blocked > 100 in 5 minutes
Action: Email + Webhook
```

**Alerta 2: País Novo Detectado**
```
Type: Advanced Security Events
Condition: Requests from new country
Action: Email
```

### Logs Detalhados (Logpush)

**Plano Pro+**: Enviar logs para S3, Splunk, Datadog

```
Configuração:
Service: Logpush
Destination: S3 Bucket / Datadog
Fields: All (para análise completa)
```

---

## ✅ Checklist de Implementação

### Zero Trust
- [ ] Provedor de autenticação configurado (Email/Google/GitHub)
- [ ] Aplicação criada para `/admin/*`
- [ ] Política de acesso configurada (emails autorizados)
- [ ] Testado: acesso bloqueado sem autenticação
- [ ] Testado: acesso permitido após autenticação

### WAF
- [ ] Managed Rulesets ativados (Cloudflare + OWASP)
- [ ] Regra customizada: bloqueio de países
- [ ] Regra customizada: rate limiting em /auth/login
- [ ] Regra customizada: bloqueio de User-Agents suspeitos
- [ ] Sensibilidade configurada (Medium)

### Page Rules
- [ ] Cache bypass para /api/*
- [ ] Always HTTPS para /admin/*
- [ ] Cache para assets estáticos /uploads/*

### Rate Limiting
- [ ] Limite global de API (100 req/min)
- [ ] Limite de login (5 req/min)
- [ ] Limite de signup (3 req/hora)

### Monitoramento
- [ ] Dashboard de segurança configurado
- [ ] Alertas de spike de bloqueios
- [ ] Revisão semanal de logs

---

## 🎯 Cenários de Uso

### Cenário 1: Ataque DDoS

**Sintoma**: Tráfego anormal, servidor lento

**Ação no Cloudflare**:
1. `Security` → `DDoS` → Ativar "I'm Under Attack" Mode
2. Todos os visitantes passam por CAPTCHA
3. Análise de IPs atacantes
4. Criar regra de bloqueio para IPs/países específicos

### Cenário 2: Brute Force em Login

**Sintoma**: Múltiplas tentativas de login de mesmo IP

**Verificação**:
```
Analytics → Security → Events
Filter: URI Path = /auth/login, Action = Block
```

**Ação**:
- Se rate limit já ativo: Verificar se está funcionando
- Se não: Criar regra de rate limiting mais restritiva
- Adicionar IP à blocklist manual se persistir

### Cenário 3: Acesso Administrativo de IP Não Autorizado

**Sintoma**: Logs mostram acesso de país/IP estranho

**Ação**:
1. Verificar se é legítimo (admin viajando?)
2. Se não: Bloquear IP imediatamente
3. Forçar reset de senha do admin
4. Revisar logs de auditoria da aplicação

---

## 💰 Custos

| Plano | Preço | Recursos |
|-------|-------|----------|
| **Free** | $0/mês | WAF básico, Rate limiting limitado, Zero Trust (até 50 usuários) |
| **Pro** | $20/mês | WAF avançado, Page Rules ilimitadas, Logpush |
| **Business** | $200/mês | WAF customizável, SLA 99.95%, Suporte prioritário |
| **Enterprise** | Custom | WAF totalmente customizável, DDoS avançado |

**Recomendação**: Free para começar, Pro quando escalar

---

## 📞 Suporte

**Documentação Oficial**:
- Zero Trust: https://developers.cloudflare.com/cloudflare-one/
- WAF: https://developers.cloudflare.com/waf/
- Rate Limiting: https://developers.cloudflare.com/waf/rate-limiting-rules/

**Comunidade**:
- Fórum: https://community.cloudflare.com/
- Discord: https://discord.cloudflare.com/

---

**Última atualização**: 10/12/2024  
**Versão**: 1.0
