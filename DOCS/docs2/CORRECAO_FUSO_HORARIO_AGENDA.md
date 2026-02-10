# Correção do Problema de Fuso Horário na Agenda

## Problema Identificado
Cada vez que um evento era editado e salvo, ele alterava a hora para 3 horas antes. Isso acontecia devido a uma dupla conversão de fuso horário:

1. **Ao carregar o evento para edição**: Usávamos `format(new Date(event.startTime), 'HH:mm')` que convertia a data UTC para o horário local
2. **Ao salvar**: Usávamos `fromZonedTime()` que tratava o horário como se fosse no fuso horário configurado

Isso causava uma dupla conversão, resultando na diferença de 3 horas (UTC-3 para Brasil).

## Solução Implementada

### 1. Importação da função `formatInTimeZone`
```typescript
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
```

### 2. Correção no carregamento de eventos para edição
**Antes:**
```typescript
start_time: format(new Date(event.startTime), 'HH:mm'),
end_time: format(new Date(event.endTime), 'HH:mm'),
```

**Depois:**
```typescript
const timeZone = localStorage.getItem('agenda_timezone') || 'America/Sao_Paulo';
const startTime = new Date(event.startTime);
const endTime = new Date(event.endTime);

start_time: formatInTimeZone(startTime, timeZone, 'HH:mm'),
end_time: formatInTimeZone(endTime, timeZone, 'HH:mm'),
```

### 3. Correção aplicada em todos os tipos de eventos
- **Eventos regulares**: start_time, end_time, start_date, end_date
- **Tarefas**: due_date, due_time
- **Slots de agendamento**: start_date, start_time, end_time

## Arquivos Modificados

### Sistema Instalado
- `apps/frontend/src/app/modules/agenda/components/EventCreationModal.tsx`

### Módulo Raiz
- `module-agenda/frontend/components/EventCreationModal.tsx`

## Como Funciona Agora

1. **Ao carregar evento para edição**: `formatInTimeZone()` converte a data UTC para o fuso horário configurado
2. **Ao salvar**: `fromZonedTime()` converte o horário do fuso configurado para UTC
3. **Resultado**: Não há dupla conversão, o horário permanece correto

## Teste da Correção

Para testar:
1. Crie um evento às 14:00
2. Edite o evento e salve sem alterar a hora
3. Verifique se o horário permanece 14:00 (antes ficaria 11:00)

## Benefícios

- ✅ Horários permanecem corretos após edição
- ✅ Respeita o fuso horário configurado em `agenda/pages/configuracoes`
- ✅ Funciona para todos os tipos de eventos (eventos, tarefas, slots)
- ✅ Mantém compatibilidade com Google Calendar