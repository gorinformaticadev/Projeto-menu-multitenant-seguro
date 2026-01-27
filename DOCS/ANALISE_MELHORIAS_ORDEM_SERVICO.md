# Analise e Proposta de Melhorias - Modulo de Ordens de Servico

**Data:** 2026-01-26  
**Versao:** 1.0.0  
**Autor:** Analise de Sistema

---

## 1. Estado Atual do Sistema

### 1.1 Estrutura de Status Existente

O sistema atual possui 8 status (0-7):
- `0` - ORCAMENTO
- `1` - ABERTA  
- `2` - EM_ANALISE
- `3` - AGUARDANDO_CLIENTE
- `4` - AGUARDANDO_PECAS
- `5` - EM_EXECUCAO
- `6` - FINALIZADA
- `7` - CANCELADA

### 1.2 Tabelas Existentes Relevantes

| Tabela | Descricao |
|--------|-----------|
| `mod_ordem_servico_ordens` | Tabela principal de OS |
| `mod_ordem_servico_historico` | Historico de alteracoes (acoes genericas) |
| `mod_ordem_servico_configs` | Configuracoes do modulo |
| `mod_ordem_servico_clients` | Clientes |
| `mod_ordem_servico_order_notifications` | Notificacoes por OS |

### 1.3 Historico Atual (Limitacoes)

O historico atual (`mod_ordem_servico_historico`) registra acoes genericas:
- Nao ha registro especifico de mudanca de status
- Nao ha campo dedicado para `status_anterior` e `status_novo`
- Estrutura atual: `acao`, `valor_anterior`, `valor_novo`, `observacoes`

---

## 2. Proposta: Novos Status da OS

### 2.1 Estrutura Proposta

Expandir o campo `status` para incluir novos valores finais:

| Codigo | Status | Descricao | Tipo |
|--------|--------|-----------|------|
| 0-5 | (existentes) | Status operacionais | Intermediario |
| 6 | FINALIZADA | Servico concluido | **Final** |
| 7 | CANCELADA | OS cancelada | **Final** |
| 8 | **RETIRADO** | Equipamento retirado pelo cliente | **Final** |
| 9 | **ABANDONADO** | Equipamento abandonado pelo cliente | **Final** |

### 2.2 Fluxo de Transicoes Proposto

```
ORCAMENTO(0) -> ABERTA(1), CANCELADA(7)
ABERTA(1) -> EM_ANALISE(2), CANCELADA(7)
EM_ANALISE(2) -> EM_EXECUCAO(5), AGUARDANDO_CLIENTE(3), AGUARDANDO_PECAS(4), CANCELADA(7)
AGUARDANDO_CLIENTE(3) -> EM_ANALISE(2), EM_EXECUCAO(5), AGUARDANDO_PECAS(4), CANCELADA(7)
AGUARDANDO_PECAS(4) -> EM_EXECUCAO(5), AGUARDANDO_CLIENTE(3), CANCELADA(7)
EM_EXECUCAO(5) -> FINALIZADA(6), AGUARDANDO_CLIENTE(3), AGUARDANDO_PECAS(4), CANCELADA(7)

-- NOVOS FLUXOS --
FINALIZADA(6) -> RETIRADO(8), ABANDONADO(9), EM_EXECUCAO(5)
RETIRADO(8) -> (estado final - imutavel)
ABANDONADO(9) -> (estado final - imutavel)
CANCELADA(7) -> EM_EXECUCAO(5)
```

### 2.3 Regras de Negocio por Status

| Status | Regras |
|--------|--------|
| **RETIRADO** | Exige pagamento confirmado; Exige data de retirada; Pode ter taxa de conservacao |
| **ABANDONADO** | Exige 3 tentativas de contato registradas; Permite anexar comprovantes |
| **FINALIZADA** | Aguardando retirada; Base para calculo de atraso |
| **CANCELADA** | Exige motivo obrigatorio |

---

## 3. Proposta: Historico de Status da OS

### 3.1 Nova Tabela: `mod_ordem_servico_status_historico`

