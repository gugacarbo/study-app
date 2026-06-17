---
status: accepted
date: 2026-06-17
builds-on: [ADR-0002, ADR-0004]
implemented-by: []
---

# Schema D1 v1 clean slate com isolamento por usuário

> Convenções: `docs/context/CONVENTIONS.md` · Bindings: `docs/context/INFRA.md`

## Objetivo

Schema D1 único (Drizzle) para Better Auth + domínios do app, com isolamento por `user_id`. Migrations legadas substituídas — cutover v1 com `db:reset` (sem dados legados). **v1: apenas hard delete** (sem soft delete).

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
| `exams` | | `(user_id)`, `(user_id, created_at)` |
| `ai_providers` | | `(user_id)` |
| `ai_models` | FK `provider_id` | `(provider_id)`, unique `(provider_id, model_id)` |
| `config` | PK `(user_id, key)` | — |
| `llm_logs` | | `(user_id, created_at)`, unique `call_id` |
| `memory_profile` | **PK = `user_id`** (1 perfil por usuário) | PK `user_id` |
| `memory_sessions` | | `(user_id, topic)` |
| `memory_topic_notes` | | unique `(user_id, topic_slug)` |
| `memory_documents` | | `(user_id, doc_type)` |
| `chat_conversations` | `id` text PK | `(user_id, updated_at)` |

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
| Delete `user` | cascade em todas as raízes |
| Delete `exam` | cascade questions, attempts, files |
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

- Parâmetro `userId` obrigatório nas raízes
- `getExamById(id, userId)` → `null` se ownership falhar → caller retorna 404

## Casos de borda

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
|---|---|---|
| 1 | `user` deletado | cascade dados do usuário |
| 2 | `exam` deletado | cascade filhos |
| 3 | insert sem `user_id` | constraint / Zod fail |
| 4 | query filha sem checar ownership | bug |
| 5 | segundo `memory_profile` mesmo `user_id` | PK violation |
| 6 | `db:reset` local | schema vazio; app sobe |

## Questões em aberto

(nenhuma)

## Definition of Done

```bash
npm run typecheck                                    # exit 0
npm run db:generate                                  # exit 0
npm run db:reset                                     # exit 0
npm test -- tests/db/schema.test.ts                  # verdes
npm test -- tests/db/queries/user-scoping.test.ts    # verdes
```

## Revisão humana

- `db:reset` / migrate prod — destrutivo

## Verificação

```text
(preencher no fechamento)
```
