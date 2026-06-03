# File Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split 24 files >150L into domain folders with barrel exports, max 150L per file, 1 component/function per file, SOLID organization.

**Architecture:** Each large file becomes a domain folder. Sub-files hold focused concerns (1 fn/component each). An `index.ts` barrel re-exports all public symbols so existing imports don't change. Verification via `npm run typecheck && npm run lint`.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router, Drizzle ORM, Biome

**Spec:** [`docs/superpowers/specs/2026-06-03-file-refactoring-design.md`](../specs/2026-06-03-file-refactoring-design.md)

**Excluded:** `routeTree.gen.ts` (auto-generated), all `src/components/ui/*.tsx` (shadcn primitives), `src/db/schema.ts` (Drizzle cross-table relations)

---

## Pre-Refactoring Baseline

- [ ] **Commit all current work and record baseline**

```bash
git add -A && git status
```

Ensure a clean or committed state before starting any refactoring.

---

## Task Group A: Data Layer (2 files → ~15 new files)

**Scope:** `src/db/queries.ts`, `src/stores/ingestStore.ts`

### Task A1: Refactor `src/db/queries.ts` (1151L)

**Files:**
- Read: `src/db/queries.ts`
- Create: `src/db/queries/base.ts`, `exams.ts`, `questions.ts`, `attempts.ts`, `config.ts`, `files.ts`, `memory.ts`, `llm-logs.ts`, `index.ts`
- Delete: `src/db/queries.ts` (replace with folder)
- Verify: no consumer import changes needed (barrel preserves path)

- [ ] **Step 1: Read and understand the original file**

Read `src/db/queries.ts` fully. Identify:
- All public exports (DBQueries class, type exports)
- Method groupings by entity (exams, questions, attempts, config, files, memory, llm-logs)
- Shared imports used across all methods
- Cross-entity method calls

- [ ] **Step 2: Create shared types file**

Create `src/db/queries/types.ts` — extract shared types/interfaces that multiple entity files need.

- [ ] **Step 3: Create entity files**

Create one file per entity, each exporting a function that takes the DB and returns methods:

`src/db/queries/base.ts` — DBQueries class constructor + shared Drizzle client:
```typescript
import { getDB } from "@/server-functions/db";

export class DBQueries {
  db: ReturnType<typeof getDB>;
  constructor() {
    this.db = getDB();
  }
}
```

`src/db/queries/exams.ts` — exam CRUD methods (extends DBQueries via prototype or mixin pattern):
```typescript
// Extend DBQueries prototype with exam methods
import { DBQueries } from "./base";
import { examTable } from "../schema";

DBQueries.prototype.getExams = async function () {
  // ... original implementation
};
```

Alternatively, use a class-extension approach that preserves `this.db` access.

`src/db/queries/questions.ts` — question CRUD:
```typescript
import { DBQueries } from "./base";
import { questionTable } from "../schema";

DBQueries.prototype.getQuestions = async function (examId: string) {
  // ... original implementation
};
```

`src/db/queries/attempts.ts` — attempts + stats:
```typescript
import { DBQueries } from "./base";
import { attemptTable } from "../schema";

DBQueries.prototype.getStats = async function () {
  // ... original implementation
};
```

`src/db/queries/config.ts` — config CRUD
`src/db/queries/files.ts` — files CRUD
`src/db/queries/memory.ts` — memory queries
`src/db/queries/llm-logs.ts` — LLM log queries

- [ ] **Step 4: Create barrel index**

Create `src/db/queries/index.ts`:
```typescript
export { DBQueries } from "./base";
import "./exams";
import "./questions";
import "./attempts";
import "./config";
import "./files";
import "./memory";
import "./llm-logs";
```

- [ ] **Step 5: Remove old file**

```bash
rm src/db/queries.ts
```

- [ ] **Step 6: Verify**

```bash
npm run typecheck 2>&1 | head -40
```

Fix any import issues. The barrel `index.ts` should resolve `import { DBQueries } from "@/db/queries"` correctly.

- [ ] **Step 7: Commit**

