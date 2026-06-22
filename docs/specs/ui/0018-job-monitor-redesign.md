---
status: implemented
date: 2026-06-19
builds-on: [ADR-0007, ADR-0008, ADR-0009, SPEC-0005, SPEC-0014]
implemented-by:
  - src/features/background-processes/lib/ingest-event-labels.ts
  - src/features/background-processes/lib/ingest-event-mapper.ts
  - src/features/background-processes/lib/ingest-event-mapper.test.ts
  - src/features/background-processes/hooks/use-job-sync.ts
  - src/components/assistant-ui/ingest-thread.tsx
  - src/features/background-processes/components/ingest-job-thread.tsx
  - src/features/background-processes/components/ingest-events-list.tsx
  - src/features/background-processes/components/ingest-events-list.spec.tsx
  - src/features/background-processes/components/ingest-progress-panel.tsx
  - src/features/background-processes/components/job-sidebar-tabs.tsx
  - src/features/background-processes/components/job-workspace-layout.tsx
  - src/features/background-processes/pages/job-monitor-page.tsx
  - src/features/background-processes/pages/job-monitor-page.spec.tsx
---

# Monitor de job ingest: UI moderna com assistant-ui e eventos humanizados

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Sync poll/SSE e rota `/jobs/$jobId`:
> SPEC-0014. Pipeline de ingest e data parts: SPEC-0004. assistant-ui como superfície padrão:
> ADR-0007, ADR-0008.

## Objetivo

Refatorar a UI de `/jobs/$jobId` para uma experiência mais moderna e legível: thread de atividade
em formato de chat (assistant-ui) sempre visível à esquerda; painel direito com tabs **Progresso**
e **Eventos**; lista de eventos humanizada (sem JSON bruto). Comportamento de sync, auth e CTAs
terminais permanecem conforme SPEC-0014.

## Fluxo

1. Usuário chega em `/jobs/$jobId` após upload (SPEC-0014) ou refresh na URL.
2. `useJobMonitor` continua poll + SSE; eventos mergeados por `seq` no client.
3. Mapper traduz payloads ingest em mensagens de thread (`system` | `assistant`) e labels para a
   tab Eventos; `data-ingest-phase` atualiza stepper sem duplicar mensagem de chat.
4. Painel esquerdo renderiza thread assistant-ui read-only (`useExternalStoreRuntime`) com
   auto-scroll.
5. Painel direito abre na tab **Progresso** (stepper + métricas + arquivo). Tab **Eventos**
   mostra lista humanizada com contador `(N)`.
6. Job terminal → poll para, SSE fecha; CTAs no rodapé da página (sem auto-redirect para prova).

## Contrato

### Rota e layout

| URL | Arquivo | Layout |
| --- | ------- | ------ |
| `/jobs/$jobId` | `src/routes/_app/jobs/$jobId/index.tsx` | Shell **wide** (`max-w-screen-xl`); split ~60/40 `md+`; stack `<md` |

Wireframe desktop:

```text
┌────────────────────────────┬─────────────────────────┐
│ Atividade (assistant-ui)   │ [Progresso | Eventos(N)]│
│ thread read-only           │ conteúdo da tab ativa   │
└────────────────────────────┴─────────────────────────┘
[ CTAs quando status terminal ]
```

Mobile (`<md`): stack vertical — bloco direito (tabs) **acima**, chat **abaixo** (SPEC-0014 §caso 8).

### Módulo client

Alterações em `src/features/background-processes/` e scaffold assistant-ui em
`src/components/assistant-ui/` (via `npx assistant-ui@latest init`).

| Componente | Responsabilidade |
| ---------- | ---------------- |
| `ingest-job-thread.tsx` | Wrapper `AssistantRuntimeProvider` + `Thread` read-only |
| `ingest-progress-panel.tsx` | Stepper, badge, métricas, arquivo, erro — **sem** timeline |
| `ingest-events-list.tsx` | Lista humanizada na tab Eventos |
| `job-workspace-layout.tsx` | Split 60/40; slot direito aceita tabs |
| `job-monitor-page.tsx` | Orquestra layout, cancel, CTAs terminais |

Componentes **substituídos** (remover após migração):

- `ingest-agent-thread.tsx` → `ingest-job-thread.tsx`
- `job-events-panel.tsx` → `ingest-events-list.tsx`

### Sync (inalterado vs SPEC-0014)

| Modo | Endpoint |
| ---- | -------- |
| Poll | `GET /api/jobs/:id/events?after=<seq>` |
| SSE | `GET /api/jobs/:id/stream?after=<seq>` |

Dedup por `seq`; falha SSE não interrompe poll.

### Mapper de eventos → thread

Estender `ingest-event-mapper.ts`. Tipo de mensagem exposto ao client:

```ts
type MappedThreadMessage = {
  id: string;
  role: "system" | "assistant";
  content: string;
  seq: number;
};
```

