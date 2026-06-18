---
status: implemented
date: 2026-06-17
builds-on: [ADR-0007, ADR-0008, ADR-0009, ADR-0002, ADR-0005, SPEC-0001, SPEC-0002, SPEC-0003]
implemented-by:
  - src/features/ai/jobs/ingest/run-ingest.ts
  - src/features/ai/jobs/ingest/extracted-question.ts
  - src/features/ai/jobs/ingest/normalize-question.ts
  - src/features/ai/jobs/ingest/ingest-events.ts
  - src/features/ai/jobs/ingest/persist-questions.ts
  - src/features/ai/jobs/run-job-consumer.ts
  - src/db/queries/jobs.ts
  - src/db/queries/questions.ts
  - src/db/queries/exams.ts
  - src/functions/jobs/create-ingest-job.ts
  - src/functions/jobs/upload-ingest-file.ts
  - src/functions/jobs/get-job-events.ts
  - src/functions/jobs/stream-job-events.ts
  - src/functions/jobs/cancel-job.ts
  - src/routes/api/jobs/
  - src/workers/job-consumer.ts
  - src/worker-entry.ts
  - src/functions/queue.ts
  - src/features/exams/components/ingest-upload-form.tsx
  - src/features/exams/hooks/use-ingest-job.ts
  - src/routes/exams/new/index.tsx
  - src/lib/job-kinds.ts
  - src/lib/job-errors.ts
  - src/lib/ingest-limits.ts
  - src/lib/file-validation.ts
  - wrangler.jsonc
---

# Pipeline de ingestão: arquivo → questões

> Convenções: `docs/context/CONVENTIONS.md` · Jobs: ADR-0009 · Stream UI: ADR-0008 · Modelo: SPEC-0003 · Blobs: SPEC-0002 · Schema: SPEC-0001

## Objetivo

Usuário autenticado envia um arquivo de prova (`.txt`/`.md`) e, ao concluir o job `ingest`, tem questões persistidas em D1 no exame alvo — prontas para catálogo (SPEC-0005) e quiz (SPEC-0006).

Por padrão cada upload **cria um exame novo** (nome + arquivo na mesma ação). Opcionalmente o usuário pode apontar um `examId` existente para **append** (somar questões, sem remover as existentes).

Progresso do job sobrevive a refresh (ADR-0009 + ADR-0008). Explicações (`explanation`, `deep_explanation`) ficam para SPEC-0008.

## Fluxo

### A — Novo exame (padrão)

1. Usuário informa `name` do exame, seleciona arquivo `.txt`/`.md` e opcionalmente `modelId`.
2. `POST /api/jobs` com `kind: "ingest"`, `name`, `modelId?` → servidor:
   - valida sessão;
   - resolve modelo via `getAiModel({ userId, modelId })` (SPEC-0003);
   - insert `exams` com UUID + `name` (`source` null até upload);
   - insert `background_jobs` (`kind=ingest`, `status=awaiting_upload`, `metadata` com `examId`, `modelId`, `mode: "create"`);
   - retorna `{ jobId, examId }`.
3. Client envia arquivo: `POST /api/jobs/:id/upload` (multipart) — browser deve permanecer conectado (ADR-0009).
4. Servidor valida extensão/MIME (ADR-0002), tamanho bruto ≤ **512 KB**, decodifica UTF-8 (inválidos → U+FFFD), tamanho de texto ≤ **10_000** caracteres, grava blob R2 + row `files` (`ttl_seconds` default **0**), atualiza `exams.source` = nome original do arquivo, enfileira job (`status=queued`).
5. Consumer Queue (ADR-0009) — **só processa se `status=queued`**; `running`/`completed`/`failed`/`cancelled` → no-op (idempotência):
   - `status=running`, `phase=reading_file`;
   - lê blob R2 (`TextDecoder`), valida não-vazio;
   - `phase=extracting` — `streamObject` + schema Zod `{ questions: [...] }` (ver contrato LLM);
   - emite eventos de progresso (data parts) a cada partial object;
   - **após stream completo:** `phase=persisting` — insert batch de `questions` (dedup);
   - `status=completed` + metadata final (`phase` permanece `persisting` ou omitido — **não** usar `phase=completed`).
6. UI reidrata progresso via poll/SSE (ADR-0008); shell genérico em SPEC-0011.

### B — Append em exame existente

1. Usuário escolhe exame existente e arquivo; opcionalmente `modelId`.
2. `POST /api/jobs` com `kind: "ingest"`, `examId`, `modelId?` (sem `name`).
3. Servidor valida ownership do `examId`; rejeita **409** se já existir job `ingest` do mesmo user no mesmo `examId` com `status` ∈ `awaiting_upload`, `queued`, `running`; `metadata.mode = "append"`.
4. Upload e consumer iguais ao fluxo A; persistência **append-only** — questões existentes intactas.
5. Questão cuja normalização de enunciado já existe no exame → **skip** (não insert); evento `data-ingest-skipped-duplicate`.

