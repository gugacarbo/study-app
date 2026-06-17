---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0003]
deciders: []
---

# Usar UI Message Stream para jobs longos de IA

## Contexto e problema

Ingestão, connection test, explain-question e model-benchmark duram segundos a minutos. O usuário precisa de progresso em tempo real (etapas, logs, tool calls, tokens) sem polling ad-hoc.

A **execução** do job roda no servidor (ADR-0006). O formato de mensagens permanece AI SDK UI Message Stream; eventos são **persistidos em D1** e entregues ao client via poll + SSE.

## Direcionadores da decisão

- Um protocolo para **chat** e **jobs batch**
- **assistant-ui** como superfície padrão de streaming (ADR-0003)
- Data parts tipados (`data-*`) no AI SDK v6
- Implementação em `src/features/ai/` — rotas só delegam
- Jobs: consumer grava eventos; client **não** mantém POST aberto para LLM (exceto upload — ADR-0006)

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| UI Message Stream persistido + poll/SSE | **Escolhida** |
| POST → stream único preso ao browser | Rejeitado — refresh mata job |
| SSE custom por rota sem persistência | Rejeitado — perde progresso no refresh |
| Pipeline/reducers custom do legado | Rejeitado — usar padrão da lib |

## Decisão

### Produção de eventos (servidor)

| Camada | Local |
|--------|--------|
| Pipeline + append eventos | `src/features/ai/` — consumer Queue (ADR-0006) |
| Persistência | `background_job_events` (D1) — um row por chunk/evento |
| Rotas HTTP | `src/routes/api/jobs/` — criar, upload, events, stream, cancel |

Cada step do pipeline serializa mensagens/data parts no **mesmo schema** AI SDK v6 usado em chat.

### Consumo no client

| Modo | Quando | Endpoint |
|------|--------|----------|
| **Poll** | Sempre (TanStack Query) | `GET /api/jobs/:id/events?after=<seq>` |
| **SSE** | Painel/dialog de job aberto | `GET /api/jobs/:id/stream` — replay `after=0` + tail novos eventos |

Hidratar `assistant-ui` Thread a partir de eventos acumulados — mesmo após refresh.

Chat (`/api/chat`): **stream HTTP direto** (sessão ao vivo) — fora do modelo Queue; regras em SPEC-0009.

### Ciclo de vida e performance (UI)

| Camada | Dono | Dialog fechado |
|--------|------|----------------|
| Execução LLM | Queue consumer (servidor) | **Continua** |
| Eventos | D1 `background_job_events` | **Persistidos** |
| Poll | TanStack Query (intervalo adaptativo) | **Continua** leve |
| SSE | Hook no painel de detalhe | **Desconecta** — poll mantém sync |
| `assistant-ui` Thread | Dialog/painel | **Desmonta** |

**Reabrir dialog:** replay eventos do D1 (+ SSE tail se `running`) — **sem** novo job.

**Cancelar job:** `POST /api/jobs/:id/cancel` — **proibido** `abort()` no fechamento do dialog.

**Upload:** única fase com `fetch` longo no browser; progresso de upload é local até R2 confirmar (ADR-0006).

## Consequências

- Client de jobs **não** depende de POST bloqueante para LLM
- Dialog não controla vida do job — só visibilidade e SSE opcional
- **Proibido:** SSE paralelo ad-hoc por feature; POST bloqueante para jobs >1s (exceto upload); `abort` de job no `onOpenChange`; assistant-ui montado oculto com dialog fechado; assumir stream HTTP como única fonte de verdade

## Confirmação

```bash
test -d src/features/ai
grep -rq 'assistant-ui' src/features/ai/ 2>/dev/null
grep -rq 'background_job_events' src/db/ 2>/dev/null
npm run typecheck
```

## Notas

Specs: ingest (SPEC-0004), chat (SPEC-0009), benchmark (SPEC-0014), jobs UI (SPEC-0011).
