# Infra — Study App

## Runtime

Cloudflare Workers via TanStack Start. Entry: `wrangler.jsonc` → `@tanstack/react-start/server-entry`.
Vite: `@cloudflare/vite-plugin` + `tanstackStart()` em `vite.config.ts`.
`nodejs_compat` habilitado.

## Bindings (`wrangler.jsonc`)

| Binding         | Tipo                  | Uso                                          |
| --------------- | --------------------- | -------------------------------------------- |
| `DB`            | D1 `study-app-db`     | Metadados, config, exams, attempts, llm logs |
| `FILES_BUCKET`  | R2 `study-app-files`  | PDFs e arquivos de prova                     |
| `MEMORY_BUCKET` | R2 `study-app-memory` | Conteúdo markdown da camada de memória       |

Vars default: `AI_MODEL=openai/gpt-4o-mini` (fallback legado). Providers/models/API keys via `/config` → tabelas `ai_providers` + `ai_models`; seleção em `config` KV.

## Banco (D1 + Drizzle)

- Schema: `src/db/schema.ts`
- Queries: `src/db/queries/` → classe `DBQueries` (mixin `Object.assign`)
- Migrations: `migrations/` geradas por `drizzle-kit`
- Config local: `drizzle.config.ts`

```bash
npm run db:generate       # gerar migration após schema change
npm run db:migrate        # aplicar local (wrangler D1 --local)
npm run db:migrate:prod   # aplicar remoto
npm run db:reset          # reset local (destrutivo)
```

`postinstall` roda `cf-typegen` + `db:migrate` local.

## Acesso a bindings no código

`getDB()`, `getFilesBucket()`, `getMemoryBucket()` usam fallback chain + `dynamic import("cloudflare:workers")` com `/* @vite-ignore */`. Nunca import estático.

Env tipado: `src/env.ts` (`@t3-oss/env-core` + Zod). Tipos gerados: `worker-configuration.d.ts` (`npm run cf-typegen`).

## Memória híbrida R2+D1

Implementação: `src/lib/memory/`. R2 guarda blobs markdown; D1 guarda metadata + `search_text` (truncado 4k). Não confundir com stub `src/db/queries/memory.ts`.

## Deploy

```bash
npm run deploy   # vite build + wrangler deploy
```

Observability e source maps habilitados no wrangler.

## O que NÃO fazer

- Supabase CLI / adapters externos para D1
- Armazenar PDFs ou conteúdo grande só em D1
- `pdf-parse` em Workers (não suportado)
- Commitar API keys — usar config persistida em D1
