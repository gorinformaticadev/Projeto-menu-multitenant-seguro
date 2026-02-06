# Instruções para Forçar Atualização do Frontend

O problema de fuso horário foi corrigido no código, mas pode estar sendo causado por cache do browser ou do Next.js.

## Passos para resolver:

### 1. Limpar Cache do Browser
- **Chrome/Edge**: Pressione `Ctrl + Shift + R` (Windows) ou `Cmd + Shift + R` (Mac)
- **Firefox**: Pressione `Ctrl + F5` (Windows) ou `Cmd + Shift + R` (Mac)
- Ou abra DevTools (F12) > Network > marque "Disable cache"

### 2. Limpar Cache do Next.js
```bash
cd apps/frontend
rm -rf .next
pnpm run dev
```

### 3. Verificar se a correção foi aplicada
1. Abra DevTools (F12)
2. Vá para Sources
3. Navegue até: `apps/frontend/src/app/modules/agenda/components/EventCreationModal.tsx`
4. Procure pela linha ~152 e verifique se contém:
   ```typescript
   start_time: formatInTimeZone(startTime, timeZone, 'HH:mm'),
   ```
5. Se ainda estiver usando `format(new Date(...), 'HH:mm')`, o cache não foi limpo

### 4. Teste da Correção
1. Crie um evento às 14:00
2. Edite o evento (sem alterar a hora)
3. Salve o evento
4. Verifique se o horário permanece 14:00

### 5. Se o problema persistir
Execute este código no console do browser:
```javascript
// Verificar se formatInTimeZone está sendo usado
console.log('Verificando EventCreationModal...');
// Procure por "formatInTimeZone" no código fonte
```

## Arquivos Corrigidos
- ✅ `apps/frontend/src/app/modules/agenda/components/EventCreationModal.tsx`
- ✅ `module-agenda/frontend/components/EventCreationModal.tsx`

## O que foi alterado
- **Antes**: `format(new Date(event.startTime), 'HH:mm')` (dupla conversão)
- **Depois**: `formatInTimeZone(startTime, timeZone, 'HH:mm')` (conversão única e correta)