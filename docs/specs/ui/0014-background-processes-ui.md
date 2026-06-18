---
status: implemented
date: 2026-06-18
builds-on: [ADR-0008, ADR-0009, SPEC-0004, SPEC-0005]
implemented-by:
  - src/features/background-processes/lib/jobs-api.ts
  - src/features/background-processes/lib/job-event-stream.ts
  - src/features/background-processes/lib/ingest-event-mapper.ts
  - src/features/background-processes/lib/ingest-event-mapper.test.ts
  - src/features/background-processes/hooks/use-job-sync.ts
  - src/features/background-processes/hooks/use-job-event-stream.ts
  - src/features/background-processes/hooks/use-job-monitor.ts
  - src/features/background-processes/components/job-workspace-layout.tsx
  - src/features/background-processes/components/ingest-progress-panel.tsx
  - src/features/background-processes/components/ingest-agent-thread.tsx
  - src/features/background-processes/pages/job-monitor-page.tsx
  - src/features/background-processes/pages/job-monitor-page.spec.tsx
  - src/routes/_app/jobs/$jobId/index.tsx
  - src/components/app-shell.tsx
  - src/lib/app-nav.ts
  - src/features/exams/hooks/use-ingest-job.ts
  - src/features/exams/components/ingest-upload-form.tsx
  - src/features/exams/components/ingest-upload-form.spec.tsx
  - src/features/ai/jobs/ingest/run-ingest.ts
  - src/features/ai/jobs/ingest/ingest-events.ts
  - tests/setup.ts
---

# UI de processos em background: monitor de job ingest

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Pipeline de ingest (consumer, data parts):
> SPEC-0004. Orquestração Queue + D1: ADR-0009. Protocolo poll/SSE: ADR-0008.

## Objetivo

Após upload concluído em `/exams/new`, o usuário é direcionado para `/jobs/$jobId` e acompanha o
processamento server-side em tempo quase real: chat do agente (assistant-ui) à esquerda e painel de
progresso à direita. Refresh na URL reidrata estado e eventos do D1.

## Fluxo

1. `/exams/new`: usuário escolhe arquivo → `POST /api/jobs` → `POST /api/jobs/:id/upload` (browser
   aberto durante upload).
2. Upload OK → `navigate` para `/jobs/$jobId`.
3. Página de job monta `useJobMonitor`: poll TanStack Query + SSE tail (`GET /api/jobs/:id/stream`).
4. Eventos incrementais (`?after=<seq>`) são mergeados por `seq`; mapper traduz data parts ingest
   em mensagens assistant-ui.
5. Job terminal (`completed` | `failed` | `cancelled`) → poll para, SSE fecha; UI mostra resumo.
6. Refresh com job ativo → mesma visão via replay D1.

## Contrato

### Rota

| URL | Arquivo | Layout |
| --- | ------- | ------ |
| `/jobs/$jobId` | `src/routes/_app/jobs/$jobId/index.tsx` | Shell **wide** (`max-w-screen-xl`); split ~60/40 `md+`; stack `<md` |

### Módulo client

`src/features/background-processes/` — ver `implemented-by`.

### Sync

| Modo | Quando | Endpoint |
| ---- | ------ | -------- |
| Poll | Sempre (fallback) | `GET /api/jobs/:id/events?after=<seq>` |
| SSE | Página montada | `GET /api/jobs/:id/stream?after=<seq>` |

Dedup: store mantém `lastSeq`; eventos com `seq <= lastSeq` ignorados.

## Casos de borda

| # | QUANDO | o sistema DEVE |
| --- | ------ | -------------- |
| 1 | upload OK em `/exams/new` | navegar para `/jobs/$jobId` |
| 2 | refresh em job `queued`/`running` | reidratar eventos do D1 e retomar sync |
| 3 | job `awaiting_upload` em `/jobs/$jobId` | redirecionar para `/exams/new` |
| 4 | job 404 ou de outro user | mostrar erro |
| 5 | SSE falha | poll continua |
| 6 | poll e SSE entregam mesmo `seq` | dedup |
| 7 | job terminal | parar poll; fechar SSE; mostrar resumo ou erro |
| 8 | mobile `<md` | stack vertical (progresso acima, chat abaixo) |

## Questões em aberto

- [ ]

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run src/features/background-processes src/features/exams/components/ingest-upload-form.spec.tsx src/components/app-shell.spec.tsx
npm run docs-check                # exit 0
```

## Revisão humana

- Layout split em viewport real (desktop + mobile)
- Thread assistant-ui legível durante ingest longo

## Verificação

```text
npm run typecheck — exit 0
npm test — 172/172 passed
npm run docs-check — exit 0
```
