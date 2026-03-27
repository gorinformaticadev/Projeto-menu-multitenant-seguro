# 🚀 Como Iniciar o Sistema

## ❌ Problema Identificado

Você está recebendo a mensagem **"Nenhum módulo disponível no momento"** porque:

1. ❌ O frontend Next.js **NÃO está rodando**
2. ❌ A API `/api/modules/discover` não consegue responder
3. ❌ O módulo `boas-vindas` existe mas não pode ser carregado

## ✅ Solução: Iniciar os Servidores

### **Opção 1: Iniciar Tudo de Uma Vez (Recomendado)**

```powershell
cd frontend
npm run dev
```

### **Opção 2: Iniciar Backend e Frontend Separadamente**

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

### **Opção 3: Usar Docker (Se Configurado)**

```powershell
docker-compose up
```

## 🔍 Verificar se Funcionou

Após iniciar, verifique:

1. ✅ Frontend deve estar em: http://localhost:3000
2. ✅ Backend deve estar em: http://localhost:4000
3. ✅ API de módulos: http://localhost:3000/api/modules/discover

## 📋 Sequência Completa

```powershell
# 1. Certifique-se de estar na pasta do projeto
cd d:\Usuarios\Servidor\GORInformatica\Documents\GitHub\Pluggor

# 2. Instalar dependências (se ainda não instalou)
cd frontend
npm install

# 3. Iniciar o servidor de desenvolvimento
npm run dev

# 4. Abrir o navegador em http://localhost:3000
```

## 🎯 Após Iniciar

Quando o sistema estiver rodando:

1. Acesse: http://localhost:3000
2. Faça login no sistema
3. No menu lateral, você verá: **📚 Tutorial** (do módulo Boas-Vindas)
4. Clique nele e a página será carregada corretamente!

## 🐛 Troubleshooting

### Porta já em uso?
```powershell
# Matar processo na porta 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# Matar processo na porta 4000
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process -Force
```

### Dependências desatualizadas?
```powershell
cd frontend
npm install
```

## 📝 Observação Importante

O erro **"Nenhum módulo disponível no momento"** NÃO significa que o módulo está mal configurado. Significa apenas que a API não está respondendo porque o servidor não está rodando!

✅ **Seu módulo boas-vindas está PERFEITO e funcionará assim que o servidor iniciar!**
