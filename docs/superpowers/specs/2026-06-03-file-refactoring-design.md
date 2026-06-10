# File Refactoring — Design Spec

**Date:** 2026-06-03
**Status:** Approved

## Goals

- Max 150 lines per file
- 1 component/function per file
- Organize files in domain folders with barrel exports (`index.ts`)
- SOLID principles (Single Responsibility, Interface Segregation)

## Excluded from Refactoring

- `src/routeTree.gen.ts` — auto-generated
- All `src/components/ui/*.tsx` — shadcn UI primitives (sidebar, dropdown-menu, select,
  navigation-menu, form, dialog, sheet, table, card, tabs, accordion, markdown)
- `src/db/schema.ts` — Drizzle schema with cross-table relations

## Strategy: Domain Folders with Barrel Exports

Each file >150L becomes a domain folder. An `index.ts` barrel re-exports the original
public API, so all existing imports stay unchanged.

**Exception:** Files already within a well-scoped subdirectory (e.g., `exam-detail/`,
`routes/`) use sibling splits instead of creating a 3rd folder level. These are noted
in the conversion list below.

## Domain Conversions

### 1. `src/db/queries.ts` (1151L) → `src/db/queries/`

```
src/db/queries/
├── index.ts           # barrel: re-exports DBQueries class
├── base.ts            # DBQueries class + constructor
├── exams.ts           # exam CRUD
├── questions.ts       # question CRUD
├── attempts.ts        # attempt CRUD + stats
├── config.ts          # config CRUD
├── files.ts           # file CRUD
├── memory.ts          # memory queries
└── llm-logs.ts        # LLM log queries
```

### 2. `src/stores/ingestStore.ts` (996L) → `src/stores/ingest-store/`

```
src/stores/ingest-store/
├── index.ts           # barrel: createIngestStore + useIngestStore
├── types.ts           # Job, JobState, JobEvent types
├── actions.ts         # addJob, updateJob, removeJob, clearCompleted
├── selectors.ts       # jobById, activeJobs, recentJobs
└── persistence.ts     # localStorage load/save
```

### 3. `src/lib/memory.ts` (793L) → `src/lib/memory/`

```
src/lib/memory/
├── index.ts           # barrel: MemoryManager class
├── types.ts           # Memory types (Session, Document, TopicNote)
├── manager.ts         # MemoryManager class core
├── r2-operations.ts   # R2 put/get/delete
├── d1-operations.ts   # D1 metadata CRUD
└── search.ts          # search + hydrate from R2
```

### 4. `src/routes/api/ingest.ts` (731L) → `src/routes/api/ingest/`

```
src/routes/api/ingest/
├── index.ts           # barrel: POST handler
├── pipeline.ts        # ingest pipeline orchestrator
├── extract-text.ts    # text extraction from files
├── memory-refinement.ts # memory refinement stage
├── review.ts          # review extraction stage
├── persist.ts         # persist questions + files
└── sse-emitter.ts     # SSE event emission helpers
```

### 5. `src/routes/exams.upload.tsx` (585L) → `src/routes/exams.upload/`

```
src/routes/exams.upload/
├── index.tsx          # route component (default export)
├── upload-form.tsx    # form component
├── ingest-progress.tsx # streaming progress display
├── job-list.tsx       # job history list
└── use-upload.ts      # upload logic hook
```

### 6. `src/features/ai/core/generate.ts` (436L) → `src/features/ai/core/generate/`

```
src/features/ai/core/generate/
├── index.ts           # barrel: generateText, generateObject, generateStream
├── types.ts           # GenerateOptions, GenerateResult types
├── generate-text.ts   # text generation
├── generate-structured.ts # structured output (Zod)
├── generate-stream.ts # streaming generation
└── provider.ts        # provider selection + config
```

### 7. `src/lib/sse-stream.ts` (418L) → `src/lib/sse-stream/`