### Cancelamento

1. `POST /api/jobs/:id/cancel` (ADR-0009).
2. Consumer verifica entre steps; questões já persistidas **permanecem** (sem rollback).

## Contrato

### Entrada do job (`POST /api/jobs`)

| Campo      | Obrigatório | Regra                                                                 |
| ---------- | ----------- | --------------------------------------------------------------------- |
| `kind`     | sim         | `"ingest"`                                                            |
| `name`     | condicional | Obrigatório se **sem** `examId` — nome do novo exame                 |
| `examId`   | condicional | UUID de exame existente; ownership = sessão; **proibido** com `name` |
| `modelId`  | não         | UUID `ai_models.id`; default = `getAiModel()` sem override            |
| `ttlSeconds` | não       | Repassado ao insert `files`; default **0** (sem expiração — SPEC-0002) |

Resposta: `{ jobId: string, examId: string }`.

Erros: sem modelo resolvível → **400**; validação Zod → **400**; `examId` de outro user → **404**; job ingest ativo no mesmo `examId` (append) → **409**.

Modo create: job failed (upload ou pipeline) com `persistedCount = 0` → **exame permanece** (vazio); usuário pode append, novo job ou apagar via SPEC-0005.

### Upload (`POST /api/jobs/:id/upload`)

| Regra              | Valor v1                                      |
| ------------------ | --------------------------------------------- |
| Formatos           | `.txt`, `.md` — MIME/extensão (ADR-0002)      |
| Tamanho bruto      | **512 KB** no multipart                       |
| Tamanho texto      | **10_000** caracteres após `TextDecoder`      |
| Encoding           | UTF-8; bytes inválidos → U+FFFD (replacement char) — **sem** rejeitar |
| Campo multipart    | `file`                                        |
| Job                | `kind=ingest`, `status=awaiting_upload`, ownership |

Arquivo acima de 512 KB → **413** `{ error: "file_too_large", maxBytes: 524288 }`.  
Texto acima de 10_000 caracteres → **413** `{ error: "file_too_large", maxChars: 10000 }`.  
Arquivo vazio / só whitespace → **400** `{ error: "empty_file" }`.  
`exam` deletado antes do upload completar → **400** `{ error: "exam_not_found" }`; job → `failed`.

### `background_jobs.metadata` (JSON)

| Chave                 | Quando        | Conteúdo                                      |
| --------------------- | ------------- | --------------------------------------------- |
| `examId`              | sempre        | UUID do exame alvo                            |
| `fileId`              | pós-upload    | UUID `files.id`                               |
| `fileName`            | pós-upload    | Nome original do arquivo                      |
| `modelId`             | sempre        | Modelo usado na extração                      |
| `mode`                | sempre        | `"create"` \| `"append"`                      |
| `extractedCount`      | fim           | Questões extraídas pelo LLM (pré-dedup)       |
| `persistedCount`      | fim           | Questões inseridas                            |
| `skippedDuplicateCount` | fim        | Skips por dedup (create e append)             |
| `invalidCount`        | fim           | Itens que falharam Zod pós-stream             |
| `warning`             | fim (opcional) | `"partial_extraction"` se `invalidCount > 0` |

### `background_jobs.phase` (vocabulário v1)

| Valor           | Significado                          |
| --------------- | ------------------------------------ |
| `reading_file`  | Lendo/decodificando blob R2          |
| `extracting`    | `streamObject` em andamento          |
| `persisting`    | Insert batch em `questions`          |

`status=awaiting_upload` é **status**, não `phase` (ADR-0009). Consumer **não** define `phase=completed`.

### Formato de questão extraída (Zod / LLM)

Objeto raiz do stream:

```ts
{ questions: ExtractedQuestion[] }
```

Objeto por questão (`ExtractedQuestion`):

```ts
{
  question: string;       // enunciado — trim; min 1 char
  options: Array<{ key: string; text: string }>;  // min 2 options; key única por questão (A–Z)
  answers: string[];      // keys presentes em options; min 1
  topic: string;          // classificação curta — trim; min 1 char
}
```

Persistência em `questions`:

| Coluna DB           | Origem / regra                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| `question`          | `question`                                                                     |
| `options`           | `JSON.stringify(options)`                                                      |
| `answers`           | `JSON.stringify(answers)`                                                      |
| `topic`             | `topic`                                                                        |
| `scoring_mode`      | `answers.length === 1` → `"exact"`; `answers.length > 1` → `"partial"`        |
| `explanation`       | `null`                                                                         |
| `deep_explanation`  | `null`                                                                         |