```bash
git add src/db/queries/
git rm src/db/queries.ts
git commit -m "refactor: split db/queries.ts into entity files"
```

---

### Task A2: Refactor `src/stores/ingestStore.ts` (996L)

**Files:**
- Read: `src/stores/ingestStore.ts`
- Create: `src/stores/ingest-store/types.ts`, `actions.ts`, `selectors.ts`, `persistence.ts`, `index.ts`
- Delete: `src/stores/ingestStore.ts` (replace with folder)

- [ ] **Step 1: Read and understand the original file**

Identify: store creation function, all exported symbols, types, action functions, selector functions, localStorage persistence logic.

- [ ] **Step 2: Create types file**

`src/stores/ingest-store/types.ts` — all type/interface definitions (Job, JobState, JobEvent, IngestStore).

- [ ] **Step 3: Create actions file**

`src/stores/ingest-store/actions.ts` — `addJob`, `updateJob`, `removeJob`, `clearCompleted` functions.

- [ ] **Step 4: Create selectors file**

`src/stores/ingest-store/selectors.ts` — `activeJobsSelector`, `recentJobsSelector`, `jobByIdSelector`.

- [ ] **Step 5: Create persistence file**

`src/stores/ingest-store/persistence.ts` — `loadFromStorage`, `saveToStorage` functions.

- [ ] **Step 6: Create barrel index**

`src/stores/ingest-store/index.ts`:
```typescript
export { createIngestStore, useIngestStore } from "./store";
export type { Job, JobState, IngestStore } from "./types";
```

Create `src/stores/ingest-store/store.ts` — thin file that composes actions + selectors + persistence into the final store.

- [ ] **Step 7: Remove old file and verify**

```bash
rm src/stores/ingestStore.ts
npm run typecheck 2>&1 | head -40
```

- [ ] **Step 8: Commit**

```bash
git add src/stores/ingest-store/
git rm src/stores/ingestStore.ts
git commit -m "refactor: split ingestStore.ts into domain files"
```

---

## Task Group B: Memory + SSE (2 files → ~12 new files)

**Scope:** `src/lib/memory.ts`, `src/lib/sse-stream.ts`

### Task B1: Refactor `src/lib/memory.ts` (793L)

**Files:**
- Read: `src/lib/memory.ts`
- Create: `src/lib/memory/types.ts`, `manager.ts`, `r2-operations.ts`, `d1-operations.ts`, `search.ts`, `index.ts`
- Delete: `src/lib/memory.ts`

- [ ] **Step 1: Read and understand**

Identify: MemoryManager class, all methods, R2 operations, D1 operations, search functionality.

- [ ] **Step 2: Create types file**

`src/lib/memory/types.ts` — MemorySession, MemoryDocument, MemoryTopicNote, SearchResult, etc.

- [ ] **Step 3: Create R2 operations**

`src/lib/memory/r2-operations.ts` — `putContent`, `getContent`, `deleteContent` using MEMORY_BUCKET.

- [ ] **Step 4: Create D1 operations**

`src/lib/memory/d1-operations.ts` — metadata CRUD operations for memory tables.

- [ ] **Step 5: Create search**

`src/lib/memory/search.ts` — `searchMemory`, `hydrateSearchResults` functions.

- [ ] **Step 6: Create manager**

`src/lib/memory/manager.ts` — MemoryManager class that composes R2 + D1 + search operations.

- [ ] **Step 7: Create barrel and verify**

`src/lib/memory/index.ts`:
```typescript
export { MemoryManager } from "./manager";
export type { MemorySession, MemoryDocument, MemoryTopicNote } from "./types";
```

```bash
rm src/lib/memory.ts
npm run typecheck 2>&1 | head -40
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/memory/
git rm src/lib/memory.ts
git commit -m "refactor: split lib/memory.ts into domain files"
```

---

### Task B2: Refactor `src/lib/sse-stream.ts` (418L)

**Files:**
- Read: `src/lib/sse-stream.ts`
- Create: `src/lib/sse-stream/types.ts`, `emitter.ts`, `parser.ts`, `index.ts`
- Delete: `src/lib/sse-stream.ts`

