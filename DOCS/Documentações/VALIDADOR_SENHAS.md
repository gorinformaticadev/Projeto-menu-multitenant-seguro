# Validador de Senhas Baseado em Configurações

## Descrição
Sistema completo de validação de senhas que obedece às configurações de segurança definidas pelo SUPER_ADMIN, incluindo componente reutilizável, hook personalizado e medidor de força de senha.

## Funcionalidades Implementadas

### 🔧 Contexto de Configuração Expandido

#### SecurityConfigContext Atualizado (`frontend/src/contexts/SecurityConfigContext.tsx`)
- ✅ **Configurações completas**: Carrega todas as configurações de segurança do backend
- ✅ **Política de senhas**: Inclui todos os requisitos configuráveis
- ✅ **Cache inteligente**: Otimização de performance
- ✅ **Fallback seguro**: Valores padrão em caso de erro

#### Interface Expandida:
```typescript
interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
}

interface SecurityConfig {
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  twoFactorRequiredForAdmins: boolean;
  twoFactorSuggested: boolean;
  sessionTimeoutMinutes: number;
  passwordPolicy: PasswordPolicy;
}
```

### 🎨 Componente PasswordInput

#### Componente Reutilizável (`frontend/src/components/ui/password-input.tsx`)
- ✅ **Validação em tempo real**: Baseada nas configurações do sistema
- ✅ **Medidor de força**: Pontuação de 0-100 com níveis visuais
- ✅ **Mostrar/ocultar senha**: Botão de toggle integrado
- ✅ **Campo de confirmação**: Opção de confirmação integrada
- ✅ **Requisitos visuais**: Lista de requisitos com status
- ✅ **Feedback imediato**: Indicadores de válido/inválido
- ✅ **Totalmente customizável**: Props para controlar comportamento

#### Props do Componente:
```typescript
interface PasswordInputProps {
  label?: string;                    // Label do campo
  error?: string;                    // Erro externo
  onChange?: (value: string, isValid: boolean) => void;
  showValidation?: boolean;          // Mostrar requisitos
  showStrengthMeter?: boolean;       // Mostrar medidor de força
  confirmPassword?: string;          // Valor da confirmação
  showConfirmation?: boolean;        // Mostrar campo de confirmação
  onConfirmChange?: (value: string, matches: boolean) => void;
  // + todas as props padrão de Input
}
```

### 🔄 Hook de Validação

#### Hook Personalizado (`frontend/src/hooks/usePasswordValidation.ts`)
- ✅ **Validação independente**: Pode ser usado sem o componente
- ✅ **Resultado completo**: Validações individuais + pontuação
- ✅ **Lista de requisitos**: Array estruturado para UI customizada
- ✅ **Confirmação de senha**: Hook separado para confirmação

#### Funções Disponíveis:
```typescript
// Hook principal
usePasswordValidation(password: string): PasswordValidationResult

// Hook para confirmação
usePasswordConfirmation(password: string, confirmPassword: string)

// Função utilitária
validatePasswordWithPolicy(password: string, policy: PasswordPolicy)
```

#### Resultado da Validação:
```typescript
interface PasswordValidationResult {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecial: boolean;
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;                     // 0-100
  requirements: PasswordRequirement[];
}
```

### 🎯 Sistema de Pontuação

#### Algoritmo de Força da Senha:
1. **Requisitos básicos** (20 pontos cada):
   - Comprimento mínimo
   - Letra maiúscula (se obrigatória)
   - Letra minúscula (se obrigatória)
   - Número (se obrigatório)
   - Caractere especial (se obrigatório)

2. **Bônus por comprimento** (até 20 pontos):
   - +10 pontos: 4+ caracteres além do mínimo
   - +10 pontos: 8+ caracteres além do mínimo

3. **Bônus por diversidade** (até 5 pontos):
   - Baseado na variedade de caracteres únicos

#### Níveis de Força:
- **Fraca** (0-49): Vermelho
- **Média** (50-69): Amarelo
- **Forte** (70-89): Azul
- **Muito Forte** (90-100): Verde

### 🔒 Configurações Obedecidas

#### Requisitos Configuráveis:
- **Comprimento mínimo**: `passwordMinLength` (6-32 caracteres)
- **Letra maiúscula**: `passwordRequireUppercase` (true/false)
- **Letra minúscula**: `passwordRequireLowercase` (true/false)
- **Números**: `passwordRequireNumbers` (true/false)
- **Caracteres especiais**: `passwordRequireSpecial` (true/false)

