# AGENTS.md

```yaml
casa-repo-id: study-app
casa-tier: T1
casa-standard-ref: 546fda2
```

> Padrão: https://github.com/atplus-digital/casa-standard (STANDARD.md)
> ROUTER (CASA §4): carga sempre, teto ~150 linhas. Só alto-ROI transversal.
> Estourou o teto → conteúdo desce para docs/context/, fica o ponteiro.
> ⚠️ NÃO usar @import para colar capítulos: @import expande tudo no launch.
> Regras de um pacote específico → <subdir>/AGENTS.md (lazy nativo, nearest-wins).

**Generated:** 2026-06-11 · **Commit:** pending

## Contexto em 5 linhas

App de estudo para provas: ingestão de PDFs, banco de questões, quiz e chat com IA.
Stack: TanStack Start/Router/Query, React 19, Cloudflare Workers, D1 + Drizzle, R2.
Domínios em `src/features/`; rotas finas em `src/routes/`; server fns em `src/server-functions/`.
Single-user, sem auth. Padrões detalhados em `docs/codebase-patterns.md`.

## Infra & ambientes

Produção e dev: Cloudflare Workers (`wrangler.jsonc`). Bindings: D1 `DB`, R2 `FILES_BUCKET` + `MEMORY_BUCKET`.
Nunca usar ESLint/Prettier — Biome v2. Nunca import estático de `cloudflare:workers`.
Detalhe → `docs/context/INFRA.md`.

## Como rodar localmente

```bash
npm install          # postinstall: cf-typegen + db:migrate local
npm run dev          # Vite :3000
npm run wrangler:dev # alternativa CF nativa
```

## Como validar (DoD global do repo)

```bash
npm run typecheck    # exit 0
npm test             # vitest run — tudo verde
npm run check        # biome check (opcional)
python3 scripts/docs-check
```

## Como deployar

```bash
npm run db:generate        # após mudar schema Drizzle
npm run db:migrate:prod    # aplicar migrations em D1 remoto
npm run deploy             # build + wrangler deploy
```

Não commitar secrets. Config de IA via UI `/admin/config` (`/config` redireciona): catálogo em `ai_providers` + `ai_models` (D1); seleção em `config` KV (`ai_default_model_id`, `agent.*.model_id`).
API key por provider, criptografada (`CONFIG_ENCRYPTION_KEY` no `.env` local); endpoints nunca devolvem a key.

## Git & PRs

Remote: `origin` → github.com/gugacarbo/study-app. Branch principal: `main`.
Não commitar nem abrir PR sem pedido explícito do usuário.
CI roda `docs-check` em push/PR; testes e typecheck são locais (ainda sem workflow).

## Gotchas

- `pdf-parse` não roda em Workers — extração de PDF usa fallback próprio
- `getDB()` e buckets R2: `dynamic import("cloudflare:workers")` com `/* @vite-ignore */`
- `src/db/queries/memory.ts` é stub — stats reais em `src/lib/memory/`
- `src/stores/` deprecado — stores em `src/features/{domain}/store/`; jobs longos (ingest, improve-questions, explicações, connection-test, model-benchmark) em `src/features/background-processes/`
- Component tests: usar `*.spec.tsx` (vitest exclui `*.test.tsx`)
- `package.json` `docs-check`: rodar `python3 scripts/docs-check` diretamente se o script npm falhar

## Mapa de contexto

| Capítulo                      | Quando carregar                                 |
| ----------------------------- | ----------------------------------------------- |
| `docs/context/CONVENTIONS.md` | escrever/alterar código, Spec ou endpoint       |
| `docs/context/INFRA.md`       | migration, deploy, bindings CF, D1/R2           |
| `docs/context/TESTS.md`       | escrever ou alterar testes                      |
| `docs/codebase-patterns.md`   | revisar padrões de naming/imports/anti-patterns |

## Onde olhar (AGENTS.md por área)

| Tarefa                    | AGENTS.md               |
| ------------------------- | ----------------------- |
| Rotas / API SSE           | `src/routes/`           |
| Server functions          | `src/server-functions/` |
| Drizzle / queries         | `src/db/`               |
| Memória R2+D1, SSE lib    | `src/lib/`              |
| Módulo IA (agents, tools) | `src/features/ai/`      |
| Features de domínio       | `src/features/`         |
| shadcn / UI compartilhada | `src/components/`       |
| Testes                    | `tests/`                |

## Mapa de docs

- Decisões: `docs/adr/` · Comportamento: `docs/specs/` (READMEs GERADOS — não editar)
- Validar: `scripts/docs-check` · Regenerar índices: `scripts/docs-check --emit-index`