- [ ] **Step 1: Read and understand**

Identify: SSE event types, emitter factory, client parser.

- [ ] **Step 2: Create types**

`src/lib/sse-stream/types.ts` — SSEEvent, SSEConfig, SSEClientOptions.

- [ ] **Step 3: Create emitter**

`src/lib/sse-stream/emitter.ts` — `createSSEEmitter` function.

- [ ] **Step 4: Create parser**

`src/lib/sse-stream/parser.ts` — `parseSSEStream`, `createSSEClient` functions.

- [ ] **Step 5: Barrel, remove old, verify, commit**

```bash
rm src/lib/sse-stream.ts
npm run typecheck 2>&1 | head -40
git add src/lib/sse-stream/
git rm src/lib/sse-stream.ts
git commit -m "refactor: split lib/sse-stream.ts into domain files"
```

---

## Task Group C: Ingest Pipeline (4 files → ~17 new files)

**Scope:** `src/routes/api/ingest.ts`, `src/routes/exams.upload.tsx`, `src/components/ingest/IngestChatView.tsx`, `src/components/ingest/OutputPanel.tsx`

### Task C1: Refactor `src/routes/api/ingest.ts` (731L)

**Files:**
- Read: `src/routes/api/ingest.ts`
- Create: `src/routes/api/ingest/pipeline.ts`, `extract-text.ts`, `memory-refinement.ts`, `review.ts`, `persist.ts`, `sse-emitter.ts`, `index.ts`
- Delete: `src/routes/api/ingest.ts`

- [ ] **Step 1: Read and understand**

Identify: POST handler, pipeline stages (decode → extract → memory refine → review → persist), SSE event emission, tool resolution.

- [ ] **Step 2: Create pipeline orchestrator**

`src/routes/api/ingest/pipeline.ts` — main pipeline function that calls each stage.

- [ ] **Step 3: Create stage files**

One function per stage:
- `extract-text.ts` — `extractQuestions` stage
- `memory-refinement.ts` — memory refinement stage
- `review.ts` — `reviewExtraction` stage
- `persist.ts` — database persistence stage

- [ ] **Step 4: Create SSE emitter**

`src/routes/api/ingest/sse-emitter.ts` — `emitStage`, `emitChunk`, `emitToken`, `emitWarning`, `emitAgent` helpers.

- [ ] **Step 5: Create barrel index**

`src/routes/api/ingest/index.ts` — re-exports the POST handler as default + named exports.

**Note for TanStack Router:** The route file `routes/api/ingest.ts` is a server route. Converting to `routes/api/ingest/index.ts` should work with file-based routing. Verify the route is still picked up.

- [ ] **Step 6: Verify and commit**

```bash
rm src/routes/api/ingest.ts
npm run typecheck 2>&1 | head -40
git add src/routes/api/ingest/
git rm src/routes/api/ingest.ts
git commit -m "refactor: split routes/api/ingest.ts into pipeline stages"
```

---

### Task C2: Refactor `src/routes/exams.upload.tsx` (585L)

**Files:**
- Read: `src/routes/exams.upload.tsx`
- Create: `src/routes/exams.upload/upload-form.tsx`, `ingest-progress.tsx`, `job-list.tsx`, `use-upload.ts`, `index.tsx`
- Delete: `src/routes/exams.upload.tsx`

- [ ] **Step 1: Read and understand**

Identify: Upload form component, streaming progress display, job list, upload logic, default export.

- [ ] **Step 2: Extract components**

- `upload-form.tsx` — UploadForm component (form + file input + text paste)
- `ingest-progress.tsx` — IngestProgress component (streaming progress with spinner)
- `job-list.tsx` — JobList component (job history)

- [ ] **Step 3: Extract hook**

`use-upload.ts` — `useUpload` hook with upload logic.

- [ ] **Step 4: Create route index**

`index.tsx` — default export composing form + progress + job-list + hook.

- [ ] **Step 5: Verify and commit**

