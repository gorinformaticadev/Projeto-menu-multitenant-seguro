# 📘 Módulo: Ordem de Serviços (OS)

---

## 1. VISÃO GERAL

O módulo de **Ordem de Serviços (OS)** tem como objetivo registrar, controlar, executar e documentar serviços prestados a clientes. Ele abrange desde a criação de orçamentos até a execução técnica, controle de peças, laudo técnico e emissão do relatório final.

O sistema é **multi-tenant**, integrado ao controle de usuários existente e segue regras rígidas de status, permissões e auditoria.

### 1.1 Contexto de Uso
* **Segmentos:** Assistência técnica (Informática, Celulares), Papelaria, Serviços digitais.
* **Canais de Entrada:** Atendimento presencial, WhatsApp, Sistema interno.

### 1.2 Objetivos
* Organização e Rastreabilidade dos serviços.
* Segurança e Profissionalismo.
* Base sólida para crescimento e auditoria.

---

## 2. REGRAS DE NEGÓCIO E FLUXOS

### 2.1 Conceitos Principais
* **Ordem de Serviço (OS):** Registro formal de um serviço autorizado para execução.
* **Orçamento:** Registro preliminar, sem compromisso de execução/cobrança, que pode ser convertido em OS.

### 2.2 Status e Fluxo de Vida
O ciclo de vida da OS segue um fluxo rigoroso para garantir a integridade dos dados.

| Código | Status             | Descrição |
| ------ | ------------------ | --------- |
| 0      | `orcamento`        | Proposta inicial, aguardando aprovação. |
| 1      | `aberta`           | OS criada, aguardando triagem ou início. |
| 2      | `em_analise`       | Equipamento em análise técnica. |
| 3      | `aguardando_cliente`| Pendente de aprovação ou resposta do cliente. |
| 4      | `aguardando_pecas` | Parada aguardando chegada de insumos. |
| 5      | `em_execucao`      | Serviço sendo realizado. |
| 6      | `finalizada`       | Serviço concluído e entregue (Status Terminal). |
| 7      | `cancelada`        | Serviço cancelado (Status Terminal). |

**Fluxo Típico:**
```
Orçamento → Aberta → Em Análise → Em Execução → Finalizada
              ↘ Aguardando Cliente
              ↘ Aguardando Peças

* Cancelamento pode ocorrer em qualquer etapa antes da finalização.
```

### 2.3 Permissões e Perfis
O sistema respeita a hierarquia de usuários, onde o maior privilégio prevalece.

* **ADMIN / SUPER_ADMIN:**
  * Controle total (Cria, Edita, Cancela, Finaliza).
  * Gerencia configurações, clientes e produtos.
  * Pode editar valores finais.

* **TÉCNICO:**
  * Executa a OS.
  * Preenche e edita o **Laudo Técnico**.
  * Pode criar clientes e orçamentos.
  * *Restrição:* Não pode finalizar OS (apenas Admin, salvo configuração específica) ou alterar valores financeiros após aprovação.

* **ATENDENTE (USER):**
  * Cria orçamentos e abre OS.
  * Edita dados cadastrais (Cliente/Equipamento).
  * *Restrição:* Não acessa Laudo Técnico nem finaliza OS.

### 2.4 Regras Gerais
1. **Imutabilidade:** OS `finalizada` ou `cancelada` não pode ser editada (apenas visualização).
2. **Histórico:** Toda mudança de status ou alteração crítica gera log em `os_historico`.
3. **Laudo Técnico:** Campo de uso exclusivo técnico/admin. É bloqueado após finalização.
4. **Clientes:** Apenas clientes ativos podem abrir novas OS.
5. **Exclusão:** Registros críticos não são deletados fisicamente (Soft Delete).

---

## 3. MODELO DE DADOS (DATABASE SCHEMA)

Abaixo está a definição oficial das tabelas, campos e relacionamentos.

### 3.1 Tabela: `clientes`
Armazena os dados dos clientes.
| Campo | Tipo | Obrig. | Detalhes |
|-------|------|--------|----------|
| `id` | INT (PK) | ✔ | Auto incremento |
| `nome` | VARCHAR(150) | ✔ | |
| `cpf_cnpj` | VARCHAR(20) | ❌ | |
| `telefone1` | VARCHAR(20) | ✔ | Principal meio de contato |
| `telefone2` | VARCHAR(20) | ❌ | |
| `endereco` | TEXT | ❌ | |
| `ativo` | BOOLEAN | ✔ | Default `TRUE` |
| `bairro` | VARCHAR(100) | ❌ | |
| `cidade` | VARCHAR(100) | ❌ | |
| `cep` | VARCHAR(20) | ❌ | |
| `numero` | VARCHAR(20) | ❌ | |
| `created_at` | DATETIME | ✔ | |
| `updated_at` | DATETIME | ✔ | |

### 3.2 Tabela: `ordens_servico`
Tabela central do módulo.
| Campo | Tipo | Obrig. | Detalhes |
|-------|------|--------|----------|
| `id` | INT (PK) | ✔ | |
| `numero_os` | VARCHAR(30) | ✔ | Identificador único legível |
| `tipo` | ENUM | ✔ | `orcamento` / `ordem_servico` |
| `status` | ENUM | ✔ | Ver lista de status (2.2) |
| `cliente_id` | INT (FK) | ✔ | Ref. `clientes.id` |
| `usuario_abertura_id` | INT (FK) | ✔ | Ref. `users.id` |
| `tecnico_responsavel_id`| INT (FK) | ❌ | Ref. `users.id` |
| `descricao_servico` | TEXT | ✔ | Solicitação inicial do cliente |
| `observacoes` | TEXT | ❌ | Notas internas |
| `laudo_tecnico` | LONGTEXT | ❌ | Relatório técnico detalhado |
| `valor_estimado` | DECIMAL(10,2)| ❌ | |
| `valor_final` | DECIMAL(10,2)| ❌ | Definido no fechamento |
| `created_at` | DATETIME | ✔ | Data de Abertura |
| `updated_at` | DATETIME | ✔ | |
| `finalizada_em` | DATETIME | ❌ | Data de Conclusão |