```
src/lib/sse-stream/
├── index.ts           # barrel: createSSEStream, SSEEmitter
├── types.ts           # SSEEvent, SSEConfig
├── emitter.ts         # SSE event emitter
└── parser.ts          # SSE client parser
```

### 8. `src/components/ingest/IngestChatView.tsx` (345L) → `src/components/ingest/ingest-chat-view/`

```
src/components/ingest/ingest-chat-view/
├── index.tsx          # barrel: IngestChatView
├── chat-panel.tsx     # main chat display
├── log-panel.tsx      # log output panel
└── use-ingest-chat.ts # chat logic hook
```

### 9. `src/features/ai/tools/db-tools.ts` (325L) → `src/features/ai/tools/db-tools/`

```
src/features/ai/tools/db-tools/
├── index.ts           # barrel: createDbTools
├── exam-tools.ts      # getExams, getExamDetail
├── question-tools.ts  # getQuestions, updateQuestion
├── memory-tools.ts    # memory search/retrieve
└── config-tools.ts    # config read/write
```

### 10. `src/routes/exams.explanations.tsx` (322L) → `src/routes/exams.explanations/`

```
src/routes/exams.explanations/
├── index.tsx          # route component
├── pipeline-controls.tsx # start/stop/pause controls
├── explanation-results.tsx # generated explanations list
└── use-explanation-pipeline.ts # pipeline logic hook
```

### 11. `src/features/ai/agents/ingest/review-extraction.ts` (313L) → `src/features/ai/agents/ingest/review-extraction/`

```
src/features/ai/agents/ingest/review-extraction/
├── index.ts           # barrel: reviewExtraction
├── prompt.ts          # system + user prompts
├── execute.ts         # review execution logic
└── types.ts           # ReviewResult, ReviewOptions
```

### 12. `src/features/ai/hooks/use-chat-client.ts` (284L) → `src/features/ai/hooks/use-chat-client/`

```
src/features/ai/hooks/use-chat-client/
├── index.ts           # barrel: useChatClient
├── types.ts           # chat message types
├── send-message.ts    # send message logic
├── tool-calls.ts      # tool call handling
└── streaming.ts       # stream processing
```

### 13. `src/components/exam-detail/explanation-dialog.tsx` (273L) → `src/components/exam-detail/explanation-dialog/`

```
src/components/exam-detail/explanation-dialog/
├── index.tsx          # barrel: ExplanationDialog
├── dialog-content.tsx # markdown content display
├── dialog-actions.tsx # close/copy/regenerate buttons
└── use-explanation.ts # dialog state hook
```

### 14. `src/features/ai/components/exam-detail/use-explanation-generation.ts` (271L)

Sibling splits — already in `exam-detail/` directory (no sub-folder needed):

- `use-explanation-generation.ts` → thin API layer, delegates to sub-modules
- `explanation-queue.ts` → queue management
- `explanation-generator.ts` → single explanation generation

### 15. `src/routes/__root.tsx` (265L)

Sibling splits — in `routes/` directory (no sub-folder needed):

- `__root.tsx` → thin route component
- `root-nav.tsx` → nav bar + ingest indicator
- `root-providers.tsx` → QueryClient, theme, Scripts setup

### 16. `src/routes/api/chat.ts` (254L) → `src/routes/api/chat/`

```
src/routes/api/chat/
├── index.ts           # barrel: POST handler
├── handlers.ts        # message handling logic
├── streaming.ts       # SSE streaming helpers
└── tools.ts           # tool resolution for chat
```

### 17. `src/features/ai/stores/conversations-store.ts` (234L) → `src/features/ai/stores/conversations-store/`

```
src/features/ai/stores/conversations-store/
├── index.ts           # barrel: conversationsStore
├── types.ts           # Conversation, Message types
├── actions.ts         # add/delete/update conversations
└── selectors.ts       # getConversation, getActiveConversation
```