```bash
rm src/routes/exams.upload.tsx
npm run typecheck 2>&1 | head -40
git add src/routes/exams.upload/
git rm src/routes/exams.upload.tsx
git commit -m "refactor: split routes/exams.upload.tsx into components"
```

---

### Task C3: Refactor `src/components/ingest/IngestChatView.tsx` (345L)

**Files:**
- Read: `src/components/ingest/IngestChatView.tsx`
- Create: `src/components/ingest/ingest-chat-view/chat-panel.tsx`, `log-panel.tsx`, `use-ingest-chat.ts`, `index.tsx`
- Delete: `src/components/ingest/IngestChatView.tsx`

- [ ] **Step 1: Read and understand**

Identify: chat panel, log display panel, chat logic, export.

- [ ] **Step 2: Extract into focused files**

- `chat-panel.tsx` — ChatPanel component
- `log-panel.tsx` — LogPanel component
- `use-ingest-chat.ts` — useIngestChat hook
- `index.tsx` — barrel, re-exports IngestChatView

- [ ] **Step 3: Verify, commit**

```bash
rm src/components/ingest/IngestChatView.tsx
npm run typecheck 2>&1 | head -40
git add src/components/ingest/ingest-chat-view/
git rm src/components/ingest/IngestChatView.tsx
git commit -m "refactor: split IngestChatView into focused components"
```

---

### Task C4: Refactor `src/components/ingest/OutputPanel.tsx` (204L)

**Files:**
- Read: `src/components/ingest/OutputPanel.tsx`
- Create: `src/components/ingest/OutputPanelLogs.tsx`, `src/components/ingest/OutputPanelAgentRuns.tsx`
- Modify: `src/components/ingest/OutputPanel.tsx` (thin down)

- [ ] **Step 1: Read and understand**

Identify: main panel component, logs display, agent run details.

- [ ] **Step 2: Extract sub-components**

- `OutputPanelLogs.tsx` — log lines display sub-component
- `OutputPanelAgentRuns.tsx` — agent run detail sub-component
- `OutputPanel.tsx` — thin to ~50-80 lines, imports and composes sub-components

- [ ] **Step 3: Verify, commit**

```bash
npm run typecheck 2>&1 | head -40
git add src/components/ingest/OutputPanel*.tsx
git commit -m "refactor: extract OutputPanel sub-components"
```

---

## Task Group D: AI Core + Tools (4 files → ~20 new files)

**Scope:** `src/features/ai/core/generate.ts`, `src/features/ai/tools/db-tools.ts`, `src/features/ai/tools/tool-resolver.ts`, `src/features/ai/agents/ingest/review-extraction.ts`

### Task D1: Refactor `src/features/ai/core/generate.ts` (436L)

**Files:**
- Read: `src/features/ai/core/generate.ts`
- Create: `src/features/ai/core/generate/types.ts`, `generate-text.ts`, `generate-structured.ts`, `generate-stream.ts`, `provider.ts`, `index.ts`
- Delete: `src/features/ai/core/generate.ts`

- [ ] **Step 1: Read and understand**

Identify: generateText, generateObject (structured), generateStream, provider configuration.

- [ ] **Step 2: Create focused files**

- `types.ts` — GenerateOptions, GenerateResult, ToolDefinition
- `provider.ts` — `getProvider`, `resolveProviderConfig`
- `generate-text.ts` — `generateText` function
- `generate-structured.ts` — `generateObject` (Zod structured output)
- `generate-stream.ts` — `generateStream` function

- [ ] **Step 3: Barrel + verify + commit**

```bash
rm src/features/ai/core/generate.ts
npm run typecheck 2>&1 | head -40
git add src/features/ai/core/generate/
git rm src/features/ai/core/generate.ts
git commit -m "refactor: split generate.ts into focused generation functions"
```

---

### Task D2: Refactor `src/features/ai/tools/db-tools.ts` (325L)

**Files:**
- Read: `src/features/ai/tools/db-tools.ts`
- Create: `src/features/ai/tools/db-tools/exam-tools.ts`, `question-tools.ts`, `memory-tools.ts`, `config-tools.ts`, `index.ts`
- Delete: `src/features/ai/tools/db-tools.ts`

