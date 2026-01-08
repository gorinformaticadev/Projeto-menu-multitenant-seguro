# Validador de CPF e CNPJ Reutilizável

## Descrição
Sistema completo de validação e formatação de CPF e CNPJ, implementado tanto no backend quanto no frontend, com componente reutilizável para formulários.

## Funcionalidades Implementadas

### 🔧 Backend

#### Validador (`backend/src/common/validators/cpf-cnpj.validator.ts`)
- ✅ **Validação de CPF**: Algoritmo completo com dígitos verificadores
- ✅ **Validação de CNPJ**: Algoritmo completo com dígitos verificadores  
- ✅ **Validação combinada**: Detecta automaticamente CPF ou CNPJ
- ✅ **Formatação**: Aplica máscaras automaticamente
- ✅ **Decorators**: `@IsValidCPF`, `@IsValidCNPJ`, `@IsValidCPFOrCNPJ`

#### Funções Disponíveis:
```typescript
// Validação
isValidCPF(cpf: string): boolean
isValidCNPJ(cnpj: string): boolean  
isValidCPFOrCNPJ(value: string): boolean

// Formatação
formatCPF(cpf: string): string
formatCNPJ(cnpj: string): string
formatCPFOrCNPJ(value: string): string

// Decorators para DTOs
@IsValidCPF()
@IsValidCNPJ() 
@IsValidCPFOrCNPJ()
```

#### Integração nos DTOs:
- ✅ **CreateTenantDto**: Validação aplicada no campo `cnpjCpf`
- ✅ **UpdateTenantDto**: Validação aplicada no campo `cnpjCpf`

### 🎨 Frontend

#### Utilitários (`frontend/src/lib/cpf-cnpj-validator.ts`)
- ✅ **Validação em tempo real**: Mesmas funções do backend
- ✅ **Formatação automática**: Aplica máscara conforme digitação
- ✅ **Detecção de tipo**: Identifica se é CPF ou CNPJ
- ✅ **Mensagens de erro**: Retorna mensagens específicas

#### Componente Reutilizável (`frontend/src/components/ui/cpf-cnpj-input.tsx`)
- ✅ **Input inteligente**: Formata automaticamente durante digitação
- ✅ **Validação visual**: Indicadores de erro em tempo real
- ✅ **Detecção de tipo**: Mostra badge CPF/CNPJ
- ✅ **Contador de dígitos**: Mostra progresso da digitação
- ✅ **Placeholder dinâmico**: Muda conforme o tipo detectado
- ✅ **Totalmente customizável**: Props para controlar comportamento

#### Props do Componente:
```typescript
interface CPFCNPJInputProps {
  label?: string;              // Label do campo
  error?: string;              // Erro externo
  onChange?: (value: string, isValid: boolean) => void;
  showValidation?: boolean;    // Ativar/desativar validação
  // + todas as props padrão de Input
}
```

### 🔄 Integração Completa

#### Página de Empresas:
- ✅ **Formulário de criação**: Campo CNPJ/CPF com validação
- ✅ **Formulário de edição**: Campo CNPJ/CPF com validação
- ✅ **Feedback visual**: Indicadores de CPF/CNPJ válido/inválido
- ✅ **Formatação automática**: Aplica máscara durante digitação

## Como Usar

### No Backend (DTOs):
```typescript
import { IsValidCPFOrCNPJ } from '../../common/validators/cpf-cnpj.validator';

export class CreateTenantDto {
  @IsValidCPFOrCNPJ({ message: 'CNPJ/CPF inválido' })
  cnpjCpf: string;
}
```

### No Frontend (Componente):
```tsx
import { CPFCNPJInput } from "@/components/ui/cpf-cnpj-input";

<CPFCNPJInput
  label="CNPJ/CPF"
  value={formData.cnpjCpf}
  onChange={(value, isValid) => {
    setFormData({ ...formData, cnpjCpf: value });
    setIsDocumentValid(isValid);
  }}
  showValidation={true}
/>
```

