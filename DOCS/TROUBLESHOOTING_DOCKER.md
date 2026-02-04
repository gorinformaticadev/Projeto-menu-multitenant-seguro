# 🛠️ Troubleshooting - Problemas Comuns com Docker

## Problemas Encontrados e Soluções

### 1. Erro "500 Internal Server Error" no Docker Desktop

**Sintomas:**
```
request returned 500 Internal Server Error for API route and version
```

**Soluções:**
1. **Reiniciar Docker Desktop**
   ```powershell
   # Feche o Docker Desktop completamente
   # Aguarde 10 segundos
   # Reabra o Docker Desktop
   ```

2. **Resetar Docker Desktop**
   ```powershell
   # No Docker Desktop:
   # Settings → Reset → Reset to factory defaults
   ```

3. **Verificar recursos do sistema**
   ```powershell
   # Certifique-se de ter memória suficiente disponível
   # Pelo menos 4GB RAM livres recomendados
   ```

### 2. Warnings sobre versão obsoleta do Compose

**Sintomas:**
```
the attribute `version` is obsolete, it will be ignored
```

**Solução:**
Este warning é apenas informativo e não afeta o funcionamento. Os scripts já estão adaptados para funcionar mesmo com este warning.

### 3. Problemas de Permissões no Windows

**Sintomas:**
```
Access denied ou Permission denied
```

**Soluções:**
1. **Executar PowerShell como Administrador**
2. **Verificar políticas de execução:**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### 4. Portas Ocupadas

**Sintomas:**
```
port is already allocated
```

**Soluções:**
1. **Verificar processos nas portas:**
   ```powershell
   netstat -ano | findstr :5000
   netstat -ano | findstr :4000
   ```

2. **Matar processos ocupando portas:**
   ```powershell
   # Substitua PID pelo número do processo encontrado
   taskkill /PID <PID> /F
   ```

3. **Usar portas diferentes:**
   ```powershell
   .\install-system.ps1 -FrontendPort 3000 -BackendPort 3001
   ```

## 🔄 Reiniciar Instalação Completa

Se encontrar problemas persistentes:

```powershell
# 1. Parar todos os containers
docker-compose -f docker-compose.install.yml down

# 2. Remover volumes (ATENÇÃO: isso apaga os dados!)
docker volume prune

# 3. Remover arquivos gerados
Remove-Item .env
Remove-Item docker-compose.install.yml

# 4. Reiniciar Docker Desktop
# (Fechar e reabrir)

# 5. Executar instalação novamente
.\install-system.ps1
```

## 📊 Verificação Manual do Sistema

### Verificar se containers estão rodando:
```powershell
docker ps -a
```

### Verificar logs de um container específico:
```powershell
docker logs multitenant-db-install
docker logs multitenant-backend-install
docker logs multitenant-frontend-install
```

### Testar conectividade manualmente:
```powershell
# Testar frontend
curl http://localhost:5000

# Testar backend
curl http://localhost:4000/health

# Testar banco de dados
docker exec -it multitenant-db-install pg_isready -U multitenant_user
```

## 🎯 Solução Alternativa - Instalação Manual

Se o script automático continuar com problemas:

1. **Iniciar containers manualmente:**
   ```powershell
   docker-compose -f docker-compose.install.yml up -d
   ```

2. **Verificar status:**
   ```powershell
   docker-compose -f docker-compose.install.yml ps
   ```

3. **Inicializar banco de dados:**
   ```powershell
   docker-compose -f docker-compose.install.yml exec backend npx prisma migrate deploy
   docker-compose -f docker-compose.install.yml exec backend npx ts-node prisma/seed.ts
   ```

## 🆘 Suporte Adicional

Se os problemas persistirem:

1. **Verificar versões:**
   ```powershell
   docker --version
   docker-compose --version
   ```

2. **Consultar logs do Docker Desktop:**
   - Docker Desktop → Troubleshoot → View logs

3. **Atualizar Docker Desktop:**
   - Baixar a última versão em: https://www.docker.com/products/docker-desktop/

---

