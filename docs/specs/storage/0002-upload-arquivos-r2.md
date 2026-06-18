---
status: implemented
date: 2026-06-17
builds-on: [ADR-0002, ADR-0003, ADR-0005]
implemented-by:
  - src/db/queries/files.ts
  - src/functions/storage/upload-file.ts
  - src/functions/storage/read-file.ts
  - src/functions/storage/purge-expired-blobs.ts
  - src/workers/cron.ts
  - src/worker-entry.ts
  - wrangler.jsonc
---

# Upload de arquivos em R2 com TTL configurável

> Convenções: `docs/context/CONVENTIONS.md` · Schema `files`: SPEC-0001 · Bindings: `docs/context/INFRA.md`

## Objetivo

Usuário autenticado envia arquivos de prova (`.txt`/`.md` na v1) para R2; metadados ficam em D1 (`files`). Cada blob tem **TTL em segundos** no banco; um **processo diário** remove blobs vencidos (R2 + linha D1). **`ttl_seconds = 0` nunca expira por tempo de vida** — só sai por delete explícito ou cascade do `exam`.

## Fluxo

### Upload

1. Client envia arquivo (multipart ou via job ingest — ADR-0009).
2. Servidor valida sessão, ownership do `exam_id`, extensão/MIME (`.txt`/`.md` apenas — ADR-0002).
3. Gera UUID para `files.id` e `r2_key` (`users/{userId}/files/{uuid}-{filename}`).
4. `put` em R2 via wrapper auditado (`r2-audit.ts` — ADR-0005).
5. Insert em `files` com `ttl_seconds` (default **0** se omitido).
6. Falha R2 após insert D1 → compensação (delete row ou retry — implementação deve ser idempotente).

### Purge diário (TTL)

1. **Cron** Cloudflare dispara 1×/dia (UTC) — ex.: `0 4 * * *` em `wrangler.jsonc`.
2. Handler `purgeExpiredBlobs()` em `src/functions/storage/purge-expired-blobs.ts` (ou worker dedicado).
3. Query D1: linhas com `ttl_seconds > 0` **e** `datetime(created_at, '+' || ttl_seconds || ' seconds') < datetime('now')` (UTC).
4. Para cada linha vencida (batch limitado por invocação):
   - `delete` no R2 via wrapper auditado (`r2_operation_logs` — ADR-0005).
   - `DELETE` da row em `files` (hard delete).
5. Linhas com `ttl_seconds = 0` **não entram** na query — nunca removidas por este job.
6. Erro em um item → logar; continuar batch; item permanece para próxima execução.

### Leitura / download

1. Resolver `files` por `id` + ownership via `exam.user_id`.
2. `get` R2 por `r2_key` via wrapper auditado.

## Contrato

### Tabela `files` (coluna TTL — detalhe em SPEC-0001)

| Coluna        | Tipo                       | Regra                                                                  |
| ------------- | -------------------------- | ---------------------------------------------------------------------- |
| `ttl_seconds` | integer NOT NULL DEFAULT 0 | Segundos de vida desde `created_at`. **0 = sem expiração automática.** |

Vencimento: `expires_at` implícito = `created_at + ttl_seconds` (não persistir coluna separada na v1).

### API / functions (v1)

| Operação   | Entrada                        | `ttl_seconds`                                      |
| ---------- | ------------------------------ | -------------------------------------------------- |
| Upload     | `examId`, file, `ttl_seconds?` | Opcional; default **0**; se informado, inteiro ≥ 0 |
| Leitura    | `fileId`                       | —                                                  |
| Purge cron | (nenhum — sistema)             | Só processa `ttl_seconds > 0`                      |

Validação Zod: `ttl_seconds` inteiro, `min(0)`, `max` razoável (ex.: 10 anos em segundos) — evitar overflow acidental.

### Cron

| Peça        | Valor                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| Binding     | `wrangler.jsonc` → `triggers.crons`                                     |
| Schedule v1 | `0 4 * * *` (04:00 UTC diário)                                          |
| Entry       | export default handler que chama `purgeExpiredBlobs`                    |
| Batch       | Máx. N rows por run (ex.: 100) — evitar timeout; próximo dia pega resto |

### Implementação

| Peça       | Path                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| Upload     | `src/functions/storage/upload-file.ts`                                  |
| Leitura    | `src/functions/storage/read-file.ts`                                    |
| Purge      | `src/functions/storage/purge-expired-blobs.ts`                          |
| Queries    | `src/db/queries/files.ts` — `getFileByIdWithOwnership`, `listExpiredFiles(limit)`, `deleteFile(id)` |
| Cron route | `src/workers/cron.ts` ou handler no worker principal                    |

## Casos de borda

| #   | QUANDO ⟨gatilho⟩                  | o sistema DEVE ⟨resposta⟩                        |
| --- | --------------------------------- | ------------------------------------------------ |
| 1   | `ttl_seconds = 0`                 | **não** incluir no purge diário                  |
| 2   | `ttl_seconds > 0` e prazo passou  | remover objeto R2 + row `files` no próximo purge |
| 3   | purge encontra row sem objeto R2  | deletar row D1; log warn                         |
| 4   | R2 delete falha                   | manter row; retentar no próximo dia              |
| 5   | `exam` deletado (cascade)         | `files` removidos independente de TTL            |
| 6   | upload com `ttl_seconds` negativo | rejeitar (400 / Zod)                             |
| 7   | cron overlap (run longo)          | idempotente — reprocessar vencidos é seguro      |
| 8   | leitura de arquivo de outro user  | **404** (`getFileByIdWithOwnership`)             |
| 9   | leitura com row D1 mas sem blob R2 | **404**                                          |

## Questões em aberto

(nenhuma)

## Definition of Done

```bash
npm run typecheck                                              # exit 0
npm test -- src/functions/storage/upload-file.test.ts          # verdes
npm test -- src/functions/storage/read-file.test.ts            # verdes
npm test -- src/functions/storage/purge-expired-blobs.test.ts  # verdes
npm test -- src/db/queries/files.test.ts                       # verdes
grep -q 'crons' wrangler.jsonc                                 # purge diário configurado
```

## Revisão humana

- Confirmar horário UTC do cron em prod

## Verificação

```text
npm run typecheck                                              # exit 0
npm test -- src/functions/storage/upload-file.test.ts          # 1 passed
npm test -- src/functions/storage/read-file.test.ts            # 3 passed
npm test -- src/functions/storage/purge-expired-blobs.test.ts  # 1 passed
npm test -- src/db/queries/files.test.ts                       # 3 passed
grep -q 'crons' wrangler.jsonc                                 # ok
```