### 18. `src/server-functions/exams.ts` (212L) → `src/server-functions/exams/`

```
src/server-functions/exams/
├── index.ts           # barrel: all server functions
├── detail.ts          # getExamDetail, getExamsDetailed
├── questions.ts       # updateQuestion, deleteQuestion
├── delete.ts          # deleteExam
└── types.ts           # shared types
```

### 19. `src/components/ingest/OutputPanel.tsx` (204L) — sibling splits:

- `OutputPanel.tsx` → main component (thin)
- `OutputPanelLogs.tsx` → log lines display
- `OutputPanelAgentRuns.tsx` → agent run details

### 20. `src/features/ai/agents/explanations/generate-explanations.ts` (190L) → `src/features/ai/agents/explanations/generate-explanations/`

```
src/features/ai/agents/explanations/generate-explanations/
├── index.ts           # barrel: generateExplanations
├── prompt.ts          # system + user prompts
├── batch-generator.ts # batch generation logic
└── types.ts           # ExplanationResult
```

### 21. `src/features/ai/tools/tool-resolver.ts` (185L) — sibling splits:

- `tool-resolver.ts` → keeps `resolveToolsForAgent`, thin
- `tool-definitions.ts` → tool definition maps
- `tool-factories.ts` → factory functions for each tool set

### 22. `src/components/quiz/quiz.tsx` (159L) → `src/components/quiz/quiz/`

```
src/components/quiz/quiz/
├── index.tsx          # barrel: Quiz component
├── quiz-navigation.tsx # question + topic nav
├── quiz-timer.tsx     # timer component
└── use-quiz-state.ts  # quiz state hook
```

### 23. `src/components/exam-detail/question-edit-form.tsx` (151L) — sibling splits:

- `question-edit-form.tsx` → form component
- `question-edit-fields.tsx` → field definitions

### 24. `src/features/ai/components/chat/message/chat-message-utils.ts` (149L)

Extract 1-2 helpers if needed to stay under 150.

## Import Strategy

All existing imports remain unchanged. Barrel `index.ts` files re-export the same
symbols. Example:

```typescript
// Before: import { getExams } from "@/db/queries";
// After:  import { getExams } from "@/db/queries";
//         (resolved via barrel: @/db/queries/index.ts → @/db/queries/exams.ts)
```

TanStack Router route files keep their names (`exams.upload.tsx` → `exams.upload/index.tsx`)
so file-based routing continues to work.

## Execution Plan

Refactor in **5 parallel groups** (independent domains):

| Group                      | Files                                                                                                                                                                                                                                               | ~New Files |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **A: Data Layer**          | `db/queries.ts`, `stores/ingestStore.ts`                                                                                                                                                                                                            | 15         |
| **B: Memory + SSE**        | `lib/memory.ts`, `lib/sse-stream.ts`                                                                                                                                                                                                                | 12         |
| **C: Ingest Pipeline**     | `routes/api/ingest.ts`, `routes/exams.upload.tsx`, `components/ingest/IngestChatView.tsx`, `components/ingest/OutputPanel.tsx`                                                                                                                      | 17         |
| **D: AI Core + Tools**     | `features/ai/core/generate.ts`, `features/ai/tools/db-tools.ts`, `features/ai/tools/tool-resolver.ts`, `features/ai/agents/ingest/review-extraction.ts`                                                                                             | 20         |
| **E: Chat + Exams + Quiz** | `routes/__root.tsx`, `routes/api/chat.ts`, `routes/exams.explanations.tsx`, `server-functions/exams.ts`, `components/exam-detail/*`, `features/ai/hooks/*`, `features/ai/stores/*`, `features/ai/agents/explanations/*`, `components/quiz/quiz.tsx` | 24         |

## Verification

After all groups complete:

1. `npm run typecheck` — must pass
2. `npm run lint` — must pass
3. `npm run test` — all existing tests must pass
4. Manual smoke test: navigate main pages
