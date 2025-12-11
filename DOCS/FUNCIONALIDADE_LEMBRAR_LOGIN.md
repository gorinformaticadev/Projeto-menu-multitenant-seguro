# Funcionalidade "Lembrar Dados de Acesso"

## Descrição
Foi implementada uma funcionalidade na tela de login que permite ao usuário salvar suas credenciais (email e senha) para autocompletar automaticamente no próximo acesso.

## Como Funciona

### Interface do Usuário
- Um checkbox foi adicionado na tela de login com o texto "Lembrar meus dados de acesso"
- O checkbox aparece entre o campo de senha e o botão "Entrar"

### Comportamento
1. **Ao marcar o checkbox e fazer login:**
   - As credenciais (email e senha) são salvas no localStorage do navegador
   - Na próxima visita à página de login, os campos serão preenchidos automaticamente
   - O checkbox permanecerá marcado

2. **Ao desmarcar o checkbox:**
   - As credenciais salvas são removidas do localStorage
   - Os campos não serão mais preenchidos automaticamente

3. **Segurança:**
   - Os dados são armazenados apenas no localStorage do navegador do usuário
   - As credenciais não são enviadas para o servidor além do processo normal de login
   - Se o usuário limpar os dados do navegador, as credenciais salvas serão perdidas

## Arquivos Modificados

### `frontend/src/app/login/page.tsx`
- Adicionado estado `rememberMe` para controlar o checkbox
- Implementada lógica para salvar/carregar credenciais do localStorage
- Adicionado componente Checkbox na interface

### `frontend/src/components/ui/checkbox.tsx` (Novo)
- Componente Checkbox baseado no Radix UI
- Seguindo o padrão shadcn/ui do projeto

## Dependências Adicionadas
- `@radix-ui/react-checkbox`: Para o componente de checkbox

## Considerações de Segurança
- As senhas são armazenadas em texto plano no localStorage
- Esta funcionalidade deve ser usada apenas em dispositivos pessoais e confiáveis
- Em ambientes corporativos, considere implementar políticas que desencorajem o uso desta funcionalidade
- Para maior segurança, considere implementar criptografia das credenciais antes de armazenar no localStorage

## Uso Recomendado
- Ideal para usuários que acessam o sistema de dispositivos pessoais
- Melhora a experiência do usuário ao evitar digitação repetitiva
- Especialmente útil para usuários que fazem login frequentemente