- [ ] **Step 1: Read and understand**

Identify: createDbTools factory, exam tools, question tools, memory tools, config tools.

- [ ] **Step 2: Split by tool domain**

- `exam-tools.ts` — `getExamsTool`, `getExamDetailTool`
- `question-tools.ts` — `getQuestionsTool`, `updateQuestionTool`
- `memory-tools.ts` — `searchMemoryTool`, `getMemoryContextTool`
- `config-tools.ts` — `getConfigTool`, `setConfigTool`

- [ ] **Step 3: Barrel composes all tools**

`index.ts` — `createDbTools` that aggregates all tool definitions.

- [ ] **Step 4: Verify and commit**

```bash
rm src/features/ai/tools/db-tools.ts
npm run typecheck 2>&1 | head -40
git add src/features/ai/tools/db-tools/
git rm src/features/ai/tools/db-tools.ts
git commit -m "refactor: split db-tools.ts by tool domain"
```

---

### Task D3: Refactor `src/features/ai/tools/tool-resolver.ts` (185L)

**Files:**
- Read: `src/features/ai/tools/tool-resolver.ts`
- Create: `src/features/ai/tools/tool-definitions.ts`, `src/features/ai/tools/tool-factories.ts`
- Modify: `src/features/ai/tools/tool-resolver.ts` (thin down)

- [ ] **Step 1: Read and understand**

Identify: resolveToolsForAgent, tool definition maps, factory functions.

- [ ] **Step 2: Extract definitions and factories**

- `tool-definitions.ts` — static tool definition maps per agent type
- `tool-factories.ts` — factory functions for creating tool instances
- `tool-resolver.ts` — thin `resolveToolsForAgent` composing definitions + factories

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck 2>&1 | head -40
git add src/features/ai/tools/tool-*.ts src/features/ai/tools/tool-resolver.ts
git commit -m "refactor: extract tool definitions and factories from resolver"
```

---

### Task D4: Refactor `src/features/ai/agents/ingest/review-extraction.ts` (313L)

**Files:**
- Read: `src/features/ai/agents/ingest/review-extraction.ts`
- Create: `src/features/ai/agents/ingest/review-extraction/prompt.ts`, `execute.ts`, `types.ts`, `index.ts`
- Delete: `src/features/ai/agents/ingest/review-extraction.ts`

- [ ] **Step 1: Read and understand**

Identify: reviewExtraction function, prompts, execution logic, review types.

- [ ] **Step 2: Split**

- `prompt.ts` — system prompt + user prompt builders
- `execute.ts` — `executeReview` function
- `types.ts` — ReviewResult, ReviewOptions
- `index.ts` — barrel re-exporting `reviewExtraction`

- [ ] **Step 3: Verify and commit**

```bash
rm src/features/ai/agents/ingest/review-extraction.ts
npm run typecheck 2>&1 | head -40
git add src/features/ai/agents/ingest/review-extraction/
git rm src/features/ai/agents/ingest/review-extraction.ts
git commit -m "refactor: split review-extraction into prompt, execute, types"
```

---

## Task Group E: Chat + Exams + Quiz (~10 files → ~24 new files)

**Scope:** routes (__root, chat, exams.explanations), server-functions (exams), exam-detail components, chat hooks/stores, quiz

### Task E1: Refactor `src/routes/__root.tsx` (265L)

**Files:**
- Read: `src/routes/__root.tsx`
- Create: `src/routes/root-nav.tsx`, `src/routes/root-providers.tsx`
- Modify: `src/routes/__root.tsx` (thin down to ~60L)

- [ ] **Step 1: Read and understand**

Identify: root component, nav bar, IngestIndicator, QueryClient provider, theme provider, Scripts, Outlet.

- [ ] **Step 2: Extract**

- `root-nav.tsx` — RootNav component (nav bar + links + IngestIndicator)
- `root-providers.tsx` — RootProviders component (QueryClient + ThemeProvider + Scripts)
- `__root.tsx` — thin root route composing nav + providers + Outlet

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck 2>&1 | head -40
git add src/routes/__root.tsx src/routes/root-nav.tsx src/routes/root-providers.tsx
git commit -m "refactor: extract nav and providers from __root.tsx"
```