```sql
CREATE TABLE mod_ordem_servico_status_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    ordem_servico_id UUID NOT NULL,
    
    -- Dados da mudanca
    status_anterior INTEGER NOT NULL,
    status_novo INTEGER NOT NULL,
    
    -- Metadados
    usuario_id TEXT NOT NULL,
    data_alteracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    observacoes TEXT,
    
    -- Auditoria (imutavel)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_status_hist_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_status_hist_ordem FOREIGN KEY (ordem_servico_id)
        REFERENCES mod_ordem_servico_ordens(id) ON DELETE CASCADE,
    CONSTRAINT chk_status_values CHECK (
        status_anterior >= 0 AND status_anterior <= 9 AND
        status_novo >= 0 AND status_novo <= 9
    )
);

-- Indices para consulta rapida
CREATE INDEX idx_status_hist_ordem ON mod_ordem_servico_status_historico(ordem_servico_id);
CREATE INDEX idx_status_hist_data ON mod_ordem_servico_status_historico(data_alteracao DESC);
```

### 3.2 Caracteristicas

- **Imutavel**: Nao permite UPDATE ou DELETE apos insercao
- **Visivel no detalhe da OS**: Timeline de status
- **Ordenacao cronologica**: Por `data_alteracao DESC`
- **Auditoria completa**: Usuario, data/hora, observacoes

---

## 4. Proposta: Regras para Status "RETIRADO" (8)

### 4.1 Nova Tabela: `mod_ordem_servico_pagamentos`

```sql
CREATE TABLE mod_ordem_servico_pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    ordem_servico_id UUID NOT NULL,
    
    -- Dados do pagamento
    forma_pagamento VARCHAR(50) NOT NULL,
    valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
    parcelas INTEGER DEFAULT 1,
    
    -- Metadados
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    
    -- Constraints
    CONSTRAINT fk_pagamento_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_pagamento_ordem FOREIGN KEY (ordem_servico_id)
        REFERENCES mod_ordem_servico_ordens(id) ON DELETE CASCADE
);

CREATE INDEX idx_pagamentos_ordem ON mod_ordem_servico_pagamentos(ordem_servico_id);
```

### 4.2 Regras de Validacao para Retirada

```typescript
// Regras no service
async validarRetirada(ordemId: string, pagamentos: PagamentoDTO[]): Promise<void> {
    // 1. Validar quantidade maxima de formas de pagamento
    if (pagamentos.length > 5) {
        throw new Error('Maximo de 5 formas de pagamento permitidas');
    }
    
    // 2. Validar que ha pelo menos uma forma de pagamento
    if (pagamentos.length === 0) {
        throw new Error('Informe ao menos uma forma de pagamento');
    }
    
    // 3. Validar soma dos valores
    const ordem = await this.findOne(tenantId, ordemId);
    const totalPagamentos = pagamentos.reduce((sum, p) => sum + p.valor, 0);
    const totalOS = ordem.valor_servico + (ordem.valor_conservacao || 0);
    
    if (Math.abs(totalPagamentos - totalOS) > 0.01) {
        throw new Error(`Soma dos pagamentos (${totalPagamentos}) deve ser igual ao total da OS (${totalOS})`);
    }
}
```

### 4.3 DTO de Retirada

```typescript
export class RetiradaDTO {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(5)
    @ValidateNested({ each: true })
    pagamentos: PagamentoDTO[];
    
    @IsOptional()
    @IsString()
    observacoes?: string;
}

export class PagamentoDTO {
    @IsString()
    @IsNotEmpty()
    forma_pagamento: string; // PIX, DINHEIRO, CARTAO_CREDITO, CARTAO_DEBITO, TRANSFERENCIA
    
    @IsNumber()
    @Min(0.01)
    valor: number;
    
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    parcelas?: number;
}
```

---

## 5. Proposta: Cobranca por Atraso (Conservacao)

### 5.1 Nova Configuracao

```sql
-- Adicionar configuracoes de conservacao
INSERT INTO mod_ordem_servico_configs (tenant_id, key, value)
VALUES 
    ('tenant_id', 'prazo_retirada_dias', '30'),
    ('tenant_id', 'valor_conservacao_diario', '5.00'),
    ('tenant_id', 'conservacao_habilitada', 'true');
```

### 5.2 Novos Campos na Tabela de Ordens

