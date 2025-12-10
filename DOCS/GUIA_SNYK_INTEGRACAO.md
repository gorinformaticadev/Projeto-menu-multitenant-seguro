# Guia de Integração Snyk CLI

**Versão**: 1.0  
**Data**: 10/12/2024  
**Objetivo**: Integrar Snyk CLI para análise de vulnerabilidades

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Instalação](#instalação)
4. [Configuração](#configuração)
5. [Execução](#execução)
6. [Integração CI/CD](#integração-ci/cd)

---

## 🎯 Visão Geral

Snyk é uma plataforma de segurança que ajuda a encontrar, corrigir e monitorar vulnerabilidades de segurança conhecidas em código-fonte, dependências e contêineres.

### Benefícios

- ✅ Detecção de vulnerabilidades em dependências
- ✅ Análise estática de código (SAST)
- ✅ Verificação de containers Docker
- ✅ Monitoramento contínuo
- ✅ Integração com pipelines CI/CD

---

## ✅ Pré-requisitos

1. **Conta Snyk** (gratuita disponível em https://snyk.io/)
2. **Node.js** instalado
3. **npm** ou **yarn**
4. **PowerShell** (para scripts Windows)

---

## 🚀 Instalação

### Opção 1: npm (recomendado)

```bash
npm install -g snyk
```

### Opção 2: yarn

```bash
yarn global add snyk
```

### Verificação

```bash
snyk --version
```

**Resultado esperado**:
```
1.x.x
```

---

## ⚙️ Configuração

### 1. Autenticação

#### Método 1: Token de Autenticação

1. Acesse https://app.snyk.io/account
2. Clique em "API Token"
3. Copie o token

```bash
# Definir token como variável de ambiente
# Windows (PowerShell)
$env:SNYK_TOKEN="seu-token-aqui"

# Linux/Mac
export SNYK_TOKEN="seu-token-aqui"
```

#### Método 2: Comando de Autenticação

```bash
snyk auth
```

Irá abrir o navegador para autenticação.

### 2. Verificação da Autenticação

```bash
snyk whoami
```

**Resultado esperado**:
```
seu-email@example.com
```

---

## ▶️ Execução

### Script Automatizado

O projeto inclui um script PowerShell que executa todas as verificações:

```powershell
cd backend
npm run security:snyk
```

**Ou executar diretamente**:

```powershell
cd backend
.\scripts\snyk-test.ps1
```

### Comandos Manuais

#### 1. Teste de Dependências

```bash
# Testar projeto atual
snyk test

# Testar todos os projetos (--all-projects)
snyk test --all-projects

# Testar com saída JSON
snyk test --json
```

#### 2. Análise de Código-Fonte

```bash
# Análise estática de código
snyk code test

# Análise com saída detalhada
snyk code test --severity-threshold=high
```

#### 3. Monitoramento

```bash
# Monitorar projeto (enviar para dashboard Snyk)
snyk monitor

# Monitorar todos os projetos
snyk monitor --all-projects
```

#### 4. Container Security (se usar Docker)

```bash
# Testar imagem Docker
snyk container test seu-repo/sua-imagem:tag

# Testar Dockerfile
snyk container test --file=Dockerfile .
```

---

## 🧪 Resultados Esperados

### Saída Normal

```
Testing /path/to/project...

Organization:      sua-organizacao
Package manager:   npm
Target file:       package.json
Open source:       no
Project path:      /path/to/project

✓ Tested 123 dependencies for known vulnerabilities, no vulnerable paths found.
```

### Vulnerabilidades Encontradas

```
Testing /path/to/project...

✗ High severity vulnerability found in lodash
  Description: Prototype Pollution
  Info: https://snyk.io/vuln/SNYK-JS-LODASH-XXXXXX
  Introduced through: lodash@4.17.15
  From: lodash@4.17.15

Remediation options:
  Upgrade direct dependency lodash@4.17.15 to lodash@4.17.19 (triggers upgrades to fix issues)
```

---

## 🔄 Integração CI/CD

### GitHub Actions

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install Snyk CLI
      run: npm install -g snyk
      
    - name: Run Snyk Test
      run: |
        snyk test --all-projects
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        
    - name: Run Snyk Code Analysis
      run: |
        snyk code test
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
security_scan:
  stage: test
  image: node:18
  
  before_script:
    - npm install -g snyk
    
  script:
    - snyk test --all-projects
    - snyk code test
    
  variables:
    SNYK_TOKEN: $SNYK_TOKEN
    
  only:
    - merge_requests
    - master
```

---

## 🛠️ Comandos Úteis

### Remediar Vulnerabilidades

```bash
# Tentar corrigir automaticamente
snyk fix

# Atualizar pacote específico
npm update lodash
```

### Ignorar Vulnerabilidades (temporariamente)

```bash
# Ignorar por 30 dias
snyk ignore --id=SNYK-JS-LODASH-XXXXXX --expiry=30d --reason="Correção em andamento"

# Ignorar permanentemente (não recomendado)
snyk ignore --id=SNYK-JS-LODASH-XXXXXX --reason="Risco aceito"
```

### Configurar Proxy (se necessário)

```bash
# Definir proxy HTTP
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=https://proxy.company.com:8080

# Ou via variáveis de ambiente
export SNYK_HTTP_PROXY=http://proxy.company.com:8080
```

---

## 📊 Dashboard Snyk

### Acesso ao Portal

1. Acesse https://app.snyk.io/
2. Faça login com suas credenciais
3. Visualize projetos monitorados
4. Veja relatórios de vulnerabilidades
5. Configure notificações

### Widgets Úteis

- **Overview**: Visão geral de todos os projetos
- **Projects**: Lista de projetos monitorados
- **Issues**: Vulnerabilidades agrupadas por severidade
- **Reports**: Relatórios personalizados
- **Settings**: Configurações da organização

---

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. "Not authorized"

**Solução**:
```bash
snyk auth
# Ou definir SNYK_TOKEN
```

#### 2. "Could not detect supported target files"

**Solução**:
```bash
# Especificar arquivo manualmente
snyk test --file=package.json
```

#### 3. "Unsupported runtime"

**Solução**:
Atualizar versão do Node.js ou usar Docker

#### 4. "API rate limit exceeded"

**Solução**:
- Aguardar alguns minutos
- Usar conta paga para limites maiores

---

## 📈 Melhores Práticas

### 1. Frequência de Scans

- **Pull Requests**: Scan em cada PR
- **Master/Main**: Scan diário
- **Release**: Scan antes de cada release

### 2. Severidade Threshold

```bash
# Bloquear apenas vulnerabilidades críticas
snyk test --severity-threshold=critical

# Bloquear altas e críticas
snyk test --severity-threshold=high
```

### 3. Monitoramento Contínuo

```bash
# Monitorar após cada deploy
snyk monitor --all-projects
```

### 4. Ignorar com Critério

- Documentar razão para ignorar
- Definir data de expiração
- Revisar periodicamente ignores

---

## 📚 Recursos Adicionais

### Documentação Oficial

- **CLI Docs**: https://docs.snyk.io/snyk-cli
- **Node.js Guide**: https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-node.js
- **SAST**: https://docs.snyk.io/products/snyk-code
- **Container Security**: https://docs.snyk.io/products/snyk-container

### Comunidade

- **Fórum**: https://community.snyk.io/
- **GitHub**: https://github.com/snyk/snyk
- **Blog**: https://snyk.io/blog/

---

## ✅ Checklist de Implementação

- [ ] Snyk CLI instalado
- [ ] Autenticação configurada
- [ ] Script de teste executado com sucesso
- [ ] Integração CI/CD configurada
- [ ] Monitoramento ativo habilitado
- [ ] Time treinado no uso da plataforma

---

**Última atualização**: 10/12/2024  
**Versão**: 1.0