---

### Task E2: Refactor `src/routes/api/chat.ts` (254L)

**Files:**
- Read: `src/routes/api/chat.ts`
- Create: `src/routes/api/chat/handlers.ts`, `streaming.ts`, `tools.ts`, `index.ts`
- Delete: `src/routes/api/chat.ts`

- [ ] **Step 1: Read and understand**

Identify: POST handler, message processing, SSE streaming, tool resolution for chat.

- [ ] **Step 2: Split**

- `handlers.ts` — `handleChatMessage` function
- `streaming.ts` — `streamChatResponse` function
- `tools.ts` — `resolveChatTools` function
- `index.ts` — barrel re-exports POST handler

- [ ] **Step 3: Verify and commit**

```bash
rm src/routes/api/chat.ts
npm run typecheck 2>&1 | head -40
git add src/routes/api/chat/
git rm src/routes/api/chat.ts
git commit -m "refactor: split routes/api/chat.ts into focused modules"
```

---

### Task E3: Refactor `src/routes/exams.explanations.tsx` (322L)

**Files:**
- Read: `src/routes/exams.explanations.tsx`
- Create: `src/routes/exams.explanations/pipeline-controls.tsx`, `explanation-results.tsx`, `use-explanation-pipeline.ts`, `index.tsx`
- Delete: `src/routes/exams.explanations.tsx`

- [ ] **Step 1: Read and understand**

Identify: explanation pipeline page, controls, results list, pipeline hook.

- [ ] **Step 2: Split**

- `pipeline-controls.tsx` — PipelineControls component (start/stop/pause)
- `explanation-results.tsx` — ExplanationResults component (list)
- `use-explanation-pipeline.ts` — useExplanationPipeline hook
- `index.tsx` — route default export composing all

- [ ] **Step 3: Verify and commit**

```bash
rm src/routes/exams.explanations.tsx
npm run typecheck 2>&1 | head -40
git add src/routes/exams.explanations/
git rm src/routes/exams.explanations.tsx
git commit -m "refactor: split exams.explanations into components and hook"
```

---

### Task E4: Refactor `src/server-functions/exams.ts` (212L)

**Files:**
- Read: `src/server-functions/exams.ts`
- Create: `src/server-functions/exams/detail.ts`, `questions.ts`, `delete.ts`, `types.ts`, `index.ts`
- Delete: `src/server-functions/exams.ts`

- [ ] **Step 1: Read and understand**

Identify: getExamDetail, getExamsDetailed, updateQuestion, deleteQuestion, deleteExam.

- [ ] **Step 2: Split by operation**

- `detail.ts` — `getExamDetail`, `getExamsDetailed`
- `questions.ts` — `updateQuestion`, `deleteQuestion`
- `delete.ts` — `deleteExam`
- `types.ts` — shared types
- `index.ts` — barrel re-exports all server functions

- [ ] **Step 3: Verify and commit**

```bash
rm src/server-functions/exams.ts
npm run typecheck 2>&1 | head -40
git add src/server-functions/exams/
git rm src/server-functions/exams.ts
git commit -m "refactor: split server-functions/exams.ts by operation"
```

---

### Task E5: Refactor `src/components/exam-detail/explanation-dialog.tsx` (273L)

**Files:**
- Read: `src/components/exam-detail/explanation-dialog.tsx`
- Create: `src/components/exam-detail/explanation-dialog/dialog-content.tsx`, `dialog-actions.tsx`, `use-explanation.ts`, `index.tsx`
- Delete: `src/components/exam-detail/explanation-dialog.tsx`

- [ ] **Step 1: Read and understand**

Identify: ExplanationDialog, markdown content, close/copy/regenerate actions, dialog state.

- [ ] **Step 2: Split**

