# 🧪 Guia de Teste - FASE 1

## ⚡ Teste Rápido (2 minutos)

### 1️⃣ Iniciar o Backend
```bash
cd backend
npm run start:dev
```

**Aguarde até ver:**
```
🚀 Backend rodando em http://localhost:4000
🛡️  Headers de segurança ativados (Helmet)
```

### 2️⃣ Executar Script de Teste

**Windows (PowerShell):**
```powershell
cd backend
.\test-headers.ps1
```

**Linux/Mac:**
```bash
cd backend
chmod +x test-headers.sh
./test-headers.sh
```

### 3️⃣ Resultado Esperado

Você deve ver:
```
✅ Content-Security-Policy (CSP)
✅ Strict-Transport-Security (HSTS)
✅ X-Content-Type-Options
✅ X-Frame-Options
✅ X-DNS-Prefetch-Control
✅ Referrer-Policy
✅ X-Powered-By oculto

Headers de segurança encontrados: 6/6

🎉 SUCESSO! Todos os headers de segurança estão configurados!
✅ FASE 1 CONCLUÍDA
```

---

## 🌐 Teste no Navegador (3 minutos)

### 1️⃣ Iniciar Frontend
```bash
cd frontend
npm run dev
```

### 2️⃣ Abrir Navegador
- Acesse: http://localhost:5000
- Abra DevTools (F12)
- Vá em **Network**

### 3️⃣ Fazer Login
- Email: `admin@example.com`
- Senha: (sua senha)

### 4️⃣ Verificar Headers
- Clique na requisição de login
- Vá em **Headers** → **Response Headers**
- Verifique se aparecem os headers de segurança

### 5️⃣ Verificar Console
- Vá em **Console**
- **NÃO deve haver erros de CSP**
- Se houver, me avise para ajustarmos

---

## ✅ Checklist Final

Marque cada item após testar:

- [ ] Backend inicia sem erros
- [ ] Mensagem "🛡️ Headers de segurança ativados" aparece
- [ ] Script de teste mostra 6/6 headers
- [ ] Frontend carrega normalmente
- [ ] Login funciona
- [ ] Imagens carregam
- [ ] Não há erros no console do navegador
- [ ] Headers aparecem no DevTools

---

## 🎯 Após Validar

Se todos os itens estiverem ✅, a **FASE 1 está concluída!**

**Me avise para avançarmos para a FASE 2: Rate Limiting**

---

## 🆘 Problemas?

### Backend não inicia
```bash
cd backend
npm install
npm run start:dev
```

### Script não executa (Windows)
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\test-headers.ps1
```

### Erro de CSP no console
Me avise qual erro aparece para ajustarmos as diretivas.

### Headers não aparecem
Verifique se o Helmet foi instalado:
```bash
cd backend
npm list helmet
```

Se não estiver instalado:
```bash
npm install helmet
```
