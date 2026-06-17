---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0005]
deciders: []
---

# Orquestrar jobs longos com background processes no cliente

## Contexto e problema

O usuário inicia jobs (ingest, explain, improve, connection test, benchmark) e navega entre páginas. O Worker **não** mantém fila nem estado de job entre requests — o browser precisa de orquestração, cancelamento, persistência local e indicador global.

⚠️ **“Background” aqui é no cliente** (SPA + store), não processo assíncrono órfão no Cloudflare Workers.

## Direcionadores da decisão

- Jobs = streams HTTP (ADR-0005) via `features/ai/`
- UI sobrevive a refresh parcial (localStorage)
- Scheduler limita concorrência contra providers
- `AbortSignal` por processo
- **v1:** todos os kinds do legado desde o início

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| `background-processes` (store + kinds) | **Escolhida** |
| Durable Objects no servidor | Complexidade e custo desnecessários |
| Um job por página | UX ruim ao navegar |
| Subset de kinds no v1 | Rejeitado — paridade com legado |

## Decisão

Módulo **`src/features/background-processes/`**:

- Store central + kinds v1: **`ingest`**, **`explain-question`**, **`improve-questions`**, **`connection-test`**, **`model-benchmark`**
- `scheduler` (`canStart`, `runNextQueued`), `registry` (abort), `persistence` (localStorage)
- `BackgroundProcessProvider` no root
- Cada kind chama stream em `features/ai/` e atualiza o store

Kinds plugáveis; UI global (nav) e painéis usam selectors por kind.

**Stream vs dialog:** `runJobPipeline` mantém o `fetch` ativo independente de dialogs. Painéis/dialogs de detalhe (ex.: agent-run) **subscrevem** o store — fechar UI não chama `abort`; reabrir lê estado atual sem novo request (ADR-0005).

### Modelo servidor (Cloudflare Workers)

| Pergunta | Resposta v1 |
|----------|-------------|
| Job roda “em background no servidor”? | **Não** — sem Queues, Cron nem DO para fila de jobs |
| O que o Worker faz? | **Uma** invocação HTTP por job, com **stream** até fim, erro ou abort |
| Usuário navega no app | O `fetch` do browser **permanece aberto** → Worker segue ativo nessa conexão |
| Usuário fecha aba / perde rede | Conexão cai → `request.signal` aborta → **parar** LLM e etapas |
| Cancel no UI | `AbortController` do client → mesmo efeito que desconexão |

**Custo:** o grosso é **tokens LLM** (ADR-0007). No Workers: cobrança por **request** + **CPU ms** (tempo executando JS). Espera em `fetch` ao provider costuma consumir pouco CPU — mas a conexão HTTP fica aberta (limites de duração do plano).

**Controle de gasto:** `scheduler` no client limita jobs **simultâneos** (ex.: 1 ingest por vez) — cada job ativo = 1 Worker + 1 stream. Não iniciar N ingests em paralelo sem spec.

**Propagação de abort:** rotas de job passam `request.signal` ao pipeline e ao AI SDK (legado: `createJobApiRoute({ signal: true })`). **Proibido** ignorar abort e continuar chamando LLM após desconexão.

**Fora do v1:** se ingest ultrapassar limites de duração/CPU do Worker → ADR futura com **Queues** ou chunking — não `waitUntil` para esconder job após response fechada.

## Consequências

- Refresh durante stream ativo: perde stream; re-hidrata metadados persistidos — **sem resume server-side**
- Dialog fechado durante job: job e stream **continuam** (conexão client↔Worker aberta); só a UI pesada desmonta
- Tab fechada / offline: Worker **deve** parar o job via `request.signal`
- Duas abas não coordenam fila
- **Proibido:** polling `setInterval` sem spec; novos job stores em `src/stores/`; abort de job no `onOpenChange` de dialog; job órfão no servidor após response encerrada; `waitUntil` para prolongar pipeline de minutos

## Confirmação

```bash
test -d src/features/background-processes/store
test -f src/features/background-processes/provider/background-process-provider.tsx
npm run typecheck
```

## Notas

Comportamento detalhado: SPEC-0012.
