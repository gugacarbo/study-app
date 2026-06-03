# Stores

TanStack Store state management. 2 stores across 8 files.

## Stores

### `quizStore` (quizStore.ts)
Ephemeral quiz session: current question, answers, timer. Persisted to localStorage.

### `ingestStore` (ingestStore/ — 7 files)
Async job queue with SSE streaming. Immutable state, auto-persist, single-runner queue.

## Structure

`ingestStore/` is split by concern:
- `types.ts` — ~15 TypeScript interfaces (IngestJob, IngestAgentRun, IngestStoreState, TokenTotals, etc.)
- `store.ts` — Store instance + auto-persist debounced subscriber
- `actions.ts` — Async job lifecycle: runJob, enqueue, cancel, focus
- `job-utils.ts` — Pure immutable helpers: applyTokenEvent, applyWarningEvent, upsertAgentRun, applyChunkEvent, syncJobTokenTotals
- `persistence.ts` — localStorage hydration, serialization, job trimming, interrupted job recovery
- `selectors.ts` — Derived state: jobById, activeJobs, recentJobs

## Conventions

- Immutable state only (spread + override, never mutate)
- Single-runner job queue — `runNextJob()` checks for running job before starting next
- AbortController Map tracks running jobs for cancellation
- Interrupted job recovery — queued/running jobs marked canceled with "interrupted" error on reload
- `MAX_COMPLETED_JOBS = 10` — trims completed jobs beyond limit
- Token normalization across providers (promptTokens, inputTokens, etc.)
- `beforeunload` guard warns if job is running when closing tab
- TanStack Store only — no Redux, no Zustand
