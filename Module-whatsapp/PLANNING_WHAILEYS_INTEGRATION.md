# Planejamento: Módulo WhatsApp (Padrão CRM)

## 1. Conceito: Módulo Embarcado
Para atender aos requisitos de independência e não alteração do Core, adotaremos o padrão de **Módulo do Sistema**.
O módulo será desenvolvido de forma isolada na pasta `Module-whatsapp`, mas estruturado para ser "instalado" no CRM principal.

**Resposta à dúvida:** Não será um microservice separado. Será um módulo NestJS que roda *dentro* do processo do CRM, compartilhando a porta, a autenticação e o servidor Socket.io existente, mas sem exigir edição manual dos arquivos do Core.

## 2. Reestruturação do Diretório `Module-whatsapp`
Para seguir o "Guia de Módulos" (`ESTRUTURA_E_INSTALACAO_MODULOS.md`), devemos reorganizar a pasta do projeto:

```text
Module-whatsapp/
├── module.json                (Definições, menus, permissões)
├── backend/                   (Lógica Node.js/NestJS)
│   ├── whatsapp.module.ts     (Módulo NestJS)
│   ├── whatsapp.service.ts    (Integração Whaileys)
│   ├── whatsapp.gateway.ts    (Socket.io namespace /whatsapp)
│   ├── whatsapp.controller.ts (Endpoints API)
│   └── package.json           (Dependência: whaileys)
└── frontend/                  (Interface Next.js)
    ├── pages/                 (Apenas as páginas)
    │   └── page.tsx           (Página principal)
    └── components/            (Componentes reutilizáveis)
        └── QrCodeScanner.tsx
```

## 3. Implementação do Backend (Isolado)

### A. Dependências
O arquivo `backend/package.json` declarará `whaileys`. O instalador do sistema cuidará de instalar essas dependências dentro da pasta do módulo.

### B. WhatsAppGateway (`backend/whatsapp.gateway.ts`)
Criaremos um Gateway dedicado ao módulo. O NestJS permite múltiplos Gateways.
- **Namespace**: `/whatsapp` (para não conflitar com o socket principal).
- **Segurança**: Utilizaremos os Guards do Core (ex: `JwtAuthGuard`).
  > *Importante: Precisaremos importar o AuthModule ou Guards do caminho relativo do core (`../../core/...`) ou usar a injeção de dependência global se disponível.*

```typescript
@WebSocketGateway({ namespace: 'whatsapp', cors: true })
export class WhatsappGateway {
  // Implementação da comunicação com o frontend
  // Emite 'qr_code' e 'status'
}
```

### C. WhatsAppService (`backend/whatsapp.service.ts`)
Conterá a lógica da `whaileys`:
- `makeWASocket`
- Gerenciamento de arquivos de sessão na pasta de uploads/sessions do sistema.

## 4. Implementação do Frontend

### A. Componente `QrCodeScanner`
- Conecta ao Socket.io no namespace `/whatsapp` do mesmo domínio da aplicação.
- Renderiza o QR Code recebido via socket.

## 5. Fluxo de Instalação/Desenvolvimento
Como estamos desenvolvendo "fora" da pasta `apps/backend` (na raiz `Module-whatsapp`), o fluxo de teste será:

1.  **Desenvolver** na pasta `Module-whatsapp`.
2.  **Sincronizar** (manualmente ou via script) para as pastas do sistema:
    - `Module-whatsapp/backend/*` -> `apps/backend/src/modules/whatsapp/*`
    - `Module-whatsapp/frontend/*` -> `apps/frontend/src/app/modules/whatsapp/*`
3.  **Rodar** o CRM (`apps/backend`) para testar.

## 6. Próximos Passos
1.  **Organizar Pastas**: Criar estrutura `backend` e `frontend` dentro de `Module-whatsapp`.
2.  **Mover Código**: Transferir os componentes React existentes para `frontend/components`.
3.  **Criar Backend**: Implementar os arquivos `whatsapp.module.ts`, `gateway` e `service` com a lógica da `whaileys`.

A autenticação e segurança serão herdadas do Core simplesmente por estarmos rodando dentro dele e importando seus Guards.