Validação pós-LLM (Zod):

- cada `answers[i]` existe como `options[].key`;
- `options[].key` trim, 1 char, `[A-Z]` na v1;
- `options[].text` trim, min 1 char;
- duplicata de `key` dentro da mesma questão → inválida.

### Dedup (create e append)

Função `normalizeQuestionText(text: string): string`:

1. `trim`;
2. colapsar runs de whitespace (`/\s+/g` → espaço simples);
3. `toLowerCase()`.

Skip insert quando já existir questão no mesmo `exam_id` com mesmo `normalizeQuestionText(question)` — inclui **duplicatas intra-arquivo** no create e vs DB no append.

Durante persist batch: manter set de normalizados já vistos **neste job** para dedup intra-arquivo sem round-trip extra.

### LLM (single-pass)

| Peça            | Regra                                                                 |
| --------------- | --------------------------------------------------------------------- |
| API             | `streamObject` (AI SDK v6) — schema raiz `{ questions: ExtractedQuestion[] }` |
| Modelo          | `getAiModel({ userId, modelId })` no consumer; indisponível → `failed` / `model_unavailable` |
| Calls           | **1** stream por job — sem chunking v1                                |
| Retry           | Até **2** retries com backoff em erro transitório (timeout, 429, 5xx) |
| Teto            | Máx. **100** questões persistidas por job; excedente → `invalidCount` |
| Persistência    | **Batch** após stream completo — não insert incremental durante stream |
| Idempotência    | Consumer processa só jobs com `status=queued`                           |
| System prompt   | Extrair questões objetivas de prova universitária; preencher `topic`  |
| Eventos         | Cada partial object → append `background_job_events` (ADR-0008)       |

Implementação: `src/features/ai/jobs/ingest/` (pipeline + schema Zod).

### Eventos de progresso (data parts)

Payloads em `background_job_events` seguem AI SDK v6. Parts específicos de ingest:

| Part type                      | Quando                    | Payload (exemplo)                                      |
| ------------------------------ | ------------------------- | ------------------------------------------------------ |
| `data-ingest-phase`            | mudança de `phase`        | `{ phase: "extracting" }`                              |
| `data-ingest-stream-progress`  | partial `streamObject`    | `{ questionsSeen: number }`                            |
| `data-ingest-skipped-duplicate` | skip na persistência   | `{ questionPreview: string }` — primeiros 80 chars     |
| `data-ingest-summary`          | fim `persisting`          | `{ extracted, persisted, skippedDuplicate, invalid }`  |

Mensagens de texto assistant-ui opcionais para leitura humana (“12 questões salvas…”).

UI genérica (dialog, nav, poll): **SPEC-0011** — esta spec só define parts acima.

### Resultado do job

| Situação                                      | `status`    | `error` / `warning`                          |
| --------------------------------------------- | ----------- | -------------------------------------------- |
| ≥1 questão persistida, `invalidCount = 0`     | `completed` | —                                            |
| ≥1 persistida, `invalidCount > 0`             | `completed` | `metadata.warning = "partial_extraction"`    |
| 0 persistidas (todas inválidas ou LLM vazio)  | `failed`    | `"no_valid_questions"`                       |
| Erro R2 / LLM / DB irrecuperável              | `failed`    | mensagem curta (sem vazar key)               |
| Cancelado                                     | `cancelled` | —                                            |

**Nota:** `extractedCount > 0` mas `persistedCount = 0` por dedup total no append → `failed` / `"no_valid_questions"`.

### Rotas HTTP (ingest)

Reutiliza rotas genéricas ADR-0009:

| Método | Rota                         | Uso ingest                          |
| ------ | ---------------------------- | ----------------------------------- |
| POST   | `/api/jobs`                  | Criar job `ingest`                  |
| POST   | `/api/jobs/:id/upload`       | Upload arquivo                      |
| GET    | `/api/jobs/:id/events`       | Poll eventos                        |
| GET    | `/api/jobs/:id/stream`       | SSE tail (painel aberto)            |
| POST   | `/api/jobs/:id/cancel`       | Cancelar                            |

Handlers finos em `src/routes/api/jobs/`; lógica em `src/features/ai/jobs/ingest/`.

### Implementação

