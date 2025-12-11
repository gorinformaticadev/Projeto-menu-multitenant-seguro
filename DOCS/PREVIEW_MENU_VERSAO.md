# 👀 Preview - Menu com Versão do Sistema

## 🎨 Como Ficará o Menu

### Para SUPER_ADMIN:
```
┌─────────────────────────────────┐
│ 👤 João Silva                   │
│    joao@empresa.com             │
├─────────────────────────────────┤
│ 👤 Meu Perfil                   │ ← Clicável
│ ℹ️  Versão do Sistema            │ ← Clicável (vai para updates)
│    v1.2.3                      │
├─────────────────────────────────┤
│ 🚪 Sair                         │
└─────────────────────────────────┘
```

### Para ADMIN/USER/CLIENT:
```
┌─────────────────────────────────┐
│ 👤 Maria Santos                 │
│    maria@empresa.com            │
├─────────────────────────────────┤
│ 👤 Meu Perfil                   │ ← Clicável
│ ℹ️  Versão do Sistema            │ ← Apenas informativo
│    v1.2.3                      │
├─────────────────────────────────┤
│ 🚪 Sair                         │
└─────────────────────────────────┘
```

## 🎯 Comportamentos

### SUPER_ADMIN:
- **Hover na versão**: Fundo cinza claro + cursor pointer
- **Clique na versão**: Redireciona para `/configuracoes/sistema/updates`
- **Tooltip**: "Clique para gerenciar atualizações"

### Outros Usuários:
- **Hover na versão**: Sem efeito
- **Clique na versão**: Sem ação
- **Visual**: Texto em cinza (não interativo)

## 📱 Responsividade

### Desktop:
```
Menu completo com:
- Avatar + Nome + Email
- Meu Perfil (clicável)
- Versão v1.2.3 (condicional)
- Sair (clicável)
```

### Mobile:
```
Menu compacto com:
- Avatar + Nome
- Meu Perfil
- Versão v1.2.3
- Sair
```

## 🔄 Estados da Versão

### Carregando:
```
ℹ️ Versão do Sistema
   v1.0.0 (padrão)
```

### API Disponível:
```
ℹ️ Versão do Sistema
   v1.2.3 (da API)
```

### Fallback Package.json:
```
ℹ️ Versão do Sistema
   v1.1.0 (do package.json)
```

### Erro/Padrão:
```
ℹ️ Versão do Sistema
   v1.0.0 (padrão)
```

## 🎨 Estilos CSS

### SUPER_ADMIN (Clicável):
```css
.version-link {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  text-decoration: none;
  transition: background-color 0.2s;
}

.version-link:hover {
  background-color: #f3f4f6;
}
```

### Outros (Informativo):
```css
.version-info {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
  cursor: default;
}
```

## 🔍 Detalhes Visuais

### Ícone:
- **Tipo**: Info (ℹ️)
- **Tamanho**: 16x16px
- **Cor**: Cinza (#6b7280)

### Texto:
- **Label**: "Versão do Sistema"
- **Tamanho**: 12px
- **Cor**: Cinza (#6b7280)

### Versão:
- **Formato**: "v1.2.3"
- **Font**: Monospace
- **Tamanho**: 12px
- **Peso**: Medium
- **Cor**: Cinza escuro (#374151)

## 🎯 Fluxo de Interação

### Para SUPER_ADMIN:
1. **Clica no avatar** → Menu abre
2. **Vê "Versão do Sistema v1.2.3"** → Hover mostra que é clicável
3. **Clica na versão** → Vai para Sistema de Updates
4. **Pode gerenciar atualizações** → Versão pode mudar

### Para outros usuários:
1. **Clica no avatar** → Menu abre
2. **Vê "Versão do Sistema v1.2.3"** → Apenas informativo
3. **Não pode clicar** → Sem ação disponível
4. **Informação útil** → Sabe qual versão está usando

## ✅ Resultado Visual

O menu agora mostra claramente a versão do sistema, integrada de forma natural entre "Meu Perfil" e "Sair". Para SUPER_ADMIN, oferece acesso rápido ao sistema de updates, enquanto para outros usuários fornece informação útil sobre a versão atual do sistema.