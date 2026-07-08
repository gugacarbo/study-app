# Task-C-002: Estender monitor e listagens para o novo kind generate-exam

**Status:** DONE

## Commits

Nenhum commit criado — as alterações fazem parte do worktree ativo da branch `codex/0033-geracao-provas-por-conteudo`.

## Arquivos modificados

| Arquivo | Descrição |
|---------|-----------|
| `src/functions/jobs/list-user-jobs.ts` | Adicionado case `JOB_KIND.GENERATE_EXAM` em `getJobTitle()` com parsing de metadata e fallback "Geração de prova" |
| `src/functions/jobs/list-active-jobs.ts` | Estendido `ActiveJobSummary` com `examId` opcional; `toActiveJobSummary()` agora reconhece `GENERATE_EXAM` kind, parseia metadata e expõe phase + examId |
| `src/features/background-processes/lib/ingest-event-labels.ts` | Adicionado `GENERATE_EXAM_PHASE_LABELS` com labels para as 4 fases: Lendo conteúdo, Processando arquivos, Gerando questões, Salvando questões |
| `src/features/background-processes/lib/ingest-event-mapper.ts` | Adicionados tipos `GenerateExamProgressState`, `INITIAL_GENERATE_EXAM_PROGRESS`, funções `isGenerateExamEvent()` e `mapGenerateExamProgress()` |

## Testes

```
✓ 4 test files passed | 78 tests passed
```

- `src/functions/jobs/list-user-jobs.test.ts` — 3 tests (sem alteração, continuam passando)
- `src/functions/jobs/list-active-jobs.test.ts` — 2 tests (sem alteração, continuam passando)
- `src/features/background-processes/lib/ingest-event-mapper.test.ts` — 48 tests (sem alteração, continuam passando)
- `src/features/background-processes/lib/ingest-event-labels.test.ts` — 25 tests (sem alteração, continuam passando)

## Verificação

- `pnpm exec biome check` — passou em todos os 4 arquivos (3 auto-fixes de organizeImports)
- `pnpm exec vitest run` nos 4 arquivos de teste — 78/78 passed

## Detalhamento das alterações

### 1. `list-user-jobs.ts`
- Import `parseGenerateExamJobMetadata` adicionado
- Case `JOB_KIND.GENERATE_EXAM` em `getJobTitle()`: parseia metadata e retorna "Geração de prova" (fallback consistente)

### 2. `list-active-jobs.ts`
- Import `parseGenerateExamJobMetadata` e `GenerateExamPhase` adicionados
- `ActiveJobSummary.phase` estendido para `IngestPhase | GenerateExamPhase | null`
- `ActiveJobSummary.metadata` estendido com `examId?: string`
- `toActiveJobSummary()`: parseia metadata de GENERATE_EXAM, expõe phase (quando status não é AWAITING_UPLOAD) e examId no metadata

### 3. `ingest-event-labels.ts`
- Import `GENERATE_EXAM_PHASE` e `GenerateExamPhase` adicionados
- `GENERATE_EXAM_PHASE_LABELS` exportado com labels em português para as 4 fases

### 4. `ingest-event-mapper.ts`
- Import `GENERATE_EXAM_PHASE` e `GenerateExamPhase` adicionados
- `GenerateExamProgressState` type: `phase`, `parsedCount`, `totalFiles`, `questionsGenerated`, `persistedCount`
- `INITIAL_GENERATE_EXAM_PROGRESS` constante de estado inicial
- `isGenerateExamEvent()`: type guard para eventos `data-generate-exam-phase`
- `mapGenerateExamProgress()`: computa progress state a partir de lista de eventos

## Concerns

Nenhuma. As alterações seguem estritamente os padrões existentes e não quebram compatibilidade com o fluxo de ingest atual.

## Report file

`/home/gustavo/Desktop/study-app/docs/tasks/0033-geracao-provas-por-conteudo/Task-C-002/report.md`
