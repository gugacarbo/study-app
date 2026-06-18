---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0002, ADR-0007, ADR-0008]
deciders: []
---

# Orquestrar jobs longos no servidor (Queues + D1)

## Contexto e problema

O usuário inicia jobs (ingest, explain, connection test, benchmark) e navega ou **atualiza a página** sem perder progresso. O modelo anterior (stream HTTP preso ao browser) falhava no refresh e abortava LLM ao fechar aba.

Exceção: etapas em que o **browser envia bytes** (upload de arquivo) dependem da conexão do cliente — refresh ou fechar aba durante upload pode falhar; após o arquivo estar em R2, o restante do job é **server-side**.

## Direcionadores da decisão

- Execução **no servidor** — sobrevive a refresh, navegação e fechar aba (fases pós-upload)
- Estado durável em **D1** — fonte de verdade do job e eventos de progresso
- **Cloudflare Queues** para disparar/serializar consumers (não Durable Objects por job — DO cobra duração enquanto ativo; jobs com espera LLM ficam caros)
- UI: **poll** (TanStack Query) + **SSE opcional** quando painel de job está aberto (ADR-0008)
- Cliente: espelho de estado + upload — **não** dono da execução LLM
- Kinds v1: `ingest`, `explain-question`, `connection-test`, `model-benchmark` (sem `improve-questions`)

## Opções consideradas

| Opção                                         | Veredito                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Queues + D1 + consumer Worker                 | **Escolhida** — custo previsível; ops baratas vs GB-s de DO em jobs longos |
| Durable Object por job                        | Rejeitado — duration billing alto em espera LLM; complexidade extra        |
| Stream HTTP preso ao client (modelo anterior) | Rejeitado — refresh perde execução                                         |
| `waitUntil` sem Queue                         | Rejeitado — não confiável para pipelines de minutos após response          |
| Só localStorage no client                     | Rejeitado — não sobrevive a outro dispositivo/aba limpa                    |

### Custo (regra prática)

| Componente  | Impacto neste app                                                       |
| ----------- | ----------------------------------------------------------------------- |
| Tokens LLM  | **Dominante** (ADR-0005)                                                |
| Queue ops   | ~2–4 ops/job — barato (10k/dia free; 1M/mês paid)                       |
| Worker CPU  | Consumer ativo durante steps — não durante poll do client               |
| DO duration | Evitado — cobrança por GB·s enquanto objeto vivo (ruim em waits de LLM) |

## Decisão

### Estado no servidor (D1)

Tabelas em SPEC-0001 (`background_jobs`, `background_job_events`):

| Tabela                  | Uso                                                                         |
| ----------------------- | --------------------------------------------------------------------------- |
| `background_jobs`       | `id`, `user_id`, `kind`, `status`, `phase`, `error`, `metadata`, timestamps |
| `background_job_events` | `job_id`, `seq`, payload (UI message / data part JSON), `created_at`        |

`status` v1: `awaiting_upload` → `queued` → `running` → `completed` \| `failed` \| `cancelled`.

Todo evento de progresso (mensagens assistant-ui, data parts, logs) é **append** em `background_job_events` pelo consumer — mesmo formato ADR-0008.

### Execução (Cloudflare Queues)

Binding `JOB_QUEUE` em `wrangler.jsonc`. Consumer: `src/workers/job-consumer.ts` (ou módulo em `src/features/ai/jobs/` exportado no worker).

```
[Client]  POST /api/jobs           → insert job (D1)
[Client]  POST /api/jobs/:id/upload  → R2 (só ingest; browser deve permanecer)
[API]     enqueue { jobId }      → status queued
[Consumer] dequeue → run pipeline em features/ai/ → append events + update status
[Client]  GET /api/jobs/:id/events?after=seq  → poll
[Client]  GET /api/jobs/:id/stream (SSE)     → replay D1 + tail (painel aberto)
```

Kinds **sem upload** (`explain-question`, `connection-test`, `model-benchmark`): `POST /api/jobs` enfileira imediatamente.

### Fases dependentes do browser

| Fase                   | Browser aberto obrigatório? | Se refresh/fechar aba                                                        |
| ---------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| Upload arquivo → R2    | **Sim**                     | Upload pode falhar; job fica `awaiting_upload` ou `failed` — usuário reenvia |
| Pipeline IA pós-upload | **Não**                     | Consumer continua; client reidrata via poll/SSE                              |
| Cancel explícito       | Não                         | `POST /api/jobs/:id/cancel` → flag; consumer para entre steps                |

**Proibido** tratar desconexão do client como cancel do job (exceto durante upload ativo, onde a request HTTP do upload aborta).

### Cliente (`src/features/background-processes/`)

Papel: **UI + sync** — não executa LLM.

| Peça                        | Função                                                       |
| --------------------------- | ------------------------------------------------------------ |
| Store                       | Lista de jobs ativos/recentes; cache de eventos              |
| `useJobSync(jobId)`         | TanStack Query poll em `/api/jobs/:id/events`                |
| SSE hook                    | Conecta `/stream` quando dialog/painel aberto; fallback poll |
| `BackgroundProcessProvider` | Indicador global na nav                                      |
| Upload handlers             | Única parte que mantém `fetch` longo no browser              |

`localStorage`: opcional — cache de `jobId`s recentes para reidratação rápida; **D1 é fonte de verdade**.

Scheduler client: limita uploads simultâneos; fila server-side via Queue (1 consumer message por job — concorrência global configurável no consumer/wrangler).

### Cancelamento

- `POST /api/jobs/:id/cancel` → `cancel_requested_at` em D1
- Consumer verifica entre steps / tool calls — **não** amarrar a `request.signal` do client nas fases server-side
- Upload em andamento: `AbortSignal` do upload aborta só o transfer — job pode voltar a `awaiting_upload`

## Consequências

- `wrangler.jsonc`: binding Queue + consumer export
- SPEC-0001: tabelas `background_jobs`, `background_job_events`
- SPEC-0011: UI de fila, poll, SSE, estados de upload
- ADR-0008: stream SSE é **tail de leitura no D1**, não dono da execução; DO também rejeitado no relay de stream (v1)
- Refresh com job `running`: UI mostra progresso atualizado do D1
- Duas abas: mesma visão via poll (sem coordenação extra)
- **Proibido:** `waitUntil` como substituto de Queue; DO por job sem ADR nova; abort de LLM no `beforeunload` do client; polling agressivo sem backoff (usar Query `refetchInterval` adaptativo); job só em localStorage

## Confirmação

```bash
grep -q 'JOB_QUEUE' wrangler.jsonc
test -f src/features/ai/jobs/run-job-consumer.ts || test -f src/workers/job-consumer.ts
grep -rq 'background_jobs' src/db/schema.ts
test -d src/features/background-processes
npm run typecheck
```

## Notas

Comportamento UI: SPEC-0011. Ingest upload: SPEC-0004. Formato mensagens: ADR-0008.
