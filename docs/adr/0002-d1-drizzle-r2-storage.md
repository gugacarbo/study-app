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
- IDs de domínio como **UUID text** (não integer auto-increment)

## Opções consideradas

| Opção                    | Veredito                                          |
| ------------------------ | ------------------------------------------------- |
| D1 + R2 + Drizzle + UUID | **Escolhida**                                     |
| Só D1                    | PDFs e chat inviáveis                             |
| Postgres externo         | Latência + segundo serviço                        |
| Integer PKs (legado)     | Rejeitado — UUID alinha com Better Auth e R2 keys |

## Decisão

| Binding                  | Uso                                                            |
| ------------------------ | -------------------------------------------------------------- |
| `DB` (D1 `study-app-db`) | Metadados, auth, texto pesquisável (truncado), FKs             |
| `FILES_BUCKET` (R2)      | Arquivos de prova (**v1: `.txt` / `.md` apenas** — ver abaixo) |
| `MEMORY_BUCKET` (R2)     | Markdown de memória, payloads de chat                          |

Schema: `src/db/schema.ts`. Migrations: `migrations/`.

**Queries:** `src/db/queries/` — **módulos por domínio** (`exams.ts`, `files.ts`, `ai-providers.ts`, …). Sem classe `DBQueries` monolítica (mixin legado).

**IDs:** PKs `text` UUID v4 (ou equivalente gerado no app) para `exams`, `questions`, `attempts`, `files`, `ai_providers`, etc. `user.id` e `chat_conversations.id` já text (Better Auth / app). Detalhe de tabelas: SPEC-0001.

Acesso: `getDB()`, `getFilesBucket()`, `getMemoryBucket()` em `src/functions/db.ts` e `storage.ts` — dynamic import `cloudflare:workers`, nunca estático.

**R2:** todo `get`/`put`/`delete`/`head`/`list` via wrapper auditado (`src/lib/r2-audit.ts`) — log em `r2_operation_logs` (ADR-0005).

Toda entidade de domínio raiz inclui `user_id` (ADR-0003). Metadados D1 referenciam blobs via `r2_key`.

### Formatos de upload (ingest v1)

| Formato       | v1                                                                                  |
| ------------- | ----------------------------------------------------------------------------------- |
| `.txt`, `.md` | **Suportado** — texto extraído no Worker (`TextDecoder`)                            |
| `.pdf`        | **Não suportado** na v1 — sem parser PDF no Worker (`pdf-parse` proibido, ADR-0001) |

Upload de PDF rejeitado na UI e no servidor (validação MIME/extensão). Suporte a PDF exige ADR futura (vision LLM ou lib Workers-compat).

## Consequências

- `npm run db:generate` após mudança de schema; `db:migrate` no `postinstall` (quando migrations existirem)
- Upload: spec define compensação se R2 falhar após insert D1
- **Proibido:** Supabase CLI; PDF inteiro só em D1; blob grande em `text` sem R2; integer PK em tabelas novas; acesso R2 direto sem auditoria; `DELETE` em tabelas de log

## Confirmação

```bash
grep -q 'FILES_BUCKET' wrangler.jsonc && grep -q 'MEMORY_BUCKET' wrangler.jsonc
test -f src/db/schema.ts && test -d migrations/
test -d src/db/queries
npm run typecheck
```

## Notas

Comandos e bindings: `docs/context/INFRA.md`. Tabelas e FKs: SPEC-0001.