```sql
ALTER TABLE mod_ordem_servico_ordens ADD COLUMN IF NOT EXISTS
    valor_conservacao DECIMAL(10,2) DEFAULT 0,
    dias_atraso INTEGER DEFAULT 0,
    justificativa_conservacao TEXT,
    data_limite_retirada TIMESTAMP;
```

### 5.3 Logica de Calculo

```typescript
async calcularConservacao(ordemId: string): Promise<ConservacaoResult> {
    const ordem = await this.findOne(tenantId, ordemId);
    const config = await this.getConfig(tenantId);
    
    // Calcular data limite
    const dataFinalizacao = new Date(ordem.data_conclusao);
    const prazoRetiradaDias = parseInt(config.prazo_retirada_dias || '30');
    const dataLimite = addDays(dataFinalizacao, prazoRetiradaDias);
    
    // Verificar atraso
    const hoje = new Date();
    if (hoje <= dataLimite) {
        return { diasAtraso: 0, valorConservacao: 0, emAtraso: false };
    }
    
    // Calcular dias e valor
    const diasAtraso = differenceInDays(hoje, dataLimite);
    const valorDiario = parseFloat(config.valor_conservacao_diario || '5.00');
    const valorConservacao = diasAtraso * valorDiario;
    
    return {
        diasAtraso,
        valorConservacao,
        emAtraso: true,
        dataLimite
    };
}
```

### 5.4 Interface de Retirada com Atraso

Quando houver atraso, o sistema deve:
1. Exibir aviso visual de atraso
2. Mostrar campo para informar valor de conservacao (pre-calculado, editavel)
3. Campo opcional para justificativa
4. O valor de conservacao e somado ao total da OS
5. Registrar separadamente no financeiro

---

## 6. Proposta: Alertas de Equipamentos Nao Retirados

### 6.1 Sistema de Badges

```typescript
interface AlertaRetirada {
    totalPendentes: number;
    urgentes: number;        // > 30 dias
    atencao: number;         // 15-30 dias
    normal: number;          // < 15 dias
    cobrancaAtiva: number;   // Com taxa de conservacao aplicavel
}
```

### 6.2 Query de Alertas

```sql
-- View para alertas de retirada
CREATE OR REPLACE VIEW vw_alertas_retirada AS
SELECT 
    tenant_id,
    COUNT(*) as total_pendentes,
    COUNT(*) FILTER (WHERE dias_desde_finalizacao > 30) as urgentes,
    COUNT(*) FILTER (WHERE dias_desde_finalizacao BETWEEN 15 AND 30) as atencao,
    COUNT(*) FILTER (WHERE dias_desde_finalizacao < 15) as normal,
    COUNT(*) FILTER (WHERE dias_desde_finalizacao > prazo_config) as cobranca_ativa
FROM (
    SELECT 
        o.tenant_id,
        o.id,
        EXTRACT(DAY FROM (NOW() - o.data_conclusao))::int as dias_desde_finalizacao,
        COALESCE((
            SELECT c.value::int 
            FROM mod_ordem_servico_configs c 
            WHERE c.tenant_id = o.tenant_id AND c.key = 'prazo_retirada_dias'
        ), 30) as prazo_config
    FROM mod_ordem_servico_ordens o
    WHERE o.status = 6 -- FINALIZADA
) sub
GROUP BY tenant_id;
```

### 6.3 Componente de Badge (Frontend)

```tsx
interface RetiradaBadgeProps {
    alertas: AlertaRetirada;
}

export function RetiradaBadge({ alertas }: RetiradaBadgeProps) {
    if (alertas.totalPendentes === 0) return null;
    
    const getColor = () => {
        if (alertas.urgentes > 0) return 'bg-red-500';
        if (alertas.atencao > 0) return 'bg-yellow-500';
        return 'bg-blue-500';
    };
    
    return (
        <Link href="/modules/ordem_servico/pages/ordens?status=6">
            <Badge className={`${getColor()} animate-pulse cursor-pointer`}>
                {alertas.totalPendentes} equipamentos aguardando retirada
            </Badge>
        </Link>
    );
}
```

### 6.4 Cores por Tempo de Atraso

