---
status: accepted
date: 2026-06-17
builds-on: [ADR-0002, ADR-0004, ADR-0007]
implemented-by: []
---

# Schema D1 v1 clean slate com isolamento por usuário

> Convenções: `docs/context/CONVENTIONS.md` · Bindings: `docs/context/INFRA.md`

## Objetivo

Schema D1 único (Drizzle) para Better Auth + domínios do app, com isolamento por `user_id`. Migrations legadas substituídas — cutover v1 com `db:reset` (sem dados legados). **v1: apenas hard delete** (sem soft delete). **PKs de domínio: UUID `text`** (gerados no app; não integer auto-increment).

## Fluxo

### Cutover (v1)

1. Remover migrations antigas.
2. Schema completo em `src/db/schema.ts`.
3. `npm run db:generate` → `0001_*.sql`.
4. `npm run db:reset` local.
5. Prod só após confirmação explícita.

### Evolução

Alterar `schema.ts` → `db:generate` → nova migration; nunca editar migration aplicada em prod.

## Contrato

### IDs (UUID text)

Todas as PKs de domínio (exceto `memory_profile` e `config`) são `text` UUID v4 gerado no servidor no insert. Better Auth já usa `text` para `user.id`.

| Tabela | PK |
|--------|-----|
| `exams`, `questions`, `attempts`, `files` | `id` text UUID |
| `attempt_answers` | `id` text UUID |
| `ai_providers` | `id` text UUID |
| `ai_models` | `id` text UUID |
| `llm_logs` | `id` text UUID; unique `call_id` text |
| `r2_operation_logs` | `id` text UUID |
| `memory_sessions`, `memory_topic_notes`, `memory_documents` | `id` text UUID |
| `chat_conversations` | `id` text UUID |
| `memory_profile` | `user_id` text (PK, não UUID separado) |
| `config` | `(user_id, key)` |

FKs referenciam `text` UUID. URLs e APIs usam o mesmo id string.

### Tabelas Better Auth

Via `npx auth generate --adapter drizzle`, merge em `src/db/schema.ts`:

| Tabela | Uso |
|--------|-----|
| `user` | `id` text PK, `email`, `name`, `emailVerified`, timestamps |
| `session` | Sessões |
| `account` | OAuth futuro |
| `verification` | Tokens magic link |

### Tabelas de domínio — raiz (`user_id` → `user.id` cascade)

| Tabela | Notas | Índices |
|--------|-------|---------|
| `exams` | `id` UUID text PK | `(user_id)`, `(user_id, created_at)` |
| `ai_providers` | `id` UUID text PK | `(user_id)` |
| `ai_models` | `id` UUID text PK; FK `provider_id` | `(provider_id)`, unique `(provider_id, model_id)` |
| `config` | PK `(user_id, key)` | — |
| `memory_profile` | **PK = `user_id`** (1 perfil por usuário) | PK `user_id` |
| `memory_sessions` | | `(user_id, topic)` |
| `memory_topic_notes` | | unique `(user_id, topic_slug)` |
| `memory_documents` | | `(user_id, doc_type)` |
| `chat_conversations` | `id` text PK | `(user_id, updated_at)` |

### Tabelas de auditoria (append-only — ADR-0007)

`user_id` text **obrigatório**, indexado — **sem FK cascade** para `user` (logs persistem após delete de conta).

| Tabela | Notas | Índices |
|--------|-------|---------|
| `llm_logs` | `call_id` unique; `status` pending→success/error uma vez | `(user_id, created_at)`, unique `call_id` |
| `r2_operation_logs` | `bucket`, `operation` (get/put/delete/head/list), `object_key`, `bytes`, `status`, `duration_ms` | `(user_id, created_at)`, `(bucket, created_at)` |

Colunas de payload — texto truncado/redigido; **nunca** omitir a linha de log.

**Proibido na aplicação:** `DELETE` ou `UPDATE` (exceto fechamento de `llm_logs.status` in-flight).

#### `memory_profile` (decisão)

Um registro de perfil de memória **por usuário**. Em vez de `id` integer separado:

```ts
memory_profile: {
  user_id: text PK → user.id,
  r2_key: text not null,
  search_text: text,
  updated_at: text,
}
```

Simplifica “meu perfil” = `WHERE user_id = :sessionUserId` sem join extra.

### Tabelas filhas (sem `user_id` — escopo via pai)

| Tabela | FK |
|--------|-----|
| `questions`, `attempts`, `files` | `exam_id` → `exams` |
| `attempt_answers` | `attempt_id`, `question_id` |
| `ai_models` | `provider_id` → `ai_providers` |

Toda mutação valida `exams.user_id` (ou `ai_providers.user_id`) = sessão.

### Delete

| Ação | Comportamento v1 |
|------|------------------|
| Delete `user` | cascade em raízes de domínio; **`llm_logs` e `r2_operation_logs` permanecem** |
| Delete `exam` | cascade questions, attempts, files |
| Delete log (LLM/R2) | **proibido** |
| Soft delete | **não** na v1 |

### R2 keys

```
users/{userId}/files/{uuid}-{filename}
users/{userId}/memory/{kind}/{id}.md
users/{userId}/chats/{conversationId}.json
```

`r2_key` globally unique onde aplicável.

### `search_text`

Truncar em **4096** chars no write.

### Queries

- Módulos em `src/db/queries/` por domínio (sem classe monolítica)
- Parâmetro `userId` obrigatório nas raízes
- `getExamById(id, userId)` → `null` se ownership falhar → caller retorna 404

## Casos de borda

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
|---|---|---|
| 1 | `user` deletado | cascade domínio; logs de auditoria **mantidos** |
| 2 | `exam` deletado | cascade filhos |
| 3 | insert sem `user_id` | constraint / Zod fail |
| 4 | query filha sem checar ownership | bug |
| 5 | segundo `memory_profile` mesmo `user_id` | PK violation |
| 6 | `db:reset` local | schema vazio; app sobe |

## Questões em aberto

(nenhuma)

## Definition of Done

```bash
npm run typecheck                                              # exit 0
npm run db:generate                                            # exit 0
npm run db:reset                                               # exit 0
npm test -- src/db/schema.test.ts                              # verdes
npm test -- src/db/queries/user-scoping.test.ts                # verdes
```

## Revisão humana

- `db:reset` / migrate prod — destrutivo

## Verificação

```text
(preencher no fechamento)
```
