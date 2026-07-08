# Task-A-002 Report

## Status

DONE_WITH_CONCERNS

## What changed

### `/exams/new` exposes two modes

Updated `src/routes/_app/exams/new/index.tsx` to render a two-mode surface using tabs:

- `Importar arquivo`
- `Gerar com IA`

The existing import form remains intact and isolated in its own tab. The new tab renders a dedicated generate form and keeps its state separate from the import flow.

### Dedicated generate form UX

Created `src/features/exams/components/generate-exam-form.tsx` with:

- `title`
- `mainContent`
- `questionCount`
- `difficulty`
- `difficultyNotes`
- `contextFiles[]`

Implemented automatic title suggestion with the required precedence:

1. First markdown heading in `mainContent`
2. First non-empty line in `mainContent`
3. First attached filename without extension
4. Fallback `"Nova prova"`

The suggestion stops auto-updating after the user manually edits `title`.

The form also includes client-side validation, `.txt` / `.md` attachment filtering, max 5 context files validation, upload progress UI, and retry/reset affordances on failure.

After review, the form was tightened to decode attached files before submit, reject empty/whitespace-only context files, and block payloads whose decoded `mainContent + contextFiles` length exceeds `MAX_TEXT_CHARS`.

### Isolated client API layer

Created `src/features/exams/lib/generate-exam-api.ts` with:

- `createGenerateExamJob()`
- `uploadGenerateExamJobContentWithProgress()`

This talks only to the job API contract:

- `POST /api/jobs` with `kind: "generate-exam"`
- `POST /api/jobs/:id/upload` with multipart `mainContent` + `contextFiles`

### Hook for async generate flow

Created `src/features/exams/hooks/use-generate-exam-job.ts` to encapsulate job creation, upload with progress, failure state, and navigation to `/jobs/$jobId`.

After review, the hook was changed so each submit attempt creates a fresh `generate-exam` job with the current form metadata. This avoids reusing a stale `jobId` after upload failure or form reset.

## Files changed

- `src/routes/_app/exams/new/index.tsx`
- `src/features/exams/components/generate-exam-form.tsx`
- `src/features/exams/hooks/use-generate-exam-job.ts`
- `src/features/exams/lib/generate-exam-api.ts`

## Focused checks run

```bash
rtk pnpm exec biome format --write src/routes/_app/exams/new/index.tsx src/features/exams/components/generate-exam-form.tsx src/features/exams/hooks/use-generate-exam-job.ts src/features/exams/lib/generate-exam-api.ts
rtk pnpm exec biome check src/routes/_app/exams/new/index.tsx src/features/exams/components/generate-exam-form.tsx src/features/exams/hooks/use-generate-exam-job.ts src/features/exams/lib/generate-exam-api.ts
rtk pnpm exec tsc --noEmit --pretty false
rtk pnpm exec biome check src/features/exams/components/generate-exam-form.tsx src/features/exams/hooks/use-generate-exam-job.ts src/features/exams/lib/generate-exam-api.ts src/routes/_app/exams/new/index.tsx
```

## Verification result

- Focused Biome checks passed for all four scoped files.
- The new surface is wired to navigate to the standard job monitor after successful create+upload.
- Existing import flow was preserved in a separate tab and not merged with generate state.
- Review fixes passed focused Biome checks.

## Concerns

Repo-wide `tsc --noEmit` is currently failing outside this write scope with unrelated quiz typing issues. The earlier `job-labels.ts` exhaustive map gap was addressed by the orchestrator during Task-A-001 review handling.

No tests were added because the assigned write scope did not include test files. The implementation was validated with focused formatting/lint checks and repo-wide typecheck observation only.
