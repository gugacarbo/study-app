# Explicações por alternativa — Plano de implementação

> **For agentic workers:** Use subagent-driven development to implement this plan task-by-task.
> The executable source of truth is `docs/tasks/0032-explicacoes-alternativas-melhoria/tasks.json`.

**Goal:** Adicionar switch "Explicar alternativas incorretas" no dialog de melhoria de questões. Quando ativo, o agente de melhoria gera `explanation` por alternativa dentro do JSON de `options`.

**Architecture:** Estende o campo `options` (JSON armazenado em TEXT) para incluir `explanation` opcional em cada item. O agente principal recebe o flag `writeOptionExplanations` e gera as explicações durante o drafting. O formulário de revisão exibe as explanations por alternativa com diff toggle.

**Tech Stack:** React 19, TanStack Start, Drizzle ORM, Vercel AI SDK, Zod, TypeScript.

## Global Constraints

- `explanation` por alternativa: máximo 1000 caracteres
- Campo opcional em `QuestionOption` — sempre `string | null` quando ausente
- `writeOptionExplanations` default `false` na metadata
- Jobs sem o campo = `false` (backwards compatible)
- Nenhuma coluna ou tabela nova no banco

## File Structure

| File/Directory | Owner Task | Notes |
|---|---|---|
| `src/features/exams/types/exam-detail.ts` | Task-A-001 | Adicionar `explanation?: string \| null` em `QuestionOption` |
| `src/features/exams/lib/question-form-schema.ts` | Task-A-001 | Adicionar `explanation` no `questionOptionSchema` |
| `src/features/exams/lib/parse-question-fields.ts` | Task-A-001 | Adicionar `explanation` no `optionSchema` |
| `src/features/ai/jobs/improve-questions/run-improve-question-agent.ts` | Task-A-001, Task-B-002 | Schema da tool + prompt + input param |
| `src/db/queries/question-improvement-drafts.ts` | Task-A-001 | `QuestionImprovementSnapshot` — tipo herdado de `QuestionOption[]` |
| `src/lib/job-kinds.ts` | Task-B-001 | `writeOptionExplanations` em `ImproveQuestionsJobMetadata` |
| `src/features/exams/lib/improve-questions-api.ts` | Task-B-001 | Parâmetro `writeOptionExplanations` |
| `src/functions/jobs/create-improve-questions-job.ts` | Task-B-001 | Schema + handler aceitam `writeOptionExplanations` |
| `src/features/exams/hooks/use-improve-questions-job.ts` | Task-B-001 | Hook aceita e repassa o flag |
| `src/features/ai/jobs/improve-questions/run-improve-questions-batch.ts` | Task-B-001 | Passar flag nos deps |
| `src/features/ai/jobs/run-job-consumer.ts` | Task-B-001 | Passar flag ao construir deps |
| `src/features/exams/components/exam-improve-questions-dialog.tsx` | Task-B-001 | Adicionar switch e estado |
| `src/features/exams/components/question-edit-form.tsx` | Task-C-001 | Renderizar textarea de explanation por option |
| `src/features/exams/components/question-field-diff.tsx` | Task-C-001 | Suportar diff de explanation por option |
| `src/features/exams/components/exam-improve-questions-dialog.spec.tsx` | Task-D-001 | Testes do novo switch |
| `src/features/ai/jobs/improve-questions/run-improve-question-agent.test.ts` | Task-D-001 | Testes com `writeOptionExplanations: true` |

## Task Registry

- **Registry:** `docs/tasks/0032-explicacoes-alternativas-melhoria/tasks.json`
- **Progress log:** `docs/tasks/0032-explicacoes-alternativas-melhoria/progress.log`
- **Progress ledger:** `docs/tasks/0032-explicacoes-alternativas-melhoria/progress-ledger.md`