#### Caracteres Especiais Aceitos:
```
!@#$%^&*()_+-=[]{}|;':"\\,.<>/?~`
```

## Como Usar

### 1. Componente Básico:
```tsx
import { PasswordInput } from "@/components/ui/password-input";

<PasswordInput
  label="Nova Senha"
  value={password}
  onChange={(value, isValid) => {
    setPassword(value);
    setIsPasswordValid(isValid);
  }}
  showValidation={true}
  showStrengthMeter={true}
/>
```

### 2. Com Confirmação:
```tsx
<PasswordInput
  label="Nova Senha"
  value={password}
  onChange={(value, isValid) => setPassword(value)}
  showConfirmation={true}
  confirmPassword={confirmPassword}
  onConfirmChange={(value, matches) => {
    setConfirmPassword(value);
    setPasswordsMatch(matches);
  }}
/>
```

### 3. Hook Independente:
```tsx
import { usePasswordValidation } from "@/hooks/usePasswordValidation";

const validation = usePasswordValidation(password);

// Usar validation.isValid, validation.strength, etc.
```

### 4. Validação Customizada:
```tsx
import { validatePasswordWithPolicy } from "@/hooks/usePasswordValidation";

const result = validatePasswordWithPolicy(password, {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
});
```

## Interface do Usuário

### Componente PasswordInput:
- **Campo de senha**: Input com toggle mostrar/ocultar
- **Medidor de força**: Barra de progresso colorida com percentual
- **Lista de requisitos**: Checkmarks verdes/vermelhos para cada requisito
- **Campo de confirmação**: Opcional, integrado ao componente
- **Status geral**: Indicador final de válido/inválido

### Estados Visuais:
1. **Neutro**: Campo vazio
2. **Digitando**: Validação em tempo real
3. **Válida**: Todos os requisitos atendidos (verde)
4. **Inválida**: Requisitos não atendidos (vermelho)
5. **Força**: Cores baseadas na pontuação

### Responsividade:
- Layout adaptável para mobile
- Componentes empilhados em telas pequenas
- Texto legível em todos os tamanhos

## Integração com Configurações

### Fluxo de Configuração:
1. **SUPER_ADMIN** define políticas em `/configuracoes/seguranca`
2. **SecurityConfigContext** carrega configurações do backend
3. **Componentes** aplicam regras automaticamente
4. **Usuários** veem requisitos atualizados em tempo real

### Sincronização:
- Configurações carregadas no contexto global
- Atualização automática quando SUPER_ADMIN altera regras
- Cache local para performance
- Fallback para valores padrão seguros

## Benefícios

### 🔒 Segurança:
- Políticas centralizadas e configuráveis
- Validação consistente em todo o sistema
- Requisitos baseados em melhores práticas
- Feedback educativo para usuários

### 🎯 UX/UI:
- Validação em tempo real
- Feedback visual claro
- Medidor de força motivacional
- Componente reutilizável

### 🛠️ Desenvolvimento:
- Código centralizado e testado
- Fácil integração em formulários
- Hook flexível para casos customizados
- Documentação completa

### 📊 Administração:
- Controle total sobre políticas de senha
- Configuração sem código
- Aplicação imediata das mudanças
- Auditoria de configurações

## Arquivos Criados/Modificados

### Novos Arquivos:
- `frontend/src/components/ui/password-input.tsx`
- `frontend/src/hooks/usePasswordValidation.ts`
- `frontend/src/components/examples/password-input-example.tsx`

### Arquivos Modificados:
- `frontend/src/contexts/SecurityConfigContext.tsx`
- `frontend/src/components/PasswordValidator.tsx`

### Documentação:
- `DOCS/VALIDADOR_SENHAS.md`

## Casos de Uso

### 1. Cadastro de Usuário:
```tsx
<PasswordInput
  label="Senha"
  showValidation={true}
  showStrengthMeter={true}
  showConfirmation={true}
/>
```

### 2. Alteração de Senha:
```tsx
<PasswordInput
  label="Nova Senha"
  showValidation={true}
  showStrengthMeter={true}
/>
```

### 3. Reset de Senha:
```tsx
<PasswordInput
  label="Nova Senha"
  showValidation={true}
  showConfirmation={true}
/>
```

### 4. Validação Customizada:
```tsx
const validation = usePasswordValidation(password);
// Implementar UI customizada baseada em validation
```

O sistema está **100% funcional** e integrado com as configurações de segurança! 🚀