# Checklist de Segurança Pré-Deploy

**Responsável**: Equipe de DevOps/Segurança  
**Frequência**: Antes de cada deploy em staging/produção  
**Tempo estimado**: 30-45 minutos

## 📋 Verificações Pré-Deploy

### 1. Análise de Código
- [ ] Executar ESLint com regras de segurança:
  ```bash
  cd backend
  npm run lint
  ```
- [ ] Verificar warnings e errors do ESLint
- [ ] Revisar código modificado para vulnerabilidades
- [ ] Confirmar sanitização de inputs
- [ ] Validar tratamento de erros
- [ ] Verificar logs de informações sensíveis

### 2. Testes de Segurança
- [ ] Executar testes de penetração automatizados
- [ ] Verificar cobertura de testes de segurança
- [ ] Testar endpoints de autenticação
- [ ] Validar proteção contra brute force
- [ ] Confirmar prevenção de IDOR
- [ ] Testar validação de permissões

### 3. Análise de Dependências
- [ ] Executar npm audit:
  ```bash
  npm audit --audit-level=moderate
  ```
- [ ] Atualizar dependências com vulnerabilidades HIGH/CRITICAL
- [ ] Verificar dependências descontinuadas
- [ ] Confirmar integridade dos pacotes
- [ ] Validar chain of trust das dependências
- [ ] Documentar dependências de risco

### 4. Configurações de Ambiente
- [ ] Verificar variáveis de ambiente sensíveis
- [ ] Confirmar uso de secrets management
- [ ] Validar configurações de CORS
- [ ] Revisar headers de segurança HTTP
- [ ] Verificar rate limiting configurado
- [ ] Confirmar HTTPS obrigatório

### 5. Banco de Dados
- [ ] Revisar queries para SQL Injection
- [ ] Verificar índices de performance
- [ ] Confirmar constraints de unicidade
- [ ] Validar permissões de usuário do banco
- [ ] Testar backup/restauração
- [ ] Verificar conexão SSL

### 6. Autenticação e Autorização
- [ ] Testar fluxo completo de login
- [ ] Validar proteção de rotas
- [ ] Confirmar funcionamento do 2FA
- [ ] Verificar expiração de tokens
- [ ] Testar refresh tokens
- [ ] Validar roles e permissões

### 7. Monitoramento
- [ ] Confirmar integração com Sentry
- [ ] Verificar logs de auditoria
- [ ] Validar métricas de performance
- [ ] Testar alertas configurados
- [ ] Confirmar tracing distribuído
- [ ] Verificar health checks

### 8. Infraestrutura
- [ ] Revisar configurações de firewall
- [ ] Validar balanceamento de carga
- [ ] Confirmar auto-scaling configurado
- [ ] Verificar backup automático
- [ ] Testar disaster recovery
- [ ] Validar certificados SSL

## 📊 Registro de Verificação

### Deploy #[NÚMERO] - [DATA]

| Categoria | Status | Observações | Ações Tomadas |
|-----------|--------|-------------|---------------|
| Análise de Código | ☐ |  |  |
| Testes de Segurança | ☐ |  |  |
| Dependências | ☐ |  |  |
| Configurações | ☐ |  |  |
| Banco de Dados | ☐ |  |  |
| Autenticação | ☐ |  |  |
| Monitoramento | ☐ |  |  |
| Infraestrutura | ☐ |  |  |

**Responsável pela Verificação**: [Nome]  
**Data da Verificação**: [DD/MM/YYYY]  
**Tempo Gasto**: [XX minutos]

## 🚨 Bloqueios de Deploy

### Critérios que BLOQUEIAM deploy:
- [ ] Vulnerabilidades CRITICAL não resolvidas
- [ ] npm audit com falhas HIGH+
- [ ] ESLint errors não corrigidos
- [ ] Testes de segurança falhando
- [ ] Configurações de segurança ausentes
- [ ] Falhas em health checks críticos

### Critérios que ALERTAM antes do deploy:
- [ ] Vulnerabilidades MODERATE não resolvidas
- [ ] npm audit com warnings
- [ ] ESLint warnings significativos
- [ ] Baixa cobertura de testes
- [ ] Configurações padrão em produção
- [ ] Sem backup recente

## ✅ Checklist de Liberação

Antes de aprovar o deploy:
- [ ] Todas as verificações pré-deploy realizadas
- [ ] Nenhum bloqueio de deploy identificado
- [ ] Todos os warnings críticos resolvidos
- [ ] Equipe de segurança consultada (se necessário)
- [ ] Plano de rollback disponível
- [ ] Documentação atualizada

## 📌 Procedimento Padrão

### 1. Staging
1. Executar checklist completo
2. Deploy em ambiente de staging
3. Testes de fumaça
4. Validação de funcionalidades
5. Monitorar por 24 horas

### 2. Produção
1. Confirmar sucesso em staging
2. Agendar janela de manutenibilidade
3. Notificar stakeholders
4. Deploy em produção
5. Monitorar intensivamente
6. Validar funcionalidades críticas

## 🆘 Em Caso de Problemas

### Rollback Imediato:
1. Parar deploy em andamento
2. Restaurar versão anterior
3. Validar sistema restaurado
4. Investigar causa raiz
5. Documentar incidente
6. Comunicar equipe

### Escalação:
- **Problemas de Segurança**: [Contato de Segurança]
- **Problemas de Infra**: [Contato de DevOps]
- **Problemas de Código**: [Tech Lead]
- **Problemas Críticos**: [Gerente de Projeto]

## 📞 Contatos

- **Segurança**: [Nome] - [Email] - [Telefone]
- **DevOps**: [Nome] - [Email] - [Telefone]
- **Tech Lead**: [Nome] - [Email] - [Telefone]
- **Gerente**: [Nome] - [Email] - [Telefone]

---

**Última atualização**: 10/12/2024