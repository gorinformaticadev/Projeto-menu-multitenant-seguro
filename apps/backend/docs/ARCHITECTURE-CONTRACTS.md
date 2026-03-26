# Arquitetura de Contratos e Serialização (Backend)

Este documento consolida o padrão de contratos de dados (DTOs) e serialização obrigatório para todo o ecossistema backend NestJS do SaaS Multitenant. A arquitetura foi projetada para garantir que nenhum dado cru vaze para o frontend, mantendo uma tipagem forte e à prova de regressões ("drift") entre conexões HTTP e WebSockets.

---

## 1. Arquitetura Atual e Fonte Única da Verdade

O projeto abandonou a serialização espalhada manual (uso solto do `plainToInstance`).
A arquitetura é dividida em 3 pilares unificados:

1. **DTOs Rígidos**: Mapeamento 1:1 rigoroso utilizando decorators do `@nestjs/swagger` e `class-validator/class-transformer`. O uso de `any` ou `Record<string, unknown>` sem justificativa explícita é **proibido**.
2. **Interceptor Global (`ResponseValidationInterceptor`)**: Para requisições **HTTP**. Captura toda resposta de um *Controller*, detecta o DTO esperado via decorator `@ValidateResponse(DtoClass)` e assegura que a resposta trafegue validada e sanitizada para o cliente. 
3. **Serviço Central (`DtoMapperService`)**: Motor de transformação universal. Usado por baixo dos panos pelo Interceptor HTTP e, diretamente, por Gateways **WebSocket**, para sanitizar e exportar payloads convertidos antes que o Socket.IO faça o broadcast.

---

## 2. Guia de Criação de Novos Endpoints HTTP

Ao desenvolver um novo Controller ou adicionar uma rota a um já existente, siga este fluxo inegociável:

1. **Defina a Resposta Oficial**: Crie a classe DTO usando `@ApiProperty()`, `@Expose()` e validadores (ex: `@IsString()`).
2. **Utilize o Decorator**: Decore a função da rota, ou o Controller inteiro, com `@ValidateResponse(SeuDtoClass)`.
3. **Retorne Dados Transparentemente**: O Controller pode e deve retornar os objetos de infraestrutura naturais (ex: retornos diretos do Service/Prisma).
4. **Respeite o Contrato**: O `ResponseValidationInterceptor` vai capturar o retorno bruto, passá-lo pelo `DtoMapperService` e remover tudo que não pertença ao DTO. Se algo obrigatório faltar, um Erro 500 (Contrato Violado) interromperá o fluxo, reportando o desvio ao invés de deixá-lo chegar ao front e corromper o Next.js.

Exemplo ideal:
```typescript
@Get('meu-recurso')
@ValidateResponse(RecursoResponseDto)  // OBRIGATÓRIO
async getRecurso() {
   return this.recursoService.findAll(); // Prisma entity safe-mapped by interceptor
}
```

---

## 3. Guia de Criação de Novos Eventos WebSocket

WebSockets **bypassam** o pipeline HTTP tradicional (não rodam o interceptor de resposta). Para evitar o vazamento de entidades diretas e disparidade de contratos frente à API REST:

1. **Injete o DtoMapperService** no construtor do Gateway.
2. **Serializar Intermediariamente**: Antes de instanciar `.emit('evento', dado)`, nunca passe o `dado` direto. Transforme-o ativamente.
3. **Reutilização do DTO HTTP**: Empregue os mesmos DTOs do HTTP para assegurar que se o frontend usa WebSockets para atualizar listas reativamente (ex: DataGrids, Kanban), o payload seja estruturalmente 100% igual.

Exemplo ideal:
```typescript
constructor(private readonly dtoMapper: DtoMapperService) {}

@SubscribeMessage('recurso:update')
async updateRecurso(@ConnectedSocket() client: AuthenticatedSocket) {
   const entity = await this.service.update(id);
   // OBRIGATÓRIO: Passar pelp mapper central
   const payload = this.dtoMapper.serialize(RecursoResponseDto, entity);
   client.emit('recurso:updated', payload);
}
```

---

## 4. Anti-Patterns e Práticas Proibidas

❌ **Usar `any`, genéricos cegos `Object` ou `Record<string, unknown>`** sem comentar detalhadamente o *porquê* (como em payloads polimórficos de auditoria).  
❌ **Importar e utilizar `plainToInstance` isoladamente no Controller ou Serviço.** Utilize sempre o `DtoMapperService`.  
❌ **Emitir entidades do Prisma via WebSocket (`client.emit('evento', PrismaModel)`).** Isso entrega colunas do Banco, IDs internos, chaves `passwordHash` e outros dados para o mundo externo.  
❌ **Criar DTOs com `class-validator` esquecendo o `@Expose()`.** O transformador cortará o campo da resposta silenciosamente se você habilitar whitelist severo.  
❌ **Omitir o `@ValidateResponse()`**. Endpoints retornarão 500 em tempo de desenvolvimento pelo *Hardening* do Interceptor que detecta rotas "públicas".  

---

## 5. Checklist de Revisão de Pull Request (PR)

Ao revisar um PR focando em API Contratos:
- [ ] O Controller possui a anotação `@ValidateResponse()` para suas saídas?
- [ ] O DTO possui as devidas anotações de formatação e propriedade (`@Expose`)?
- [ ] Existe algum uso de `Record<string, any>` em JSONs? O desenvolvedor justificou explicitamente? Dá para compor esquema?
- [ ] Se o PR cria um Gateway/WebSocket, verifique os métodos `emit()`. Eles estão embrulhados pelo `DtoMapperService`?
- [ ] Alterações profundas de esquema (Renomear campo em DTO) também alteraram os testes do compilador (`type-check`) no frontend?

---

## 6. Lints, Testes e Monitoramentos para Enforcement Contínuo

Para evitar que as arquiteturas acima desmoronem, recomendamos a adoção das seguintes frentes:

1. **Catraca CI de TypeScript (`tsc --noEmit`)**: Tanto no backend quanto no frontend. Alterar DTO sem alterar tipos consumidos pelo frontend bloqueará o PR.
2. **Fail Fast Interceptor**: Continuar usando a linha protetiva inserida no `ResponseValidationInterceptor`, que trava endpoints no modo `development` e joga `InternalServerErrorException` caso flagrem rotas sem o decorator de resposta validada. 
3. **Regressões WebSocket Unitárias**: Assim como o teste inserido no `notification.gateway.spec.ts` que validou a chamada do `.emit` checando por um output serializado (`expect.objectContaining`), adote essa prática nos testes unitários para Gateways, assegurando que o Mock do `DtoMapperService` seja chamado antes de qualquer `to(room).emit()`.  
4. **Custom ESLint Rule** (Curto e Longo Prazo): Recomenda-se proibir importações de `plainToInstance` originadas em `class-transformer` cujo arquivo não inclua a string `dto-mapper.service.ts` limitando o acoplamento do pacote solto de validação de forma escalável.
