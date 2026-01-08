# Solução de Problemas - Email em Desenvolvimento

## 🚨 Problema: Emails não estão chegando

### Causas Mais Comuns

#### 1. **Credenciais Incorretas (90% dos casos)**

**Gmail:**
- ❌ **ERRO COMUM:** Usar senha normal da conta
- ✅ **SOLUÇÃO:** Usar "Senha de app"

**Passos para Gmail:**
1. Acesse [Google Account Security](https://myaccount.google.com/security)
2. Ative "Verificação em duas etapas"
3. Acesse [App Passwords](https://myaccount.google.com/apppasswords)
4. Gere uma senha para "Email"
5. Use essa senha de 16 caracteres no campo "Senha SMTP"

**Outlook/Hotmail:**
- ❌ **ERRO COMUM:** SMTP desabilitado
- ✅ **SOLUÇÃO:** Habilitar SMTP ou usar OAuth2

#### 2. **Configuração de Servidor Incorreta**

**Gmail:**
```
Host: smtp.gmail.com
Porta: 587 (STARTTLS) ou 465 (SSL)
Criptografia: STARTTLS ou SSL
```

**Outlook:**
```
Host: smtp-mail.outlook.com
Porta: 587
Criptografia: STARTTLS
```

#### 3. **Firewall/Antivírus Bloqueando**
- Portas SMTP (587, 465) podem estar bloqueadas
- Antivírus pode estar interceptando conexões

#### 4. **Ambiente de Desenvolvimento**
- Alguns provedores bloqueiam conexões de IPs residenciais
- Rate limiting mais restritivo

## 🔧 Ferramentas de Diagnóstico

### 1. Script de Diagnóstico Automático
```powershell
.\diagnostico-email.ps1
```

### 2. Script de Configuração Rápida
```powershell
# Para Gmail
.\configurar-email-dev.ps1 -EmailUsuario "seu@gmail.com" -SenhaEmail "senha-de-app" -Provedor "Gmail"

# Para Outlook
.\configurar-email-dev.ps1 -EmailUsuario "seu@outlook.com" -SenhaEmail "sua-senha" -Provedor "Outlook"
```

### 3. Teste Manual via Interface
1. Acesse `http://localhost:3000/configuracoes/seguranca`
2. Configure o provedor
3. Use o botão "Testar Conexão"

## 🐛 Debug Detalhado

### Logs do Backend
O serviço de email agora fornece logs detalhados:

```
[EmailService] Iniciando teste de email para: teste@exemplo.com
[EmailService] Configuração SMTP: smtp.gmail.com:587 (STARTTLS)
[EmailService] Criando transporter temporário para teste...
[EmailService] Verificando conexão SMTP...
[EmailService] ✅ Conexão SMTP verificada com sucesso
[EmailService] Enviando email de teste...
[EmailService] ✅ Email de teste enviado com sucesso para: teste@exemplo.com
```

### Códigos de Erro Comuns

| Código | Descrição | Solução |
|--------|-----------|---------|
| `EAUTH` | Falha na autenticação | Verificar usuário/senha |
| `ECONNECTION` | Falha na conexão | Verificar host/porta |
| `ETIMEDOUT` | Timeout | Verificar firewall |
| `ENOTFOUND` | Host não encontrado | Verificar nome do servidor |

## ✅ Checklist de Verificação

### Configuração Básica
- [ ] Provedor de email configurado na interface
- [ ] Usuário SMTP preenchido
- [ ] Senha SMTP preenchida (senha de app para Gmail)
- [ ] Configuração salva com sucesso

### Credenciais Gmail
- [ ] Autenticação de 2 fatores ativada
- [ ] Senha de app gerada
- [ ] Usando senha de app (não senha normal)

### Credenciais Outlook
- [ ] SMTP habilitado na conta
- [ ] Usando credenciais corretas
- [ ] Conta não bloqueada

### Rede e Firewall
- [ ] Porta 587 ou 465 não bloqueada
- [ ] Antivírus não interferindo
- [ ] Conexão com internet estável

### Teste
- [ ] Teste de conexão passou
- [ ] Email de teste enviado
- [ ] Email recebido na caixa de entrada

## 🔍 Comandos de Teste Manual

### Teste de Conectividade (PowerShell)
```powershell
# Testar se a porta está acessível
Test-NetConnection -ComputerName smtp.gmail.com -Port 587

# Resultado esperado: TcpTestSucceeded = True
```

### Teste via Telnet
```cmd
telnet smtp.gmail.com 587
```

## 📋 Configurações Recomendadas por Provedor

### Gmail (Recomendado para Dev)
```json
{
  "providerName": "Gmail (STARTTLS - Port 587)",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "encryption": "STARTTLS",
  "authMethod": "LOGIN"
}
```

**Credenciais:**
- Usuário: `seu-email@gmail.com`
- Senha: `senha-de-app-16-caracteres`

### Outlook/Hotmail
```json
{
  "providerName": "Hotmail/Outlook (STARTTLS - Port 587)",
  "smtpHost": "smtp-mail.outlook.com",
  "smtpPort": 587,
  "encryption": "STARTTLS",
  "authMethod": "LOGIN"
}
```

### Titan Mail
```json
{
  "providerName": "Titan Mail (SSL/TLS - Port 465)",
  "smtpHost": "smtp.titan.email",
  "smtpPort": 465,
  "encryption": "SSL",
  "authMethod": "LOGIN"
}
```

## 🚀 Solução Rápida (Gmail)

1. **Configure Gmail:**
   ```powershell
   .\configurar-email-dev.ps1 -EmailUsuario "seu@gmail.com" -SenhaEmail "sua-senha-de-app" -Provedor "Gmail"
   ```

2. **Teste imediatamente:**
   - O script já faz o teste automaticamente
   - Verifique sua caixa de entrada

3. **Se não funcionar:**
   - Verifique se usou senha de app (não senha normal)
   - Confirme que 2FA está ativo
   - Tente gerar nova senha de app

## 📞 Suporte Adicional

### Logs Detalhados
Para ativar logs mais detalhados, defina no `.env`:
```env
LOG_LEVEL="debug"
NODE_ENV="development"
```

### Teste com Ferramenta Externa
Use ferramentas como [SMTP Tester](https://www.smtper.net/) para validar credenciais independentemente.

### Alternativas para Desenvolvimento
- **Mailtrap:** Serviço de email para desenvolvimento
- **MailHog:** Servidor SMTP local para testes
- **Ethereal Email:** Emails de teste temporários

## 🎯 Resumo da Solução

**Para 90% dos casos (Gmail):**
1. Ative 2FA na conta Google
2. Gere senha de app em https://myaccount.google.com/apppasswords
3. Use a senha de app no campo "Senha SMTP"
4. Teste a configuração

**Se ainda não funcionar:**
1. Execute `.\diagnostico-email.ps1`
2. Verifique os logs do backend
3. Confirme que não há bloqueio de firewall
4. Tente com outro provedor de email