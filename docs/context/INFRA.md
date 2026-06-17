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

Vars: `ALLOWED_SIGNUP_EMAIL_DOMAINS=ifsc.edu.br`, `EMAIL_FROM_ADDRESS=noreply@gugacarbo.space`, `EMAIL_FROM_NAME`, `BETTER_AUTH_URL`.
Secrets: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`.

## Email (Resend)

Magic link (SPEC-0000 / ADR-0004). **Sem** binding `send_email` no wrangler.

| Config v1 | Valor |
|-----------|--------|
| Allowlist signup | `ifsc.edu.br` |
| From | `noreply@gugacarbo.space` |
| API | `POST https://api.resend.com/emails` + `Authorization: Bearer $RESEND_API_KEY` |

Domínio `gugacarbo.space` verificado no dashboard Resend. Dev: logar link no console.

Vars legado: `AI_MODEL` em `wrangler.jsonc`. Providers/models por usuário → `ai_providers` + `ai_models`.

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
