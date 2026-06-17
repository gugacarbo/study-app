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
- **assistant-ui** como superfície padrão de streaming (ADR-0003)
- Data parts tipados (`data-*`) no AI SDK v6
- Implementação em `src/features/ai/` — rotas só delegam
- **Uma conexão HTTP por job** — dona do stream é o orquestrador (ADR-0006), não o dialog de detalhe

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| AI SDK UI Message Stream + assistant-ui | **Escolhida** |
| SSE custom por rota | Duplicação por domínio |
| WebSocket / Durable Objects | Overkill para POST → stream |
| Pipeline/reducers custom do legado | Rejeitado — usar padrão da lib |

## Decisão

Jobs longos: **POST → UI Message Stream**.

| Camada | Local |
|--------|--------|
| Orquestração + stream | `src/features/ai/` (server) |
| Rotas HTTP | `src/routes/api/` — parse/delegação fina |
| UI | `@assistant-ui/react` — thread/composer padrão; extensões mínimas |

Chat (`/api/chat`): mesmo formato de mensagem; tool loop em módulos de `features/ai/agents/`.

Novos jobs seguem cookbook em `src/features/ai/AGENTS.md` (greenfield).

### Ciclo de vida e performance (UI)

O stream HTTP **não** pertence ao dialog — pertence ao **background process** (ADR-0006). Fechar o dialog é decisão de **UI**, não de transporte.

| Camada | Dono | Dialog fechado |
|--------|------|----------------|
| `fetch` + UI Message Stream | `background-processes` → `runJobPipeline` | **Continua** até job terminar, falhar ou usuário cancelar |
| Mensagens / data parts | Store do processo (memória + metadados persistidos) | **Acumula** normalmente |
| `assistant-ui` Thread / runtime | Dialog ou painel de detalhe | **Desmonta** (`open=false`) — não manter runtime oculto |

**Reabrir dialog:** hidratar do store (`messages`, `agentRuns`, logs) — **sem novo POST** se o job ainda estiver `running` ou já tiver terminado em memória.

**Cancelar job:** só via ação explícita (botão Cancel / `AbortSignal` no registry ADR-0006) — **proibido** amarrar `abort()` ao `onOpenChange(false)` do dialog.

**Performance:** fechar dialog deve parar re-renders pesados (Thread, markdown, scroll); o consumer do stream pode seguir escrevendo no store. Não pausar leitura do body só por dialog fechado (evita backpressure e estado incompleto).

**Limites conhecidos:** refresh da página encerra o stream HTTP — reidratação só do que foi persistido (ADR-0006). Não há “resume stream” server-side sem nova spec.

Chat em painel dedicado: regras de conexão em SPEC-0010 (fora do dialog de agent-run).

## Consequências

- Client **não** consome essas rotas como JSON síncrono
- Dialog de inspect **não** abre nem fecha conexão de job
- **Proibido:** SSE paralelo por feature; POST bloqueante para jobs >1s; reintroduzir camada `PipelineThread`/reducers do legado sem spec; `abort` do job no fechamento do dialog; manter `assistant-ui` montado com dialog fechado

## Confirmação

```bash
test -d src/features/ai
grep -rq 'assistant-ui' src/features/ai/ 2>/dev/null
npm run typecheck
```

## Notas

Specs: ingest (SPEC-0004), chat (SPEC-0010), benchmark (SPEC-0015).
