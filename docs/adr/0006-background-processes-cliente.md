---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0005]
deciders: []
---

# Orquestrar jobs longos com background processes no cliente

## Contexto e problema

O usuário inicia jobs (ingest, explain, improve, connection test, benchmark) e navega entre páginas. O Worker não guarda estado de job entre requests — o browser precisa de fila, cancelamento, persistência e indicador global.

## Direcionadores da decisão

- Jobs = streams HTTP (ADR-0005)
- UI sobrevive a refresh parcial (localStorage)
- Scheduler limita concorrência contra providers
- `AbortSignal` por processo

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| `background-processes` (store + kinds) | **Escolhida** |
| Durable Objects no servidor | Complexidade e custo desnecessários |
| Um job por página | UX ruim ao navegar |

## Decisão

Módulo **`src/features/background-processes/`**:

- Store central + kinds: `ingest`, `explain-question`, `improve-questions`, `connection-test`, `model-benchmark`
- `scheduler` (`canStart`, `runNextQueued`), `registry` (abort), `persistence` (localStorage)
- `BackgroundProcessProvider` no root
- Cada kind chama `runJobPipeline` e atualiza o store

Kinds plugáveis; UI global (nav) e painéis usam selectors por kind.

## Consequências

- Refresh durante stream ativo: perde stream; re-hidrata metadados persistidos
- Duas abas não coordenam fila
- **Proibido:** polling `setInterval` sem spec; novos job stores em `src/stores/` (deprecado)

## Confirmação

```bash
test -d src/features/background-processes/store
test -f src/features/background-processes/provider/background-process-provider.tsx
npm run typecheck
```

## Notas

Comportamento detalhado: SPEC-0012.