### 3.3 Tabela: `equipamentos_os`
Detalhes do equipamento vinculado à OS (Relação 1:1 com `ordens_servico`).
| Campo | Tipo | Obrig. | Detalhes |
|-------|------|--------|----------|
| `id` | INT (PK) | ✔ | |
| `os_id` | INT (FK) | ✔ | Ref. `ordens_servico.id` |
| `tipo_equipamento` | ENUM | ✔ | Laptop, Desktop, Celular, Impressora... |
| `marca` | VARCHAR(100) | ❌ | |
| `modelo` | VARCHAR(100) | ❌ | |
| `numero_serie` | VARCHAR(100) | ❌ | |
| `tensao` | VARCHAR(20) | ❌ | 110v / 220v / Bivolt |
| `acessorios` | TEXT | ❌ | Cabos, carregadores deixados |
| `estado_equipamento` | TEXT | ❌ | Condições físicas na entrada (riscos, danos...) |
| `senha_dispositivo` | VARCHAR(100) | ❌ | Caso necessário para testes |

### 3.4 Tabela: `produtos_servicos`
Catálogo simples de itens para compor a OS.
| Campo | Tipo | Obrig. | Detalhes |
|-------|------|--------|----------|
| `id` | INT (PK) | ✔ | |
| `codigo` | VARCHAR(50) | ✔ | SKU ou Código Interno |
| `nome` | VARCHAR(150) | ✔ | |
| `tipo` | ENUM | ✔ | `produto` / `servico` |
| `preco_venda` | DECIMAL(10,2)| ✔ | |
| `ativo` | BOOLEAN | ✔ | |

### 3.5 Tabela: `os_itens`
Relaciona os produtos/serviços consumidos em uma OS.
| Campo | Tipo | Obrig. | Detalhes |
|-------|------|--------|----------|
| `id` | INT (PK) | ✔ | |
| `os_id` | INT (FK) | ✔ | Ref. `ordens_servico.id` |
| `produto_servico_id` | INT (FK) | ❌ | Ref. `produtos_servicos.id` (Opcional p/ item avulso) |
| `descricao` | VARCHAR(200) | ✔ | Nome do item (copiado ou manual) |
| `quantidade` | DECIMAL(10,2)| ✔ | Default 1 |
| `valor_unitario` | DECIMAL(10,2)| ✔ | |
| `valor_total` | DECIMAL(10,2)| ✔ | `qtd * unitario` |

### 3.6 Tabela: `os_historico`
Auditoria completa de eventos.
| Campo | Tipo | Obrig. | Detalhes |
|-------|------|--------|----------|
| `id` | INT (PK) | ✔ | |
| `os_id` | INT (FK) | ✔ | |
| `usuario_id` | INT (FK) | ✔ | Quem realizou a ação |
| `acao` | VARCHAR(100) | ✔ | Ex: `MUDANCA_STATUS`, `EDICAO_VALOR` |
| `status_anterior` | VARCHAR(50) | ❌ | Se houver troca de status |
| `status_novo` | VARCHAR(50) | ❌ | |
| `observacao` | TEXT | ❌ | Justificativa ou detalhe automático |
| `created_at` | DATETIME | ✔ | |

---

## 4. RELATÓRIOS E DOCUMENTOS

### 4.1 Modelo de Relatório Técnico (Impressão/PDF)
Este template é gerado automaticamente ao finalizar a OS ou para entrega de orçamento.

#### 🔖 Cabeçalho
* **OS Nº:** `{{os_numero}}`
* **Tipo:** `{{tipo}}`
* **Datas:** Abertura: `{{data_abertura}}` | Fechamento: `{{data_fechamento}}`
* **Status Final:** `{{status}}`

#### 👤 Cliente
* **Nome:** `{{cliente_nome}}`
* **Doc:** `{{cliente_doc}}`
* **Contato:** `{{cliente_tell}}`

#### 💻 Equipamento e Estado
* **Equipamento:** `{{equipamento_tipo}}` `{{marca}}` `{{modelo}}`
* **Num. Série:** `{{serial}}`
* **Acessórios:** `{{acessorios}}`
* **Estado na Entrada:** `{{estado_equipamento}}`

#### 🛠 Serviço Solicitado / Defeito
> `{{descricao_servico}}`

#### 📝 Laudo Técnico (Restrito)
> `{{laudo_tecnico}}`

#### 💰 Itens e Valores
| Qtd | Descrição | V. Unit | Total |
|-----|-----------|---------|-------|
| `{{qtd}}` | `{{descricao_item}}` | `{{v_unit}}` | `{{v_total}}` |

* **Total Serviços:** R$ `{{total_servicos}}`
* **Total Produtos:** R$ `{{total_produtos}}`
* **TOTAL GERAL:** R$ `{{total_geral}}`

#### ✍ Assinaturas e Termos
> Garantia de 90 dias para serviços executados. Equipamentos não retirados em 90 dias serão considerados abandonados.

__________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; __________________________
**Técnico Responsável** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **Cliente**