**Importante:** O script de instalação foi testado e funciona corretamente quando o Docker Desktop está operando normalmente. Os erros apresentados são típicos de problemas temporários do Docker Desktop que podem ser resolvidos com reinicialização.# 🛠️ Troubleshooting - Problemas Comuns com Docker

## Problemas Encontrados e Soluções

### 1. Erro "500 Internal Server Error" no Docker Desktop

**Sintomas:**
```
request returned 500 Internal Server Error for API route and version
```

**Soluções:**
1. **Reiniciar Docker Desktop**
   ```powershell
   # Feche o Docker Desktop completamente
   # Aguarde 10 segundos
   # Reabra o Docker Desktop
   ```

2. **Resetar Docker Desktop**
   ```powershell
   # No Docker Desktop:
   # Settings → Reset → Reset to factory defaults
   ```

3. **Verificar recursos do sistema**
   ```powershell
   # Certifique-se de ter memória suficiente disponível
   # Pelo menos 4GB RAM livres recomendados
   ```

### 2. Warnings sobre versão obsoleta do Compose

**Sintomas:**
```
the attribute `version` is obsolete, it will be ignored
```

**Solução:**
Este warning é apenas informativo e não afeta o funcionamento. Os scripts já estão adaptados para funcionar mesmo com este warning.

### 3. Problemas de Permissões no Windows

**Sintomas:**
```
Access denied ou Permission denied
```

**Soluções:**
1. **Executar PowerShell como Administrador**
2. **Verificar políticas de execução:**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### 4. Portas Ocupadas

**Sintomas:**
```
port is already allocated
```

**Soluções:**
1. **Verificar processos nas portas:**
   ```powershell
   netstat -ano | findstr :5000
   netstat -ano | findstr :4000
   ```

2. **Matar processos ocupando portas:**
   ```powershell
   # Substitua PID pelo número do processo encontrado
   taskkill /PID <PID> /F
   ```

3. **Usar portas diferentes:**
   ```powershell
   .\install-system.ps1 -FrontendPort 3000 -BackendPort 3001
   ```

## 🔄 Reiniciar Instalação Completa

Se encontrar problemas persistentes:

```powershell
# 1. Parar todos os containers
docker-compose -f docker-compose.install.yml down

# 2. Remover volumes (ATENÇÃO: isso apaga os dados!)
docker volume prune

# 3. Remover arquivos gerados
Remove-Item .env
Remove-Item docker-compose.install.yml

# 4. Reiniciar Docker Desktop
# (Fechar e reabrir)

# 5. Executar instalação novamente
.\install-system.ps1
```

## 📊 Verificação Manual do Sistema

### Verificar se containers estão rodando:
```powershell
docker ps -a
```

### Verificar logs de um container específico:
```powershell
docker logs multitenant-db-install
docker logs multitenant-backend-install
docker logs multitenant-frontend-install
```

### Testar conectividade manualmente:
```powershell
# Testar frontend
curl http://localhost:5000

# Testar backend
curl http://localhost:4000/health

# Testar banco de dados
docker exec -it multitenant-db-install pg_isready -U multitenant_user
```

## 🎯 Solução Alternativa - Instalação Manual

Se o script automático continuar com problemas:

1. **Iniciar containers manualmente:**
   ```powershell
   docker-compose -f docker-compose.install.yml up -d
   ```

2. **Verificar status:**
   ```powershell
   docker-compose -f docker-compose.install.yml ps
   ```

3. **Inicializar banco de dados:**
   ```powershell
   docker-compose -f docker-compose.install.yml exec backend npx prisma migrate deploy
   docker-compose -f docker-compose.install.yml exec backend npx ts-node prisma/seed.ts
   ```

## 🆘 Suporte Adicional

Se os problemas persistirem:

1. **Verificar versões:**
   ```powershell
   docker --version
   docker-compose --version
   ```

2. **Consultar logs do Docker Desktop:**
   - Docker Desktop → Troubleshoot → View logs

3. **Atualizar Docker Desktop:**
   - Baixar a última versão em: https://www.docker.com/products/docker-desktop/

---

**Importante:** O script de instalação foi testado e funciona corretamente quando o Docker Desktop está operando normalmente. Os erros apresentados são típicos de problemas temporários do Docker Desktop que podem ser resolvidos com reinicialização.