- `dialog-content.tsx` — DialogContent (markdown renderer)
- `dialog-actions.tsx` — DialogActions (buttons)
- `use-explanation.ts` — useExplanation hook
- `index.tsx` — barrel re-exports ExplanationDialog

- [ ] **Step 3: Verify and commit**

```bash
rm src/components/exam-detail/explanation-dialog.tsx
npm run typecheck 2>&1 | head -40
git add src/components/exam-detail/explanation-dialog/
git rm src/components/exam-detail/explanation-dialog.tsx
git commit -m "refactor: split explanation-dialog into focused components"
```

---

### Task E6: Refactor `src/components/exam-detail/question-edit-form.tsx` (151L)

**Files:**
- Read: `src/components/exam-detail/question-edit-form.tsx`
- Create: `src/components/exam-detail/question-edit-fields.tsx`
- Modify: `src/components/exam-detail/question-edit-form.tsx` (thin down)

- [ ] **Step 1: Read and understand**

Identify: form component, field definitions.

- [ ] **Step 2: Extract fields**

- `question-edit-fields.tsx` — QuestionEditFields component (field definitions + layout)
- `question-edit-form.tsx` — thin to ~60L, imports and uses fields

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck 2>&1 | head -40
git add src/components/exam-detail/question-edit-*.tsx
git commit -m "refactor: extract question edit fields from form"
```

---

### Task E7: Refactor `src/features/ai/components/exam-detail/use-explanation-generation.ts` (271L)

**Files:**
- Read: `src/features/ai/components/exam-detail/use-explanation-generation.ts`
- Create: `src/features/ai/components/exam-detail/explanation-queue.ts`, `explanation-generator.ts`
- Modify: `use-explanation-generation.ts` (thin down)

- [ ] **Step 1: Read and understand**

Identify: hook, queue management, explanation generation logic.

- [ ] **Step 2: Extract**

- `explanation-queue.ts` — queue management functions (add to queue, process queue)
- `explanation-generator.ts` — single explanation generation function
- `use-explanation-generation.ts` — thin hook composing queue + generator

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck 2>&1 | head -40
git add src/features/ai/components/exam-detail/use-explanation-generation.ts src/features/ai/components/exam-detail/explanation-*.ts
git commit -m "refactor: extract queue and generator from use-explanation-generation"
```

---

### Task E8: Refactor `src/features/ai/hooks/use-chat-client.ts` (284L)

**Files:**
- Read: `src/features/ai/hooks/use-chat-client.ts`
- Create: `src/features/ai/hooks/use-chat-client/types.ts`, `send-message.ts`, `tool-calls.ts`, `streaming.ts`, `index.ts`
- Delete: `src/features/ai/hooks/use-chat-client.ts`

- [ ] **Step 1: Read and understand**

Identify: useChatClient hook, send message, tool calls, streaming processing.

- [ ] **Step 2: Split by concern**

- `types.ts` — ChatMessage, ToolCall, StreamEvent types
- `send-message.ts` — `sendMessage` function
- `tool-calls.ts` — `handleToolCall` function
- `streaming.ts` — `processStream` function
- `index.ts` — barrel, re-exports `useChatClient`

- [ ] **Step 3: Verify and commit**

```bash
rm src/features/ai/hooks/use-chat-client.ts
npm run typecheck 2>&1 | head -40
git add src/features/ai/hooks/use-chat-client/
git rm src/features/ai/hooks/use-chat-client.ts
git commit -m "refactor: split use-chat-client by concern"
```

---

### Task E9: Refactor `src/features/ai/stores/conversations-store.ts` (234L)

**Files:**
- Read: `src/features/ai/stores/conversations-store.ts`
- Create: `src/features/ai/stores/conversations-store/types.ts`, `actions.ts`, `selectors.ts`, `index.ts`
- Delete: `src/features/ai/stores/conversations-store.ts`

- [ ] **Step 1: Read and understand**

Identify: store creation, types, actions, selectors.

- [ ] **Step 2: Split**

- `types.ts` — Conversation, Message types
- `actions.ts` — add/delete/update conversation actions
- `selectors.ts` — getConversation, getActiveConversation selectors
- `index.ts` — barrel re-exports `conversationsStore`

