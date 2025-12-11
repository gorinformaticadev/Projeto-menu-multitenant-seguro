# Configurações da Plataforma

## Resumo da Implementação

Implementei um sistema completo para gerenciar as configurações básicas da plataforma (nome, email informativo e telefone de contato) que podem ser acessadas em qualquer lugar do sistema através de constantes/variáveis.

## ✅ Funcionalidades Implementadas

### 1. **Campos no Banco de Dados**
- `platformName` - Nome da plataforma (padrão: "Sistema Multitenant")
- `platformEmail` - Email informativo (padrão: "contato@sistema.com")  
- `platformPhone` - Telefone de contato (padrão: "(11) 99999-9999")

### 2. **Backend (NestJS)**

#### Serviços
- `PlatformConfigService` - Gerencia configurações com cache
- `PlatformInitService` - Inicializa configurações na inicialização do app

#### Controllers
- `PlatformConfigController` - Endpoints para CRUD das configurações

#### Constantes Globais
```typescript
// Importar constantes
import { getPlatformName, getPlatformEmail, getPlatformPhone, PLATFORM } from '../common/constants/platform.constants';

// Uso assíncrono (recomendado)
const name = await getPlatformName();
const email = await getPlatformEmail();
const phone = await getPlatformPhone();

// Uso síncrono (usa cache ou padrão)
const name = PLATFORM.NAME;
const email = PLATFORM.EMAIL;
const phone = PLATFORM.PHONE;
```

### 3. **Frontend (React/Next.js)**

#### Hook Personalizado
```typescript
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

// Hook completo
const { config, loading, error, refreshConfig } = usePlatformConfig();

// Hooks específicos
const { platformName } = usePlatformName();
const { platformEmail } = usePlatformEmail();
const { platformPhone } = usePlatformPhone();
```

#### Componentes Prontos
```typescript
import PlatformInfo, { PlatformName, PlatformContact } from '@/components/PlatformInfo';

// Componente completo
<PlatformInfo showEmail={true} showPhone={true} />

// Apenas nome
<PlatformName />

// Informações de contato
<PlatformContact />
```

#### Contexto Global
```typescript
import { usePlatformConfigContext } from '@/contexts/PlatformConfigContext';

const { config, loading, error, refreshConfig } = usePlatformConfigContext();
```

## 🔧 Endpoints da API

### Configurações Completas
- `GET /platform-config` - Buscar todas as configurações
- `PUT /platform-config` - Atualizar configurações (SUPER_ADMIN)

### Endpoints Individuais (Públicos)
- `GET /platform-config/name` - Buscar apenas o nome
- `GET /platform-config/email` - Buscar apenas o email  
- `GET /platform-config/phone` - Buscar apenas o telefone

## 📱 Interface do Usuário

### Localização
`/configuracoes/seguranca` → Seção "Configurações da Plataforma"

### Campos
- **Nome da Plataforma** (obrigatório)
- **Email de Contato** (informativo)
- **Telefone de Contato** (informativo)

### Funcionalidades
- Preview em tempo real das configurações
- Validação de campos
- Salvamento automático no banco
- Atualização do título da página

## 🎯 Casos de Uso

### 1. **Emails do Sistema**
```typescript
// O serviço de email já usa automaticamente o nome da plataforma
const platformName = await getPlatformName();
// Email será enviado como: "Minha Plataforma <email@dominio.com>"
```

### 2. **Títulos e Cabeçalhos**
```typescript
// O título da página é atualizado automaticamente
// Componentes podem usar o nome dinamicamente
<h1>{platformName}</h1>
```

### 3. **Informações de Contato**
```typescript
// Exibir informações de contato em qualquer lugar
<PlatformContact />
// Ou acessar individualmente
const email = await getPlatformEmail();
const phone = await getPlatformPhone();
```

## 🔄 Cache e Performance

### Backend
- Cache automático com TTL de 5 minutos
- Inicialização na inicialização do app
- Fallback para valores padrão em caso de erro

### Frontend
- Cache no contexto global
- Atualização automática do título da página
- Hooks otimizados para re-renderização mínima

## 🧪 Testes

### Script de Teste Automático
```powershell
.\test-platform-config.ps1
```

### Teste Manual
1. Acesse `/configuracoes/seguranca`
2. Altere as configurações da plataforma
3. Salve as alterações
4. Verifique se o título da página mudou
5. Teste os componentes em outras páginas

## 📋 Estrutura de Arquivos

### Backend
```
backend/src/
├── security-config/
│   ├── platform-config.service.ts
│   ├── platform-config.controller.ts
│   └── dto/update-security-config.dto.ts (atualizado)
├── common/
│   ├── constants/platform.constants.ts
│   └── services/platform-init.service.ts
└── prisma/schema.prisma (atualizado)
```

### Frontend
```
frontend/src/
├── hooks/usePlatformConfig.ts
├── contexts/PlatformConfigContext.tsx
├── components/
│   ├── PlatformConfigSection.tsx
│   └── PlatformInfo.tsx
└── app/layout.tsx (atualizado)
```

## 🔒 Segurança

- Apenas SUPER_ADMIN pode alterar configurações
- Endpoints de leitura são públicos (para uso em templates)
- Validação de dados no backend
- Cache seguro com fallbacks

## 🚀 Próximos Passos

### Melhorias Futuras
1. **Histórico de Alterações** - Log de mudanças nas configurações
2. **Validação Avançada** - Validação de formato de email e telefone
3. **Temas Personalizados** - Cores e logos da plataforma
4. **Multi-idioma** - Configurações por idioma
5. **API Externa** - Webhook para notificar mudanças

### Integração com Outros Módulos
- **Email Templates** - Usar configurações em templates
- **Relatórios** - Incluir informações da plataforma
- **Auditoria** - Log de alterações nas configurações

## ✅ Verificação Final

- [x] Campos no banco de dados (platformName, platformEmail, platformPhone)
- [x] Serviços backend com cache
- [x] Endpoints REST completos
- [x] Constantes globais para uso em qualquer lugar
- [x] Hook React personalizado
- [x] Componentes prontos para uso
- [x] Interface de configuração
- [x] Contexto global no frontend
- [x] Atualização automática do título
- [x] Testes automatizados
- [x] Documentação completa

**Status: ✅ IMPLEMENTADO COM SUCESSO**

As configurações da plataforma estão prontas e podem ser usadas em qualquer lugar do sistema através das constantes e hooks fornecidos!