| Tempo | Cor | Acao |
|-------|-----|------|
| < 15 dias | Azul | Normal |
| 15-30 dias | Amarelo | Atencao |
| > 30 dias | Vermelho | Urgente |
| Com cobranca | Laranja | Taxa ativa |

---

## 7. Proposta: Regras para Status "ABANDONADO" (9)

### 7.1 Nova Tabela: `mod_ordem_servico_alertas_abandono`

```sql
CREATE TABLE mod_ordem_servico_alertas_abandono (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    ordem_servico_id UUID NOT NULL,
    
    -- Sequencia do alerta (1, 2 ou 3)
    numero_alerta INTEGER NOT NULL CHECK (numero_alerta BETWEEN 1 AND 3),
    
    -- Dados do envio
    data_envio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meio_comunicacao VARCHAR(50) NOT NULL, -- WHATSAPP, EMAIL, SMS, CARTA, TELEFONE
    enviado_por TEXT NOT NULL,
    
    -- Conteudo
    mensagem TEXT,
    observacoes TEXT,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_alerta_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_alerta_ordem FOREIGN KEY (ordem_servico_id)
        REFERENCES mod_ordem_servico_ordens(id) ON DELETE CASCADE,
    CONSTRAINT uk_alerta_ordem_numero UNIQUE (ordem_servico_id, numero_alerta)
);

CREATE INDEX idx_alertas_abandono_ordem ON mod_ordem_servico_alertas_abandono(ordem_servico_id);
```

### 7.2 Nova Tabela: `mod_ordem_servico_anexos_abandono`

```sql
CREATE TABLE mod_ordem_servico_anexos_abandono (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    alerta_id UUID NOT NULL,
    
    -- Dados do arquivo
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo_arquivo VARCHAR(100) NOT NULL,
    tamanho_bytes INTEGER,
    url_arquivo TEXT NOT NULL,
    
    -- Descricao
    descricao TEXT,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by TEXT NOT NULL,
    
    -- Constraints
    CONSTRAINT fk_anexo_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_anexo_alerta FOREIGN KEY (alerta_id)
        REFERENCES mod_ordem_servico_alertas_abandono(id) ON DELETE CASCADE
);
```

### 7.3 Fluxo de Abandono

```
+-------------------------------------------------------------+
|                    OS STATUS: FINALIZADA                     |
+-------------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------------+
|  Prazo expirado? -> Iniciar processo de abandono             |
+-------------------------------------------------------------+
                           |
           +---------------+---------------+
           v               v               v
   +-------------+  +-------------+  +-------------+
   |  ALERTA 1   |  |  ALERTA 2   |  |  ALERTA 3   |
   |  WhatsApp   |->|  WhatsApp   |->|  WhatsApp   |
   |  + Anexo    |  |  + Anexo    |  |  + Anexo    |
   +-------------+  +-------------+  +-------------+
                                           |
                                           v
                    +---------------------------------------------+
                    |  Apos 3 alertas -> Permitir ABANDONO        |
                    +---------------------------------------------+
                                           |
                                           v
                    +---------------------------------------------+
                    |         OS STATUS: ABANDONADO               |
                    +---------------------------------------------+
```

### 7.4 Validacao para Marcar como Abandonado

```typescript
async validarAbandono(ordemId: string): Promise<void> {
    const alertas = await this.getAlertasAbandono(ordemId);
    
    // Verificar se existem exatamente 3 alertas
    if (alertas.length < 3) {
        throw new Error(
            `Sao necessarios 3 alertas registrados para marcar como abandonado. ` +
            `Alertas registrados: ${alertas.length}/3`
        );
    }
    
    // Verificar se todos os alertas tem data de envio
    const alertasSemEnvio = alertas.filter(a => !a.data_envio);
    if (alertasSemEnvio.length > 0) {
        throw new Error('Todos os alertas devem ter data de envio registrada');
    }
}
```

### 7.5 Interface de Gestao de Alertas