| Peça              | Path                                              |
| ----------------- | ------------------------------------------------- |
| Pipeline ingest   | `src/features/ai/jobs/ingest/run-ingest.ts`       |
| Schema Zod LLM    | `src/features/ai/jobs/ingest/extracted-question.ts` |
| Normalização dedup| `src/features/ai/jobs/ingest/normalize-question.ts` |
| Consumer branch   | `src/features/ai/jobs/run-job-consumer.ts` — `case "ingest"` |
| Queries exams     | `src/db/queries/exams.ts` — create, getById       |
| Queries questions | `src/db/queries/questions.ts` — insert, listByExam, existsNormalized |
| Queries jobs      | `src/db/queries/jobs.ts`                          |
| Rotas API         | `src/routes/api/jobs/`                            |
| UI upload (v1 mín.) | `src/features/exams/` + rota fina (detalhe SPEC-0005) |

## Casos de borda

| #   | QUANDO ⟨gatilho⟩                                      | o sistema DEVE ⟨resposta⟩                                      |
| --- | ----------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `POST /api/jobs` sem `name` e sem `examId`            | **400**                                                        |
| 2   | `POST /api/jobs` com `name` e `examId`                | **400**                                                        |
| 3   | `examId` de outro `user_id`                           | **404**                                                        |
| 4   | sem modelo default e sem `modelId` válido             | **400** antes de criar job                                     |
| 5   | arquivo > 512 KB brutos                               | **413** no upload                                              |
| 6   | texto > 10_000 caracteres após decode                 | **413** no upload                                              |
| 7   | arquivo vazio ou só whitespace                        | **400** no upload                                              |
| 8   | extensão/MIME não `.txt`/`.md`                        | **400** (ADR-0002)                                             |
| 9   | LLM retorna 0 questões                                | job **`failed`** / `no_valid_questions`                        |
| 10  | M questões inválidas, N válidas (N ≥ 1)               | persistir N; **`completed`** + `warning: partial_extraction`   |
| 11  | enunciado normalizado já existe (create ou append)    | skip; incrementar `skippedDuplicateCount`; evento data part    |
| 12  | todas duplicatas ou inválidas (persistedCount = 0)    | **`failed`** / `no_valid_questions`                            |
| 13  | upload abortado (browser)                             | job permanece **`awaiting_upload`** — reenvio no mesmo `jobId`  |
| 14  | cancel durante `extracting` ou `persisting`           | **`cancelled`**; questões já persistidas mantidas              |
| 15  | `answers` referencia key inexistente em `options`     | questão inválida; conta em `invalidCount`                        |
| 16  | job `ingest` com exam deletado no consumer            | **`failed`** (exam missing)                                    |
| 17  | exam deletado antes do upload                         | upload **400** / `exam_not_found`; job **`failed`**            |
| 18  | re-upload no mesmo job após `completed`               | **400** — criar novo job                                       |
| 19  | segundo job ingest ativo no mesmo `examId` (append)   | **409** no `POST /api/jobs`                                    |
| 20  | consumer dequeue com `status` ≠ `queued`              | no-op (idempotência)                                           |
| 21  | modelo desabilitado/removido no consumer              | **`failed`** / `model_unavailable`                             |
| 22  | > 100 questões válidas no stream                      | persistir até 100; restante → `invalidCount` + warning         |
| 23  | create mode: job failed, persistedCount = 0           | **exame permanece** vazio                                      |
| 24  | LLM falha após 2 retries                              | job **`failed`**                                               |

## Questões em aberto

(nenhuma)

## Definition of Done

```bash
npm run typecheck
npm test -- src/features/ai/jobs/ingest/
npm test -- src/db/queries/questions.test.ts
npm test -- src/routes/api/jobs/
grep -rq 'JOB_KIND.INGEST' src/features/ai/jobs/
grep -rq 'streamObject' src/features/ai/jobs/ingest/
grep -rq 'data-ingest-phase' src/features/ai/jobs/ingest/
npm run docs-check
```

## Revisão humana

- Smoke: upload `.md` pequeno → questões visíveis no exame (após SPEC-0005 ou query D1)
- Confirmar limite 10k chars + 512 KB aceitável para provas reais do IFSC
- Validar qualidade de `topic` com modelo default em prod
- UTF-8 com replacement char — revisar se provas reais ficam legíveis

## Verificação

```text
npm run typecheck                                              # exit 0
npm test -- src/features/ai/jobs/ingest/                       # 17 passed (4 files)
npm test -- src/db/queries/questions.test.ts                   # 4 passed
npm test -- src/routes/api/jobs/ src/functions/jobs/           # 19 passed (5 files)
grep -rq 'JOB_KIND.INGEST' src/features/ai/jobs/             # ok
grep -rq 'streamObject' src/features/ai/jobs/ingest/          # ok
grep -rq 'data-ingest-phase' src/features/ai/jobs/ingest/     # ok
npm run docs-check -- --emit-index                               # exit 0 (índices regenerados)
```
