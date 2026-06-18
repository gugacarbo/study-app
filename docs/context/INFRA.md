# Infra — Study App

## Runtime

Cloudflare Workers via TanStack Start. Entry: `wrangler.jsonc` → `@tanstack/react-start/server-entry`.
Vite: `@cloudflare/vite-plugin` + `tanstackStart()` em `vite.config.ts`.
`nodejs_compat` habilitado.

## Bindings (`wrangler.jsonc`)

| Binding         | Tipo                   | Uso                                          |
| --------------- | ---------------------- | -------------------------------------------- |
| `DB`            | D1 `study-app-db`      | Metadados, config, exams, attempts, llm logs |
| `FILES_BUCKET`  | R2 `study-app-files`   | Arquivos de prova (v1: `.txt`/`.md`)         |
| `MEMORY_BUCKET` | R2 `study-app-memory`  | Conteúdo markdown da camada de memória       |
| `JOB_QUEUE`     | Queue `study-app-jobs` | Jobs longos server-side (ADR-0009)           |

Vars: `ALLOWED_SIGNUP_EMAIL_DOMAINS=aluno.ifsc.edu.br`, `EMAIL_FROM_ADDRESS=noreply@gugacarbo.space`, `EMAIL_FROM_NAME`, `BETTER_AUTH_URL`, `ADMIN_EMAILS` (bootstrap admin no signup — ADR-0004).
Secrets: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `CONFIG_ENCRYPTION_KEY` (base64 32 bytes — `openssl rand -base64 32`).

## Email (Resend)

Magic link (SPEC-0000 / ADR-0003). **Sem** binding `send_email` no wrangler.

| Config v1        | Valor                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| Allowlist signup | `aluno.ifsc.edu.br`                                                            |
| From             | `noreply@gugacarbo.space`                                                      |
| API              | `POST https://api.resend.com/emails` + `Authorization: Bearer $RESEND_API_KEY` |

Domínio `gugacarbo.space` verificado no dashboard Resend. Dev: logar link no console.

Vars legado: `AI_MODEL` em `wrangler.jsonc`. Providers/models por usuário → `ai_providers` + `ai_models`.

## Auditoria (ADR-0005)

- `llm_logs` — toda chamada LLM; append-only
- `r2_operation_logs` — todo get/put/delete/head/list em R2; append-only
- Wrappers: `src/lib/llm-logging.ts`, `src/lib/r2-audit.ts`
- `AI_LOG_LLM_CONTENT` — só controla se payload textual é gravado; **não** desliga o registro

## Banco (D1 + Drizzle)

- Schema: `src/db/schema.ts` — PKs de domínio **UUID text** (SPEC-0001)
- Queries: `src/db/queries/` — módulos por domínio (`exams.ts`, `files.ts`, …)
- Migrations: `migrations/` geradas por `drizzle-kit`
- Config local: `drizzle.config.ts`

```bash
npm run db:generate       # gerar migration após schema change
npm run db:migrate        # aplicar local (wrangler D1 --local)
npm run db:migrate:prod   # aplicar remoto
npm run db:reset          # reset local (destrutivo)
```

`postinstall` roda `cf-typegen` (e `db:migrate` local quando migrations existirem).

## Acesso a bindings no código

`getDB()`, `getFilesBucket()`, `getMemoryBucket()` usam fallback chain + `dynamic import("cloudflare:workers")` com `/* @vite-ignore */`. Nunca import estático.

Env tipado: `src/env.ts` (`@t3-oss/env-core` + Zod). Tipos gerados: `worker-configuration.d.ts` (`npm run cf-typegen`).

## Memória híbrida R2+D1

Implementação: `src/lib/memory/`. R2 guarda blobs markdown; D1 guarda metadata + `search_text` (truncado 4k).

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