| Payload | Mensagem na thread | Atualiza progresso |
| ------- | ------------------ | ------------------ |
| `data-ingest-phase` | **não** emite mensagem | sim (`phase`) |
| `text` com texto de fase (`PHASE_TEXT` em `run-ingest/constants.ts`) | `system` | não |
| `data-ingest-stream-progress` | `assistant` | sim (`questionsSeen`) |
| `data-ingest-skipped-duplicate` | `assistant` | não |
| `data-ingest-summary` | `assistant` | sim (contagens) |
| `text` genérico (demais) | `assistant` | não |

Remover campo `timeline` de `IngestProgressState` e toda UI “Eventos recentes” no painel de
progresso.

Runtime assistant-ui:

- `useExternalStoreRuntime` com mensagens derivadas de `MappedThreadMessage[]`
- Sem composer / input — thread somente leitura
- Auto-scroll em novas mensagens (`useThreadViewportAutoScroll`)
- Estado vazio: copy “Aguardando atualizações do agente…”

### Tab Eventos (lista humanizada)

Cada evento renderiza uma linha com:

- `seq` (monospace), timestamp `pt-BR` (ou `—` se `createdAt` nulo)
- Badge de tipo: `Fase`, `Progresso`, `Texto`, `Resumo`, `Duplicata`, `Outro`
- Label humanizado (mesma função usada pelo mapper)

Detalhe expandível (`Collapsible`) por linha **opcional**: pares chave-valor legíveis para payloads
`data-*`. **Proibido** renderizar `<pre>` com `JSON.stringify` do payload inteiro como conteúdo
principal da lista.

Tab trigger: `Eventos (N)` onde `N = events.length`.

### Tab Progresso

Conteúdo mínimo:

- Título “Progresso” + badge de status (`Na fila`, `Em andamento`, `Concluído`, `Falhou`, `Cancelado`)
- Stepper vertical: Leitura → Extração → Persistência (ícones done/active/pending)
- Label de fase atual ou “Importação concluída”
- Métricas quando disponíveis: questões identificadas, salvas
- `metadata.fileName` truncado
- Mensagem de erro (`role="alert"`) em `failed` / `cancelled`

### CTAs terminais (inalterados vs SPEC-0014 / SPEC-0008)

| Status | CTAs |
| ------ | ---- |
| `completed` + `metadata.examId` | primário “Ver prova”; outline “Nova importação”; secondary “Ver provas” |
| `completed` sem `examId` | “Nova importação”, “Ver provas” — sem “Ver prova” |
| `failed` | “Tentar novamente” → `/exams/new` |
| `cancelled` | “Nova importação” → `/exams/new` |

Barra de CTAs abaixo do split, com separação visual (`border-t` ou equivalente).

### Cancelamento

Botão “Cancelar” visível quando `isCancellableJobStatus(status)`; confirmação via `window.confirm`;
`POST /api/jobs/:id/cancel`; erro de cancel exibido em `Alert` destructive.

## Casos de borda

| # | QUANDO | o sistema DEVE |
| --- | ------ | -------------- |
| 1 | job `awaiting_upload` em `/jobs/$jobId` | redirecionar para `/exams/new` |
| 2 | job 404 ou de outro user | mostrar `Alert` destructive de erro |
| 3 | refresh com job `queued`/`running` | reidratar thread e tab Eventos via replay D1 |
| 4 | SSE falha | manter poll; UI continua atualizando |
| 5 | poll e SSE entregam mesmo `seq` | deduplicar — uma linha na tab Eventos |
| 6 | job terminal | parar poll; fechar SSE; exibir CTAs |
| 7 | nenhum evento ainda | thread vazia com placeholder; tab Eventos com empty state |
| 8 | viewport `<md` | tabs/progresso acima; chat abaixo |
| 9 | tab Eventos ativa e chegam eventos novos | incrementar `(N)` e append na lista sem perder scroll |
| 10 | payload desconhecido na tab Eventos | badge `Outro` + label fallback `"Evento #<seq>"` |

## Questões em aberto

- [ ]

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run src/features/background-processes
npm run docs-check                # exit 0
```

Critérios adicionais:

- Thread assistant-ui renderiza mensagens `system` e `assistant` distintas
- Tab Eventos **não** contém bloco JSON bruto como listagem principal
- Painel Progresso **não** contém seção “Eventos recentes”
- Arquivos obsoletos (`ingest-agent-thread.tsx`, `job-events-panel.tsx`) removidos

## Revisão humana

- Layout split em viewport desktop e mobile
- Legibilidade da thread durante ingest longo (auto-scroll, contraste system vs assistant)
- Tab Eventos útil sem sensação de debug

## Verificação

```text
npm run typecheck — exit 0
npm test -- --run src/features/background-processes — 13/13 passed
npm run docs-check — exit 0
```
