---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006]
deciders: []
---

# Usar Vercel AI SDK com providers configuráveis em D1

## Contexto e problema

Ingestão, chat, explicações e benchmark dependem de LLMs com streaming e tool calling. Providers e modelos variam; API keys não podem ir para o browser. Configuração é **por usuário** (`user_id` da sessão).

## Direcionadores da decisão

- IA somente no servidor (Workers)
- Multi-provider (base URL + key por provider)
- Streaming first (chat + jobs)
- Tool calling por agent de domínio
- UI de chat/jobs via **padrão assistant-ui** — sem glue custom pesado do legado

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| Vercel AI SDK v6 + catálogo D1 + assistant-ui | **Escolhida** |
| TanStack AI / OpenRouter fixo | Menos flexível |
| HTTP manual por provider | Reinventa stream, tools, retries |
| Pipeline custom legado (`PipelineThread`, reducers próprios) | Rejeitado — preferir streaming padrão assistant-ui |

## Decisão

**Vercel AI SDK** (`ai`, `@ai-sdk/*` conforme provider) em `src/features/ai/`.

- Resolução de modelo: `getAiModel()` + `buildProviderOptions()`
- Catálogo D1: `ai_providers`, `ai_models` — escopo `user_id`
- Default de modelo: tabela `config` (por usuário)
- Agents, tools, adapters: `src/features/ai/`
- **Rotas API** (`src/routes/api/*`): delegam para `src/features/ai/` — sem lógica pesada colada na rota
- **UI:** `@assistant-ui/react` com streaming padrão da lib (thread, composer, markdown); data parts AI SDK v6 onde necessário
- Telemetria: `llm_logs` com `user_id` — **obrigatório**, append-only (ADR-0005)
- Config IA do usuário: UI em `/admin/config` — guard `admin:access` (ADR-0004)

## Consequências

- Keys criptografadas em D1 via `src/lib/config-encryption.ts` (ADR-0006)
- Testes mockam `@/features/ai/` ou `fetch` — nunca chamada real no CI
- **Proibido:** SDK de IA em componentes client; API keys em vars de produção no `wrangler.jsonc`; portar 1:1 adaptações custom do legado em `.old_app/`; chamar LLM sem passar por `src/lib/llm-logging.ts`

## Confirmação

```bash
grep -q '"ai"' package.json
grep -q '@assistant-ui/react' package.json
test -d src/features/ai
! grep -r '@ai-sdk' src --include='*.tsx' --exclude-dir=node_modules 2>/dev/null | grep -vE '\.(test|spec)\.' | head -1
npm run typecheck
```

## Notas

UI de config: SPEC-0002. Protocolo de jobs: ADR-0008. Cookbook de agents: `src/features/ai/AGENTS.md` (reescrever no greenfield).