- [ ] **Step 3: Verify and commit**

```bash
rm src/features/ai/stores/conversations-store.ts
npm run typecheck 2>&1 | head -40
git add src/features/ai/stores/conversations-store/
git rm src/features/ai/stores/conversations-store.ts
git commit -m "refactor: split conversations-store by concern"
```

---

### Task E10: Refactor `src/features/ai/agents/explanations/generate-explanations.ts` (190L)

**Files:**
- Read: `src/features/ai/agents/explanations/generate-explanations.ts`
- Create: `src/features/ai/agents/explanations/generate-explanations/prompt.ts`, `batch-generator.ts`, `types.ts`, `index.ts`
- Delete: `src/features/ai/agents/explanations/generate-explanations.ts`

- [ ] **Step 1: Read and understand**

Identify: generateExplanations, prompts, batch logic.

- [ ] **Step 2: Split**

- `prompt.ts` — system/user prompts
- `batch-generator.ts` — batch generation logic
- `types.ts` — ExplanationResult
- `index.ts` — barrel re-exports `generateExplanations`

- [ ] **Step 3: Verify and commit**

```bash
rm src/features/ai/agents/explanations/generate-explanations.ts
npm run typecheck 2>&1 | head -40
git add src/features/ai/agents/explanations/generate-explanations/
git rm src/features/ai/agents/explanations/generate-explanations.ts
git commit -m "refactor: split generate-explanations into focused modules"
```

---

### Task E11: Refactor `src/components/quiz/quiz.tsx` (159L)

**Files:**
- Read: `src/components/quiz/quiz.tsx`
- Create: `src/components/quiz/quiz/quiz-navigation.tsx`, `quiz-timer.tsx`, `use-quiz-state.ts`, `index.tsx`
- Delete: `src/components/quiz/quiz.tsx`

- [ ] **Step 1: Read and understand**

Identify: Quiz component, navigation, timer, state management.

- [ ] **Step 2: Split**

- `quiz-navigation.tsx` — QuizNavigation component
- `quiz-timer.tsx` — QuizTimer component
- `use-quiz-state.ts` — useQuizState hook
- `index.tsx` — barrel re-exports Quiz component

- [ ] **Step 3: Verify and commit**

```bash
rm src/components/quiz/quiz.tsx
npm run typecheck 2>&1 | head -40
git add src/components/quiz/quiz/
git rm src/components/quiz/quiz.tsx
git commit -m "refactor: split quiz into navigation, timer, state hook"
```

---

### Task E12: Cleanup `src/features/ai/components/chat/message/chat-message-utils.ts` (149L)

**Files:**
- Read: `src/features/ai/components/chat/message/chat-message-utils.ts`
- Create: (only if needed to stay under 150L)
- Modify: `chat-message-utils.ts` (minor cleanup if needed)

- [ ] **Step 1: Read and verify**

If file is already clean and under 150L, skip — just verify.

- [ ] **Step 2: If splitting needed, extract**

Extract 1-2 helper functions into a sibling file like `chat-message-formatters.ts`.

- [ ] **Step 3: Verify and commit (or skip)**

```bash
npm run typecheck 2>&1 | head -40
git commit -am "refactor: minor chat-message-utils cleanup" || echo "No changes needed"
```

---

## Final Verification

- [ ] **Run full typecheck**

```bash
npm run typecheck
```

Must pass with zero errors.

- [ ] **Run lint**

```bash
npm run lint
```

Must pass with zero errors.

- [ ] **Run tests**

```bash
npm run test
```

All existing tests must pass.

- [ ] **Verify no broken imports**

```bash
grep -rn "from.*queries\"" src/ | grep -v "queries/" | head -20
grep -rn "from.*ingestStore\"" src/ | grep -v "ingest-store/" | head -20
# Repeat for all refactored paths
```

All imports should resolve to the new barrel `index.ts` paths.

- [ ] **Final commit**

```bash
git status
git add -A
git commit -m "refactor: complete file splitting — max 150L per file"
```
