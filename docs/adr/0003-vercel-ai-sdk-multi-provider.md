---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0002, ADR-0004]
deciders: []
---

# Usar Vercel AI SDK com providers configuráveis em D1

## Contexto e problema

Ingestão, chat, explicações, revisão e benchmark dependem de LLMs com streaming e tool calling. Providers e modelos variam; API keys não podem ir para o browser. Configuração é **por usuário** (`user_id` da sessão).

## Direcionadores da decisão

- IA somente no servidor (Workers)
- Multi-provider (base URL + key por provider)
- Streaming first (chat + jobs)
- Tool calling por agent de domínio

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| Vercel AI SDK v6 + catálogo D1 | **Escolhida** |
| TanStack AI / OpenRouter fixo | Menos flexível |
| HTTP manual por provider | Reinventa stream, tools, retries |

## Decisão

**Vercel AI SDK** (`ai`, `@ai-sdk/*` conforme provider) em `src/features/ai/`.

- Resolução de modelo: `getAiModel()` + `buildProviderOptions()`
- Catálogo D1: `ai_providers`, `ai_models` — escopo `user_id`
- Default de modelo: tabela `config` (por usuário)
- Agents, tools, pipeline: `src/features/ai/`; rotas API finas; `resolveToolsForAgent()`
- Telemetria: `llm_logs` com `user_id`

## Consequências

- Keys criptografadas em D1 (`config-encryption`)
- Testes mockam `@/features/ai/` ou `fetch` — nunca chamada real no CI
- **Proibido:** SDK de IA em componentes client; API keys em vars de produção no `wrangler.jsonc`

## Confirmação

```bash
grep -q '"ai"' package.json
test -d src/features/ai
! grep -r '@ai-sdk' src --include='*.tsx' --exclude-dir=tests 2>/dev/null | grep -v test | head -1
npm run typecheck
```

## Notas

UI de config: SPEC-0002. Cookbook de agents: `src/features/ai/AGENTS.md`.