### Usando Funções Diretamente:
```typescript
import { isValidCPFOrCNPJ, formatCPFOrCNPJ } from "@/lib/cpf-cnpj-validator";

// Validar
const isValid = isValidCPFOrCNPJ("123.456.789-09"); // true

// Formatar
const formatted = formatCPFOrCNPJ("12345678909"); // "123.456.789-09"
```

## Recursos de Validação

### ✅ Validações Implementadas:
1. **Comprimento**: CPF (11 dígitos), CNPJ (14 dígitos)
2. **Dígitos verificadores**: Algoritmo oficial da Receita Federal
3. **Sequências inválidas**: Rejeita documentos com todos os dígitos iguais
4. **Formatação**: Remove/adiciona caracteres especiais automaticamente

### ✅ Casos Cobertos:
- CPF: `123.456.789-09` ✅ | `111.111.111-11` ❌
- CNPJ: `11.222.333/0001-81` ✅ | `11.111.111/1111-11` ❌
- Documentos parciais: Formatação progressiva
- Documentos inválidos: Mensagens específicas

## Interface do Usuário

### Componente CPFCNPJInput:
- **Formatação em tempo real**: Aplica máscara conforme digitação
- **Badge de tipo**: Mostra "CPF" ou "CNPJ" quando detectado
- **Contador de dígitos**: "CPF (8/11 dígitos)" ou "CNPJ (12/14 dígitos)"
- **Validação visual**: Borda vermelha e mensagem de erro
- **Placeholder inteligente**: Muda de "CPF ou CNPJ" para formato específico

### Estados Visuais:
1. **Neutro**: Campo vazio ou com poucos dígitos
2. **Digitando**: Mostra progresso e tipo detectado
3. **Válido**: Badge verde, sem erros
4. **Inválido**: Borda vermelha, mensagem de erro específica

## Testes Realizados

### ✅ Validação de CPF:
- CPF válido: `12345678909` ✅
- CPF formatado: `123.456.789-09` ✅
- CPF inválido (iguais): `111.111.111-11` ❌
- CPF inválido (zeros): `000.000.000-00` ❌

### ✅ Validação de CNPJ:
- CNPJ válido: `11222333000181` ✅
- CNPJ formatado: `11.222.333/0001-81` ✅
- CNPJ inválido (iguais): `11.111.111/1111-11` ❌
- CNPJ inválido (zeros): `00.000.000/0000-00` ❌

### ✅ Casos Extremos:
- Documento muito curto: `123` ❌
- Documento muito longo: `123456789012345` ❌
- Apenas números: Funciona normalmente
- Com formatação: Remove automaticamente

## Benefícios

### 🔒 Segurança:
- Validação dupla (frontend + backend)
- Algoritmos oficiais da Receita Federal
- Prevenção de documentos falsos comuns

### 🎯 UX/UI:
- Formatação automática melhora usabilidade
- Feedback visual imediato
- Componente reutilizável em todo o sistema

### 🛠️ Desenvolvimento:
- Código reutilizável e testado
- Fácil integração em novos formulários
- Documentação completa

### 📊 Manutenção:
- Funções centralizadas
- Testes automatizados
- Fácil atualização de regras

## Arquivos Criados/Modificados

### Backend:
- `backend/src/common/validators/cpf-cnpj.validator.ts` (novo)
- `backend/src/tenants/dto/create-tenant.dto.ts` (modificado)
- `backend/src/tenants/dto/update-tenant.dto.ts` (modificado)

### Frontend:
- `frontend/src/lib/cpf-cnpj-validator.ts` (novo)
- `frontend/src/components/ui/cpf-cnpj-input.tsx` (novo)
- `frontend/src/app/empresas/page.tsx` (modificado)

### Testes:
- `backend/test-cpf-cnpj-simple.js` (novo)

O sistema está **100% funcional** e pronto para uso em produção! 🚀