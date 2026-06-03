# Stores (Deprecated)

**Last updated:** 2026-06-03 — stores moved to feature folders

TanStack Store state management. All stores now colocated under `src/features/{domain}/store/`.

## Current locations

- `quizStore` → `src/features/quiz/store/quiz-store.ts`
- `ingestStore` → `src/features/ingest/store/` (actions, types, job-utils, persistence, selectors, store)
- `conversationsStore` → `src/features/ai/stores/conversations-store/`
- `chatStore` → `src/features/ai/stores/chat-store.ts`

This directory is empty — kept for backward-compatible path resolution only.
