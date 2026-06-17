---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001]
deciders: []
---

# Usar D1 + Drizzle para metadados e R2 para blobs

## Contexto e problema

Persistir dados multi-usuário (exames, questões, tentativas, auth, config IA, logs, memória). PDFs e payloads grandes excedem limite prático de linha D1 (~1 MB). Schema v1 nasce clean slate (SPEC-0001).

## Direcionadores da decisão

- SQLite no edge (D1), sem Postgres gerenciado
- ORM tipado + migrations versionadas (Drizzle)
- Blobs fora do relacional
- Auth (Better Auth) e domínio no **mesmo** D1

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| D1 + R2 + Drizzle | **Escolhida** |
| Só D1 | PDFs e chat inviáveis |
| Postgres externo | Latência + segundo serviço |

## Decisão

| Binding | Uso |
|---------|-----|
| `DB` (D1 `study-app-db`) | Metadados, auth, texto pesquisável (truncado), FKs |
| `FILES_BUCKET` (R2) | PDFs e arquivos de prova |
| `MEMORY_BUCKET` (R2) | Markdown de memória, payloads de chat |

Schema: `src/db/schema.ts`. Migrations: `migrations/`. Queries: `src/db/queries/` (`DBQueries` via mixin).

Acesso: `getDB()`, `getFilesBucket()`, `getMemoryBucket()` — dynamic import `cloudflare:workers`, nunca estático.

Toda entidade de domínio inclui `user_id` (ADR-0004). Metadados D1 referenciam blobs via `r2_key`.

## Consequências

- `npm run db:generate` após mudança de schema; `db:migrate` no `postinstall`
- Upload: spec define compensação se R2 falhar após insert D1
- **Proibido:** Supabase CLI; PDF inteiro só em D1; blob grande em `text` sem R2

## Confirmação

```bash
grep -q 'FILES_BUCKET' wrangler.jsonc && grep -q 'MEMORY_BUCKET' wrangler.jsonc
test -f src/db/schema.ts && test -d migrations/
npm run typecheck
```

## Notas

Comandos e bindings: `docs/context/INFRA.md`. Tabelas e FKs: SPEC-0001.
