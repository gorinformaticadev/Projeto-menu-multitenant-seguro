# 🔧 Correção - Decorators Duplicados

## 🐛 Problema

O autofix do IDE duplicou os decorators `@Public()` e `@SkipThrottle()`, causando erro 429 persistente.

---

## ❌ Antes (Errado)

```typescript
@Public()
@SkipThrottle()
@Public()           // ❌ Duplicado
@SkipThrottle()     // ❌ Duplicado
@Get('public/master-logo')
async getMasterLogo() {
  return this.tenantsService.getMasterLogo();
}
```

---

## ✅ Depois (Correto)

```typescript
@Public()
@SkipThrottle()
@Get('public/master-logo')
async getMasterLogo() {
  return this.tenantsService.getMasterLogo();
}
```

---

## 📁 Arquivo Corrigido

- ✅ `backend/src/tenants/tenants.controller.ts`

---

## 🚀 Próximo Passo

**REINICIAR O BACKEND NOVAMENTE:**

```bash
# Parar (Ctrl+C)
cd backend
npm run start:dev
```

**Depois:**
1. Aguardar 1 minuto (rate limit resetar)
2. Recarregar frontend (F5)
3. Verificar console - sem erros 429

---

**Status:** ✅ CORRIGIDO  
**Causa:** Autofix duplicou decorators  
**Solução:** Removidos duplicados  
**Ação:** Reiniciar backend