```tsx
// Componente para gestao de alertas de abandono
export function AlertasAbandonoManager({ ordemId }: { ordemId: string }) {
    const [alertas, setAlertas] = useState<AlertaAbandono[]>([]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Alertas de Retirada</CardTitle>
                <CardDescription>
                    Registre as tentativas de contato com o cliente
                </CardDescription>
            </CardHeader>
            <CardContent>
                {[1, 2, 3].map(numero => {
                    const alerta = alertas.find(a => a.numero_alerta === numero);
                    return (
                        <AlertaCard 
                            key={numero}
                            numero={numero}
                            alerta={alerta}
                            disabled={numero > 1 && !alertas.find(a => a.numero_alerta === numero - 1)}
                            onSave={handleSaveAlerta}
                        />
                    );
                })}
                
                {alertas.length === 3 && (
                    <Button 
                        variant="destructive"
                        onClick={handleMarcarAbandonado}
                    >
                        Marcar como Abandonado
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
```

---

## 8. Modelagem Completa (Resumo)

### 8.1 Novas Tabelas

| Tabela | Descricao |
|--------|-----------|
| `mod_ordem_servico_status_historico` | Historico imutavel de mudancas de status |
| `mod_ordem_servico_pagamentos` | Formas de pagamento na retirada |
| `mod_ordem_servico_alertas_abandono` | Alertas de abandono (3 tentativas) |
| `mod_ordem_servico_anexos_abandono` | Anexos dos alertas |

### 8.2 Novos Campos na Tabela Principal

```sql
ALTER TABLE mod_ordem_servico_ordens ADD COLUMN IF NOT EXISTS
    valor_conservacao DECIMAL(10,2) DEFAULT 0,
    dias_atraso INTEGER DEFAULT 0,
    justificativa_conservacao TEXT,
    data_limite_retirada TIMESTAMP,
    data_retirada TIMESTAMP;
```

### 8.3 Novas Configuracoes

| Chave | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `prazo_retirada_dias` | INT | 30 | Dias para retirada apos finalizacao |
| `valor_conservacao_diario` | DECIMAL | 5.00 | Valor por dia de atraso |
| `conservacao_habilitada` | BOOL | true | Habilitar cobranca de conservacao |
| `intervalo_alertas_dias` | INT | 7 | Intervalo entre alertas de abandono |

---

## 9. Pontos de Atencao para UX

### 9.1 Badges e Notificacoes

| Local | Tipo | Trigger |
|-------|------|---------|
| Menu lateral | Badge vermelho | OS aguardando retirada > 30 dias |
| Dashboard | Card de alerta | Qualquer OS aguardando retirada |
| Lista de OS | Icone de aviso | OS individual com prazo proximo |
| Cabecalho | Notificacao push | Prazo de retirada expirando |

### 9.2 Campos Obrigatorios por Status

| Status | Campos Obrigatorios |
|--------|---------------------|
| RETIRADO | Pagamentos (min 1, max 5), Soma = Total OS |
| ABANDONADO | 3 alertas registrados com data de envio |
| CANCELADA | Motivo do cancelamento |
| FINALIZADA | Valor do servico > 0 |

### 9.3 Permissoes Sugeridas

```typescript
const NOVAS_PERMISSOES = [
    'orders_mark_retirado',      // Marcar como retirado
    'orders_mark_abandonado',    // Marcar como abandonado
    'orders_register_payment',   // Registrar pagamentos
    'orders_apply_conservation', // Aplicar taxa de conservacao
    'orders_send_alerts',        // Enviar alertas de abandono
    'orders_view_alerts',        // Ver historico de alertas
    'config_conservation',       // Configurar regras de conservacao
];
```

---

## 10. Proximos Passos Recomendados

1. **Migracao de Dados**
   - Criar script de migracao para expandir enum de status
   - Criar novas tabelas
   - Adicionar novos campos

2. **Backend**
   - Implementar DTOs e validacoes
   - Criar endpoints para pagamentos e alertas
   - Implementar calculo automatico de conservacao

3. **Frontend**
   - Criar componentes de pagamento multiplo
   - Criar interface de gestao de alertas
   - Implementar badges e notificacoes
   - Adicionar timeline de status

4. **Testes**
   - Testes de transicao de status
   - Testes de validacao de pagamentos
   - Testes de calculo de conservacao

---

Esta analise contempla todos os requisitos solicitados, considerando o sistema corporativo, multiusuario e com controle de permissoes ja existente no modulo. A implementacao pode ser feita de forma incremental, priorizando os status "Retirado" e "Abandonado" como primeira entrega.
