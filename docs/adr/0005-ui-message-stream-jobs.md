---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0003]
deciders: []
---

# Usar UI Message Stream para jobs longos de IA

## Contexto e problema

Ingestão, connection test, explain-question, improve-questions e model-benchmark duram segundos a minutos. O usuário precisa de progresso em tempo real (etapas, logs, tool calls, tokens) sem polling ad-hoc.

## Direcionadores da decisão

- Um protocolo para **chat** e **jobs batch**
- UI compartilhada (`@assistant-ui/react`, `PipelineThread`)
- Data parts tipados (`data-*`) no AI SDK v6

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| AI SDK UI Message Stream | **Escolhida** |
| SSE custom por rota | Duplicação por domínio |
| WebSocket / Durable Objects | Overkill para POST → stream |

## Decisão

Jobs longos: **POST → UI Message Stream**.

| Camada | Módulo |
|--------|--------|
| Servidor | `createJobApiRoute`, `runPipelineStage`, `ui-message-job-stream.ts` |
| Cliente | `runJobPipeline`, reducers em `pipeline/client/` |
| UI | `PipelineThread`, `PipelineLogsPanel`, `PipelineErrorBanner` |

Chat (`/api/chat`): mesmo formato; tool loop em `chat-agent-loop.ts`.

Novos jobs seguem o cookbook em `src/features/ai/AGENTS.md`.

## Consequências

- Client **não** consome essas rotas como JSON síncrono
- **Proibido:** SSE paralelo por feature; POST bloqueante para jobs >1s

## Confirmação

```bash
test -f src/features/ai/core/ui-message-job-stream.ts
test -f src/features/ai/pipeline/server/index.ts
npm run typecheck
```

## Notas

Specs: ingest (SPEC-0004), chat (SPEC-0010), benchmark (SPEC-0015).
